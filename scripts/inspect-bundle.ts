import { config } from 'dotenv';
config({ path: '.env.local', override: true });

async function main() {
  const slug = process.argv[2] ?? 'vercel-3';
  const { db } = await import('../src/lib/db/client');
  const { bundles } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const [b] = await db.select().from(bundles).where(eq(bundles.slug, slug)).limit(1);
  if (!b) {
    console.error('not found');
    process.exit(1);
  }
  console.log('=== COVERAGE ===');
  console.log({
    overall: b.coverageScore,
    colors: b.coverageColors,
    typography: b.coverageTypography,
    layout: b.coverageLayout,
    elevation: b.coverageElevation,
    shapes: b.coverageShapes,
    components: b.coverageComponents,
    dosDonts: b.coverageDosDonts,
  });
  console.log('\n=== DESIGN.MD (first 1800 chars) ===\n' + (b.designMd ?? '').slice(0, 1800));
  console.log('\n=== COMPANION (first 1200 chars) ===\n' + b.companionPrompt.slice(0, 1200));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
