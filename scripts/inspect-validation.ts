import { config } from 'dotenv';
config({ path: '.env.local', override: true });

async function main() {
  const slug = process.argv[2] ?? 'linear-3';
  const { db } = await import('../src/lib/db/client');
  const { bundles } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const [b] = await db.select().from(bundles).where(eq(bundles.slug, slug)).limit(1);
  if (!b) {
    console.error('not found');
    process.exit(1);
  }
  console.log('=== REVIEW NOTES (linter summary) ===');
  console.log(b.reviewNotes ?? '(none)');
  console.log('');

  const { lintDesignMd } = await import('../src/lib/generator/lint-design-md');
  const summary = await lintDesignMd(b.designMd ?? '');
  console.log('=== Linter findings ===');
  for (const f of summary.report.findings) {
    console.log(`  [${f.severity}] ${f.path ?? ''} ${f.message}`);
  }
  console.log('');
  console.log('Counts:', summary.counts);
  console.log('Sections:', summary.sections);
  console.log('passes:', summary.passes);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
