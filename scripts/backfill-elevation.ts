/**
 * Backfill elevation coverage for existing bundles — WITHOUT a full pipeline
 * re-run (no Firecrawl, no Gemini, no Sonnet, no credits).
 *
 * Why this works: shadows are effectively unobservable from a scrape, so
 * elevation is always *inferred* anyway. A full re-run would recover nothing
 * new for elevation — we can do the same inference deterministically here and
 * just re-lint + re-score the design.md we already have in the DB.
 *
 * Two things changed in the scorer/pipeline that this script applies retro-
 * actively:
 *   1. coverage.ts now scores elevation on the YAML `elevation:` token count
 *      (not just prose), so a present scale stops reading as "missing".
 *   2. infer-elevation.ts synthesises an sm/md/lg/xl scale from the brand's
 *      design style when none was extracted.
 *
 * Modes (combine as needed):
 *   (default)   dry-run — prints before→after, writes nothing.
 *   --write     persist the recomputed coverage (and injected design.md).
 *   --inject    for bundles whose design.md has no `elevation:` block, splice
 *               an inferred scale into the YAML front-matter + a prose note
 *               into the ## Elevation & Depth section.
 *   --slug=foo  only process the bundle with this slug (safe single-bundle test).
 *
 * Usage:
 *   pnpm tsx scripts/backfill-elevation.ts                  # dry-run, all bundles
 *   pnpm tsx scripts/backfill-elevation.ts --slug=hp --inject
 *   pnpm tsx scripts/backfill-elevation.ts --inject --write # the real backfill
 *
 * Requires .env.local with DATABASE_URL. On corporate WiFi the DB ports
 * (5432/6543) are blocked — tether to a phone hotspot first.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { dump as yamlDump, load as yamlLoad } from 'js-yaml';

const WRITE = process.argv.includes('--write');
const INJECT = process.argv.includes('--inject');
const SLUG = process.argv.find((a) => a.startsWith('--slug='))?.slice('--slug='.length);

const YAML_OPTS = {
  quotingType: '"' as const,
  forceQuotes: false,
  lineWidth: 100,
  noRefs: true,
  sortKeys: false,
};

/** Count entries in a front-matter map key. 0 for old format / missing / malformed. */
function countFrontMatterMapKeys(md: string, key: string): number {
  const fm = md.match(/^---\n([\s\S]*?)\n---/m);
  if (!fm) return 0;
  try {
    const obj = yamlLoad(fm[1]) as Record<string, unknown> | null;
    const map = obj?.[key];
    if (map && typeof map === 'object' && !Array.isArray(map)) {
      return Object.keys(map as Record<string, unknown>).length;
    }
  } catch {
    /* malformed */
  }
  return 0;
}

/**
 * Splice an inferred `elevation:` block into the YAML front-matter and, when the
 * ## Elevation & Depth section body is empty, insert an inferred prose note.
 * Leaves every existing front-matter line byte-identical (no re-serialisation).
 */
