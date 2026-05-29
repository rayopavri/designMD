/**
 * A/B comparison harness for the COMPANION-PROMPT step.
 *
 * Generates the companion prompt for real bundles with both candidate models —
 *   - Sonnet 4.6  (claude-sonnet-4-6, current production model, via Anthropic)
 *   - Gemini 3.1 Flash-Lite (google/gemini-3.1-flash-lite, via OpenRouter)
 * — using byte-identical system + user prompts (imported from the production
 * module), then scores each output on the rubric the system prompt actually
 * enforces and, optionally, runs a blind LLM judge.
 *
 * The goal: decide whether the companion step can drop from Sonnet ($3/$15 per
 * MTok) to Gemini Flash-Lite ($0.25/$1.50) without losing quality. The
 * companion output is tiny (<=350 words), so the only thing the Sonnet premium
 * buys here is precision/instruction-following — this measures exactly that.
 *
 * Usage:
 *   pnpm tsx scripts/compare-companion-models.ts                # 5 newest published specs
 *   pnpm tsx scripts/compare-companion-models.ts --limit 10
 *   pnpm tsx scripts/compare-companion-models.ts --slugs vercel-3,stripe,linear
 *   pnpm tsx scripts/compare-companion-models.ts --no-judge     # skip the LLM judge
 *   pnpm tsx scripts/compare-companion-models.ts --out report.md
 *
 * Requires .env.local with DATABASE_URL, ANTHROPIC_API_KEY, OPENROUTER_API_KEY.
 * The LLM judge (on by default when ANTHROPIC_API_KEY is set) uses Sonnet; pass
 * --no-judge to compare on the programmatic rubric alone.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { writeFileSync } from 'node:fs';

const SONNET_MODEL = 'claude-sonnet-4-6';
const GEMINI_MODEL = 'google/gemini-3.1-flash-lite';

// Equal sampling temperature for both models so the comparison is fair
// (prod Sonnet uses the API default; we pin both here).
const TEMPERATURE = 0.4;
const MAX_OUTPUT_TOKENS = 1500;
const CALL_TIMEOUT_MS = 45_000;

// Rough $/token for a back-of-envelope cost line. Output dominates here.
const PRICING = {
  [SONNET_MODEL]: { in: 3 / 1e6, out: 15 / 1e6 },
  [GEMINI_MODEL]: { in: 0.25 / 1e6, out: 1.5 / 1e6 },
} as const;

interface Args {
  slugs: string[] | null;
  limit: number;
  judge: boolean;
  out: string | null;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = { slugs: null, limit: 5, judge: true, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--slugs') args.slugs = (argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--limit') args.limit = Number(argv[++i] ?? 5);
    else if (a === '--no-judge') args.judge = false;
    else if (a === '--out') args.out = argv[++i] ?? null;
  }
  return args;
}

interface SpecRow {
  slug: string;
  title: string;
  designMd: string;
  designStyle: string[];
}

async function loadSpecs(args: Args): Promise<SpecRow[]> {
  const { db } = await import('../src/lib/db/client');
  const { bundles } = await import('../src/lib/db/schema');
  const { and, eq, isNotNull, inArray, desc, sql } = await import('drizzle-orm');

  const cols = {
    slug: bundles.slug,
    title: bundles.title,
    designMd: bundles.designMd,
    designStyle: bundles.designStyle,
  };

  const rows = args.slugs
    ? await db.select(cols).from(bundles).where(inArray(bundles.slug, args.slugs))
    : await db
        .select(cols)
        .from(bundles)
        .where(and(eq(bundles.status, 'published'), isNotNull(bundles.designMd), sql`length(${bundles.designMd}) > 200`))
        .orderBy(desc(bundles.createdAt))
        .limit(args.limit);

  return rows
    .filter((r): r is SpecRow => typeof r.designMd === 'string' && r.designMd.length > 0)
    .map((r) => ({ ...r, designStyle: r.designStyle ?? [] }));
}

interface GenResult {
  model: string;
  text: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  error?: string;
}

/** Sonnet via Anthropic — mirrors the production runCompanionSonnet call. */
async function genSonnet(systemPrompt: string, userPrompt: string): Promise<GenResult> {
  const { anthropic } = await import('../src/lib/ai/anthropic');
  const t0 = Date.now();
  try {
    const res = await anthropic().beta.messages.create(
      {
        model: SONNET_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: TEMPERATURE,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userPrompt }],
      },
      { timeout: CALL_TIMEOUT_MS },
    );
    const text = res.content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map((c) => c.text)
      .join('\n')
      .trim();
    const pIn = res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0);
    const pOut = res.usage.output_tokens;
    const price = PRICING[SONNET_MODEL];
    return {
      model: SONNET_MODEL,
      text,
      latencyMs: Date.now() - t0,
      promptTokens: pIn,
      completionTokens: pOut,
      costUsd: pIn * price.in + pOut * price.out,
    };
  } catch (err) {
    return blankResult(SONNET_MODEL, Date.now() - t0, err);
  }
}

