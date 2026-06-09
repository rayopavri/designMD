/**
 * Backfill section order for existing bundles — WITHOUT a full pipeline re-run.
 *
 * The @google/design.md spec (dist/spec.md) requires this canonical order:
 *   6. Shapes → 7. Components → 8. Do's and Don'ts
 *
 * A prompt bug caused every generated file to place Do's and Don'ts before
 * Components, triggering a `section-order` linter warning on every bundle.
 * This script swaps those two sections and re-lints + re-scores in-place.
 *
 * Optionally also injects the deep-reference preamble into the Components
 * section, teaching users to add `→ Deep reference:` links to their metadata.
 *
 * Modes (combine as needed):
 *   (default)   dry-run — prints before→after, writes nothing.
 *   --write     persist the fixed design.md and updated coverage scores.
 *   --preamble  also inject the deep-reference preamble into ## Components.
 *   --slug=foo  only process the bundle with this slug (safe single-bundle test).
 *
 * Usage:
 *   pnpm tsx scripts/backfill-section-order.ts                 # dry-run, all
 *   pnpm tsx scripts/backfill-section-order.ts --slug=hp
 *   pnpm tsx scripts/backfill-section-order.ts --preamble --write
 *
 * Requires .env.local with DATABASE_URL. On corporate WiFi ports 5432/6543 are
 * blocked — tether to a phone hotspot first.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

const WRITE = process.argv.includes('--write');
const PREAMBLE = process.argv.includes('--preamble');
const SLUG = process.argv.find((a) => a.startsWith('--slug='))?.slice('--slug='.length);

// The preamble block that goes right after the ## Components heading.
const DEEP_REF_PREAMBLE = `
> **Note:** This spec was generated from a website scrape and contains visual approximations.
> For production use, add a deep reference to each component pointing to its authoritative
> source (Storybook story, metadata file, or component spec):
> \`→ Deep reference: src/components/Button/metadata.ts\`

`;

interface Section {
  raw: string; // Full section text including heading and trailing content
  heading: string; // The ## heading line text (without trailing \n)
}

/** Split a markdown body into a prefix (before first ##) and an array of ## sections. */
function parseSections(body: string): { prefix: string; sections: Section[] } {
  // Match ## headings at the start of a line (not ### or deeper — ## followed by space)
  const re = /^(## [^\n]*)\n/gm;
  const positions: { index: number; heading: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    positions.push({ index: m.index, heading: m[1] });
  }

  if (positions.length === 0) {
    return { prefix: body, sections: [] };
  }

  const prefix = body.slice(0, positions[0].index);
  const sections: Section[] = positions.map((p, i) => {
    const end = i + 1 < positions.length ? positions[i + 1].index : body.length;
    return {
      raw: body.slice(p.index, end),
      heading: p.heading,
    };
  });

  return { prefix, sections };
}

function assembleSections(prefix: string, sections: Section[]): string {
  return prefix + sections.map((s) => s.raw).join('');
}

/** Returns the full design.md with Components and Do's and Don'ts in the correct order.
 *  Returns null if no swap was needed. */
function fixSectionOrder(md: string): string | null {
  // Preserve YAML front-matter unchanged
  const fmEnd = md.indexOf('\n---\n', 4);
  if (fmEnd === -1) return null;
  const frontMatter = md.slice(0, fmEnd + 5); // includes trailing \n---\n
  const body = md.slice(fmEnd + 5);

  const { prefix, sections } = parseSections(body);
  if (sections.length === 0) return null;

  const idxComponents = sections.findIndex((s) =>
    /^## components$/i.test(s.heading.trim()),
  );
  const idxDosDonts = sections.findIndex((s) =>
    /^## do'?s (and|&) don'?ts?$/i.test(s.heading.trim()),
  );

  if (idxComponents === -1 || idxDosDonts === -1) return null;
  if (idxComponents < idxDosDonts) return null; // Already correct

  // Swap
  const fixed = [...sections];
  [fixed[idxComponents], fixed[idxDosDonts]] = [fixed[idxDosDonts], fixed[idxComponents]];

  return frontMatter + assembleSections(prefix, fixed);
}

/** Inject the deep-reference preamble right after the ## Components heading. */
function injectDeepRefPreamble(md: string): { result: string; injected: boolean } {
  if (md.includes('→ Deep reference:')) {
    return { result: md, injected: false };
  }

  // Find the ## Components heading in the body
  const componentsRe = /^(## Components[^\n]*\n)/im;
  const match = md.match(componentsRe);
  if (!match || match.index === undefined) {
    return { result: md, injected: false };
  }

  const insertAt = match.index + match[0].length;
  const result = md.slice(0, insertAt) + DEEP_REF_PREAMBLE + md.slice(insertAt);
  return { result, injected: true };
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function sbGet(query: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase GET failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbPatch(id: string, data: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/bundles?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Supabase PATCH failed: ${res.status} ${await res.text()}`);
}

async function main() {
  const { lintDesignMd } = await import('../src/lib/generator/lint-design-md');
  const { scoreFromLint } = await import('../src/lib/generator/coverage');

  const query = SLUG
    ? `bundles?select=id,slug,design_md,coverage_score&slug=eq.${SLUG}`
    : `bundles?select=id,slug,design_md,coverage_score&design_md=not.is.null&limit=1000`;

  const rows: Array<{ id: string; slug: string; design_md: string | null; coverage_score: number | null }> =
    await sbGet(query);

  const withMd = rows.filter((r) => r.design_md && r.design_md.trim());
  console.log(
    `Mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}${PREAMBLE ? ' +preamble' : ''}` +
      `${SLUG ? ` (slug=${SLUG})` : ''}`,
  );
  console.log(`Bundles with a design.md: ${withMd.length}\n`);
  console.log(
    'slug'.padEnd(30) +
      'order-fix'.padEnd(12) +
      'preamble'.padEnd(12) +
      'score'.padEnd(14) +
      'action',
  );
  console.log('-'.repeat(84));

  let updated = 0;
  let unchanged = 0;

  for (const b of withMd) {
    let md = b.design_md!;
    let swapped = false;
    let preambleInjected = false;

    const reordered = fixSectionOrder(md);
    if (reordered !== null) {
      md = reordered;
      swapped = true;
    }

    if (PREAMBLE) {
      const { result, injected } = injectDeepRefPreamble(md);
      if (injected) {
        md = result;
        preambleInjected = true;
      }
    }

    const changed = swapped || preambleInjected;

    let cov;
    try {
      const lint = await lintDesignMd(md);
      cov = scoreFromLint(lint, md);
    } catch (err) {
      console.log(
        `${b.slug.padEnd(30)}ERROR  lint/score failed: ${err instanceof Error ? err.message : err}`,
      );
      continue;
    }

    const scoreBefore = b.coverage_score ?? 0;
    const action = !changed
      ? 'no change'
      : `${WRITE ? 'UPDATE' : 'would update'}${swapped ? ' +reorder' : ''}${preambleInjected ? ' +preamble' : ''}`;

    console.log(
      b.slug.padEnd(30) +
        (swapped ? 'yes' : 'no').padEnd(12) +
        (preambleInjected ? 'yes' : 'no').padEnd(12) +
        `${scoreBefore}→${cov.overall}`.padEnd(14) +
        action,
    );

    if (!changed) {
      unchanged += 1;
      continue;
    }

    if (WRITE) {
      await sbPatch(b.id, {
        design_md: md,
        coverage_score: cov.overall,
        coverage_colors: cov.colors,
        coverage_typography: cov.typography,
        coverage_layout: cov.layout,
        coverage_elevation: cov.elevation,
        coverage_shapes: cov.shapes,
        coverage_components: cov.components,
        coverage_dos_donts: cov.dosDonts,
        updated_at: new Date().toISOString(),
      });
      updated += 1;
    }
  }

  console.log('-'.repeat(84));
  console.log(
    `${WRITE ? 'Updated' : 'Would update'}: ${WRITE ? updated : withMd.length - unchanged} | unchanged: ${unchanged}`,
  );
  if (!WRITE) console.log('\nDry run — nothing written. Re-run with --write to persist.');
  process.exit(0);
}

main().catch((err) => {
  console.error('✗ backfill failed:', err);
  process.exit(1);
});