function injectElevation(
  md: string,
  scale: ReadonlyArray<{ name: string; value: string }>,
  note: string,
): string {
  const elevObj: Record<string, string> = {};
  for (const t of scale) elevObj[t.name] = t.value;
  const elevYaml = yamlDump({ elevation: elevObj }, YAML_OPTS).trimEnd();

  // 1. Insert the elevation map just before the closing `---` of the front-matter.
  let out = md.replace(
    /^(---\n[\s\S]*?\n)(---)/m,
    (_m, head: string, close: string) => `${head}${elevYaml}\n${close}`,
  );

  // 2. Fill an empty ## Elevation & Depth body with the inferred note.
  out = out.replace(
    /(^##\s+Elevation(?:\s*&\s*Depth)?[^\n]*\n)([\s\S]*?)(?=\n##\s|\n#\s|$)/mi,
    (_m, heading: string, body: string) =>
      body.trim().length < 40 ? `${heading}\n${note}\n` : `${heading}${body}`,
  );

  return out;
}

async function main() {
  const { db } = await import('../src/lib/db/client');
  const { bundles } = await import('../src/lib/db/schema');
  const { eq, isNotNull } = await import('drizzle-orm');
  const { lintDesignMd } = await import('../src/lib/generator/lint-design-md');
  const { scoreFromLint } = await import('../src/lib/generator/coverage');
  const { inferElevationScale, elevationWeightFor, inferredElevationNote } = await import(
    '../src/lib/generator/infer-elevation'
  );

  const rows = await db
    .select({
      id: bundles.id,
      slug: bundles.slug,
      designMd: bundles.designMd,
      designStyle: bundles.designStyle,
      coverageScore: bundles.coverageScore,
      coverageElevation: bundles.coverageElevation,
    })
    .from(bundles)
    .where(SLUG ? eq(bundles.slug, SLUG) : isNotNull(bundles.designMd));

  const withMd = rows.filter((r) => r.designMd && r.designMd.trim());
  console.log(
    `Mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}${INJECT ? ' +inject' : ''}` +
      `${SLUG ? ` (slug=${SLUG})` : ''}`,
  );
  console.log(`Bundles with a design.md: ${withMd.length}\n`);
  console.log(
    'slug'.padEnd(28) + 'tokens'.padEnd(8) + 'elev'.padEnd(12) + 'overall'.padEnd(12) + 'action',
  );
  console.log('-'.repeat(78));

  let updated = 0;
  let injected = 0;
  let unchanged = 0;

  for (const b of withMd) {
    let md = b.designMd!;
    const styles = b.designStyle ?? [];
    let didInject = false;

    const elevCountBefore = countFrontMatterMapKeys(md, 'elevation');

    if (INJECT && elevCountBefore === 0) {
      const weight = elevationWeightFor(styles);
      md = injectElevation(md, inferElevationScale(styles), inferredElevationNote(weight));
      didInject = md !== b.designMd;
    }

    let cov;
    try {
      const lint = await lintDesignMd(md);
      cov = scoreFromLint(lint, md);
    } catch (err) {
      console.log(
        `${b.slug.padEnd(28)}${String(elevCountBefore).padEnd(8)}` +
          `ERROR  lint/score failed: ${err instanceof Error ? err.message : err}`,
      );
      continue;
    }

    const elevBefore = b.coverageElevation ?? 0;
    const scoreBefore = b.coverageScore ?? 0;
    const elevCountAfter = countFrontMatterMapKeys(md, 'elevation');
    const coverageChanged =
      cov.elevation !== elevBefore || cov.overall !== scoreBefore;
    const willChange = coverageChanged || didInject;

    const action = !willChange
      ? 'no change'
      : `${WRITE ? 'UPDATE' : 'would update'}${didInject ? ' +inject' : ''}`;
    console.log(
      b.slug.padEnd(28) +
        `${elevCountBefore}→${elevCountAfter}`.padEnd(8) +
        `${elevBefore}→${cov.elevation}`.padEnd(12) +
        `${scoreBefore}→${cov.overall}`.padEnd(12) +
        action,
    );

    if (!willChange) {
      unchanged += 1;
      continue;
    }
    if (didInject) injected += 1;

    if (WRITE) {
      await db
        .update(bundles)
        .set({
          coverageScore: cov.overall,
          coverageColors: cov.colors,
          coverageTypography: cov.typography,
          coverageLayout: cov.layout,
          coverageElevation: cov.elevation,
          coverageShapes: cov.shapes,
          coverageComponents: cov.components,
          coverageDosDonts: cov.dosDonts,
          ...(didInject ? { designMd: md } : {}),
          updatedAt: new Date(),
        })
        .where(eq(bundles.id, b.id));
      updated += 1;
    }
  }

  console.log('-'.repeat(78));
  console.log(
    `${WRITE ? 'Updated' : 'Would update'}: ${WRITE ? updated : withMd.length - unchanged} | ` +
      `injected: ${injected} | unchanged: ${unchanged}`,
  );
  if (!WRITE) console.log('\nDry run — nothing written. Re-run with --write to persist.');
  process.exit(0);
}

main().catch((err) => {
  console.error('✗ backfill failed:', err);
  process.exit(1);
});
