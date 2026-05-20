/**
 * Smoke-test the export emitters directly against a stored bundle's design.md,
 * bypassing the HTTP route so we can verify on a pending_review bundle.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

async function main() {
  const slug = process.argv[2] ?? 'linear-6';
  const { db } = await import('../src/lib/db/client');
  const { bundles } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const [b] = await db.select().from(bundles).where(eq(bundles.slug, slug)).limit(1);
  if (!b || !b.designMd) {
    console.error('no design.md for', slug);
    process.exit(1);
  }

  const mod = await import('@google/design.md/linter');
  const report = mod.lint(b.designMd);

  console.log('=== Tailwind v3 (theme.extend) ===');
  if (report.tailwindConfig.success) {
    console.log(JSON.stringify(report.tailwindConfig.data, null, 2).slice(0, 1200));
  } else {
    console.log('FAIL');
  }
  console.log('');

  console.log('=== DTCG tokens.json ===');
  const dtcg = new mod.DtcgEmitterHandler();
  const dtcgOut = dtcg.execute(report.designSystem);
  if (dtcgOut.success) {
    console.log(JSON.stringify(dtcgOut.data, null, 2).slice(0, 1200));
  } else {
    console.log('FAIL');
  }
  console.log('');

  console.log('=== Tailwind v4 @theme CSS (first 1500 chars) ===');
  // Inline-mini-emit (mirrors the route).
  const lines: string[] = ['@theme {'];
  for (const [name, color] of report.designSystem.colors) {
    lines.push(`  --color-${name}: ${color.hex.toUpperCase()};`);
  }
  for (const [name, t] of report.designSystem.typography) {
    if (t.fontFamily) lines.push(`  --font-${name}: ${t.fontFamily};`);
    if (t.fontSize) lines.push(`  --text-${name}: ${t.fontSize.value}${t.fontSize.unit};`);
    if (t.lineHeight) lines.push(`  --leading-${name}: ${t.lineHeight.value}${t.lineHeight.unit};`);
  }
  for (const [name, r] of report.designSystem.rounded) {
    lines.push(`  --radius-${name}: ${r.value}${r.unit};`);
  }
  for (const [name, s] of report.designSystem.spacing) {
    lines.push(`  --spacing-${name}: ${s.value}${s.unit};`);
  }
  lines.push('}');
  console.log(lines.join('\n').slice(0, 1500));

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