/** Gemini Flash-Lite via OpenRouter — same prompts, system as a message. */
async function genGemini(systemPrompt: string, userPrompt: string): Promise<GenResult> {
  const { chatCompletion } = await import('../src/lib/ai/openrouter');
  const t0 = Date.now();
  try {
    const res = await chatCompletion({
      model: GEMINI_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: TEMPERATURE,
      timeoutMs: CALL_TIMEOUT_MS,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    const price = PRICING[GEMINI_MODEL];
    return {
      model: GEMINI_MODEL,
      text: res.content.trim(),
      latencyMs: Date.now() - t0,
      promptTokens: res.usage.promptTokens,
      completionTokens: res.usage.completionTokens,
      costUsd: res.usage.promptTokens * price.in + res.usage.completionTokens * price.out,
    };
  } catch (err) {
    return blankResult(GEMINI_MODEL, Date.now() - t0, err);
  }
}

function blankResult(model: string, latencyMs: number, err: unknown): GenResult {
  return {
    model,
    text: '',
    latencyMs,
    promptTokens: 0,
    completionTokens: 0,
    costUsd: 0,
    error: err instanceof Error ? err.message : String(err),
  };
}

// ---- Programmatic rubric (mirrors the system prompt's hard rules) ----------

interface Rubric {
  wordCount: number;
  withinWordCap: boolean; // <= 350
  hasRole: boolean;
  hasHowToUse: boolean;
  hasOutputContract: boolean;
  hasWhenInDoubt: boolean;
  hasMustAndMustNot: boolean;
  sectionsPresent: number; // 0..5
  tokenRefs: number; // count of `{...}` backtick-wrapped token refs
  frameworkLeaks: string[]; // tailwind/figma/shadcn/radix mentions (should be empty)
  emojis: number;
  hasPreamble: boolean; // "here is the companion" etc — should be false
  score: number; // 0..100 composite
}

function scoreRubric(text: string): Rubric {
  const lower = text.toLowerCase();
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const has = (re: RegExp) => re.test(text);

  const hasRole = has(/^#{1,3}\s*role\b/im);
  const hasHowToUse = has(/^#{1,3}\s*how to use/im);
  const hasOutputContract = has(/^#{1,3}\s*output contract/im);
  const hasWhenInDoubt = has(/^#{1,3}\s*when in doubt/im);
  const hasMustAndMustNot = /must not/i.test(text) && /\bmust\b/i.test(text);

  const tokenRefs = (text.match(/`\{[a-zA-Z0-9._-]+\}`/g) ?? []).length;

  const frameworkLeaks = ['tailwind', 'figma', 'shadcn', 'radix'].filter((f) => lower.includes(f));
  const emojis = (text.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  const hasPreamble = /^(here('?s| is)|sure|certainly|below is)\b/i.test(text.trim());

  const sectionsPresent = [hasRole, hasHowToUse, hasOutputContract, hasWhenInDoubt, hasMustAndMustNot].filter(
    Boolean,
  ).length;
  const withinWordCap = wordCount <= 350 && wordCount > 0;

  // Composite: sections (50) + word cap (15) + has token refs (15)
  //          - framework leaks (10 each) - emojis (5 each) - preamble (10)
  let score = sectionsPresent * 10 + (withinWordCap ? 15 : 0) + (tokenRefs >= 3 ? 15 : tokenRefs > 0 ? 8 : 0);
  score -= frameworkLeaks.length * 10 + emojis * 5 + (hasPreamble ? 10 : 0);
  score = Math.max(0, Math.min(100, score));

  return {
    wordCount,
    withinWordCap,
    hasRole,
    hasHowToUse,
    hasOutputContract,
    hasWhenInDoubt,
    hasMustAndMustNot,
    sectionsPresent,
    tokenRefs,
    frameworkLeaks,
    emojis,
    hasPreamble,
    score,
  };
}

// ---- Optional blind LLM judge ----------------------------------------------

interface JudgeVerdict {
  winner: 'A' | 'B' | 'tie';
  reason: string;
}

async function judge(designMd: string, outA: string, outB: string): Promise<JudgeVerdict | null> {
  const { anthropic } = await import('../src/lib/ai/anthropic');
  const sys = `You are evaluating two companion prompts written for the SAME design.md spec.
A companion prompt is a terse, tool-agnostic instruction read by an AI coding tool (Claude/Cursor/Lovable)
on every UI generation. Judge on: instruction-following precision, faithful use of the spec's token names,
correct section structure (Role / How to use design.md / Output contract with Must & Must NOT / When in doubt),
brevity (<=350 words), and absence of framework names, emoji, or filler.
Reply with ONLY compact JSON: {"winner":"A"|"B"|"tie","reason":"<=30 words"}.`;
  const user = [
    'DESIGN.MD SPEC (truncated):',
    designMd.slice(0, 6000),
    '',
    '--- COMPANION A ---',
    outA,
    '',
    '--- COMPANION B ---',
    outB,
  ].join('\n');

  try {
    const res = await anthropic().beta.messages.create(
      {
        model: SONNET_MODEL,
        max_tokens: 200,
        temperature: 0,
        system: [{ type: 'text', text: sys }],
        messages: [{ role: 'user', content: user }],
      },
      { timeout: CALL_TIMEOUT_MS },
    );
    const raw = res.content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map((c) => c.text)
      .join('')
      .trim();
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    return JSON.parse(m[0]) as JudgeVerdict;
  } catch {
    return null;
  }
}

// ---- Main ------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  const { SYSTEM_PROMPT, buildSpecUserPrompt } = await import('../src/lib/ai/generate-companion-prompt');

  const specs = await loadSpecs(args);
  if (specs.length === 0) {
    console.error('No specs found. Pass --slugs <a,b,c> or seed some published bundles.');
    process.exit(1);
  }
  console.log(`Comparing on ${specs.length} spec(s): ${specs.map((s) => s.slug).join(', ')}\n`);

  const judgeOn = args.judge && !!process.env.ANTHROPIC_API_KEY;
  const lines: string[] = [];
  const log = (s = '') => {
    console.log(s);
    lines.push(s);
  };

  log(`# Companion-model comparison — Sonnet 4.6 vs Gemini 3.1 Flash-Lite`);
  log(`\n_${specs.length} spec(s), temperature ${TEMPERATURE}, judge ${judgeOn ? 'on (Sonnet, blind A/B)' : 'off'}_\n`);

  const agg = {
    [SONNET_MODEL]: { score: 0, latency: 0, cost: 0, wins: 0, n: 0 },
    [GEMINI_MODEL]: { score: 0, latency: 0, cost: 0, wins: 0, n: 0 },
    ties: 0,
  };

  for (const spec of specs) {
    const userPrompt = buildSpecUserPrompt({
      brandName: spec.title,
      designMd: spec.designMd,
      designStyles: spec.designStyle,
    });

    const [sonnet, gemini] = await Promise.all([
      genSonnet(SYSTEM_PROMPT, userPrompt),
      genGemini(SYSTEM_PROMPT, userPrompt),
    ]);

    const rs = scoreRubric(sonnet.text);
    const rg = scoreRubric(gemini.text);

    log(`\n## ${spec.slug} — "${spec.title}"`);
    log('');
    log('| Metric | Sonnet 4.6 | Gemini 3.1 Flash-Lite |');
    log('|---|---|---|');
    log(`| Rubric score | ${fmtErr(sonnet, rs.score)} | ${fmtErr(gemini, rg.score)} |`);
    log(`| Sections (/5) | ${rs.sectionsPresent} | ${rg.sectionsPresent} |`);
    log(`| Word count (≤350) | ${rs.wordCount}${rs.withinWordCap ? '' : ' ⚠'} | ${rg.wordCount}${rg.withinWordCap ? '' : ' ⚠'} |`);
    log(`| Token refs \`{…}\` | ${rs.tokenRefs} | ${rg.tokenRefs} |`);
    log(`| Framework leaks | ${rs.frameworkLeaks.join(',') || '—'} | ${rg.frameworkLeaks.join(',') || '—'} |`);
    log(`| Emojis / preamble | ${rs.emojis}/${rs.hasPreamble ? 'Y' : 'N'} | ${rg.emojis}/${rg.hasPreamble ? 'Y' : 'N'} |`);
    log(`| Latency | ${sonnet.latencyMs} ms | ${gemini.latencyMs} ms |`);
    log(`| Output tokens | ${sonnet.completionTokens} | ${gemini.completionTokens} |`);
    log(`| Cost / call | $${sonnet.costUsd.toFixed(5)} | $${gemini.costUsd.toFixed(5)} |`);

    let verdict: JudgeVerdict | null = null;
    if (judgeOn && sonnet.text && gemini.text) {
      // Randomize A/B assignment so the judge can't anchor on position.
      const sonnetIsA = Math.random() < 0.5;
      verdict = await judge(
        spec.designMd,
        sonnetIsA ? sonnet.text : gemini.text,
        sonnetIsA ? gemini.text : sonnet.text,
      );
      if (verdict) {
        const winnerModel =
          verdict.winner === 'tie'
            ? 'tie'
            : (verdict.winner === 'A') === sonnetIsA
              ? SONNET_MODEL
              : GEMINI_MODEL;
        log(`| **Judge** | ${winnerModel === SONNET_MODEL ? '✅ wins' : winnerModel === 'tie' ? 'tie' : 'loses'} | ${winnerModel === GEMINI_MODEL ? '✅ wins' : winnerModel === 'tie' ? 'tie' : 'loses'} |`);
        log(`\n> Judge: ${verdict.reason}`);
        if (winnerModel === SONNET_MODEL) agg[SONNET_MODEL].wins++;
        else if (winnerModel === GEMINI_MODEL) agg[GEMINI_MODEL].wins++;
        else agg.ties++;
      }
    }

    if (sonnet.error) log(`\n> Sonnet error: ${sonnet.error}`);
    if (gemini.error) log(`\n> Gemini error: ${gemini.error}`);

    if (!sonnet.error) {
      agg[SONNET_MODEL].score += rs.score;
      agg[SONNET_MODEL].latency += sonnet.latencyMs;
      agg[SONNET_MODEL].cost += sonnet.costUsd;
      agg[SONNET_MODEL].n++;
    }
    if (!gemini.error) {
      agg[GEMINI_MODEL].score += rg.score;
      agg[GEMINI_MODEL].latency += gemini.latencyMs;
      agg[GEMINI_MODEL].cost += gemini.costUsd;
      agg[GEMINI_MODEL].n++;
    }
  }

  const avg = (m: typeof SONNET_MODEL | typeof GEMINI_MODEL, k: 'score' | 'latency' | 'cost') =>
    agg[m].n ? agg[m][k] / agg[m].n : 0;

  log(`\n---\n\n## Summary (averages)`);
  log('');
  log('| Metric | Sonnet 4.6 | Gemini 3.1 Flash-Lite |');
  log('|---|---|---|');
  log(`| Avg rubric score | ${avg(SONNET_MODEL, 'score').toFixed(1)} | ${avg(GEMINI_MODEL, 'score').toFixed(1)} |`);
  log(`| Avg latency | ${avg(SONNET_MODEL, 'latency').toFixed(0)} ms | ${avg(GEMINI_MODEL, 'latency').toFixed(0)} ms |`);
  log(`| Avg cost / call | $${avg(SONNET_MODEL, 'cost').toFixed(5)} | $${avg(GEMINI_MODEL, 'cost').toFixed(5)} |`);
  if (judgeOn) log(`| Judge wins | ${agg[SONNET_MODEL].wins} | ${agg[GEMINI_MODEL].wins} | (ties: ${agg.ties})`);

  const costRatio = avg(GEMINI_MODEL, 'cost') > 0 ? avg(SONNET_MODEL, 'cost') / avg(GEMINI_MODEL, 'cost') : 0;
  if (costRatio) log(`\nGemini is **${costRatio.toFixed(1)}× cheaper** per companion call on this sample.`);

  if (args.out) {
    writeFileSync(args.out, lines.join('\n'));
    console.log(`\nReport written to ${args.out}`);
  }
  process.exit(0);
}

function fmtErr(r: GenResult, score: number): string {
  return r.error ? 'ERR' : String(score);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
