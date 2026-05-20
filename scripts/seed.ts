/**
 * Seed the database with the 8 curated bundles from the existing UI data.
 *
 * Idempotent: re-running upserts on slug. Safe to run repeatedly during
 * development.
 *
 * Usage:  pnpm db:seed
 *
 * Note: env vars MUST be loaded before importing src/lib/db/client.ts
 * (which evaluates env.ts at import time). We use dynamic imports below.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { BUNDLES, type Bundle as UiBundle } from '../src/lib/ui-data/bundles';

// ─── Mapping helpers ────────────────────────────────────────

const SYSTEM_SEED_UID = '__system_seed__';
const SYSTEM_SEED_EMAIL = 'seed@uiuxskills.local';

function categorySlugFor(category: UiBundle['category']): string {
  switch (category) {
    case 'Devtools':
    case 'Enterprise':
    case 'Finance':
      return 'saas-web-apps';
    case 'Editorial':
    case 'Marketing':
      return 'marketing-sites';
    case 'Consumer':
      return 'mobile-apps';
    default:
      return 'saas-web-apps';
  }
}

function designStyleFor(feel: UiBundle['feel']): string {
  switch (feel) {
    case 'Dark':
      return 'dark-mode';
    case 'Light':
    case 'Editorial':
      return 'minimal';
    case 'Bold':
      return 'bold';
    case 'Playful':
      return 'playful';
    case 'Corporate':
      return 'enterprise';
    default:
      return 'minimal';
  }
}

function toolSlugFor(tool: UiBundle['worksWith'][number]): string {
  switch (tool) {
    case 'Claude':
      return 'claude';
    case 'Cursor':
      return 'cursor';
    case 'Lovable':
      return 'lovable';
    case 'Figma Make':
      return 'figma-make';
    default:
      return 'all';
  }
}

async function main() {
  // Dynamic imports so env is loaded first.
  const { eq, sql } = await import('drizzle-orm');
  const { db } = await import('../src/lib/db/client');
  const { users, categories, bundles } = await import('../src/lib/db/schema');

  console.log('[seed] starting…');

  // 1. Ensure system seed user
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.firebaseUid, SYSTEM_SEED_UID))
    .limit(1);
  let systemUserId: string;
  if (existingUser) {
    systemUserId = existingUser.id;
  } else {
    const [created] = await db
      .insert(users)
      .values({
        firebaseUid: SYSTEM_SEED_UID,
        email: SYSTEM_SEED_EMAIL,
        emailVerified: true,
        authProvider: 'email',
        displayName: 'Editorial',
        isEditor: true,
      })
      .returning({ id: users.id });
    if (!created) throw new Error('Failed to create system seed user');
    systemUserId = created.id;
  }
  console.log(`[seed] system user id: ${systemUserId}`);

  // 2. Load category map
  const catRows = await db
    .select({ id: categories.id, slug: categories.slug })
    .from(categories);
  const categoryMap = new Map(catRows.map((r) => [r.slug, r.id]));
  if (categoryMap.size === 0) {
    throw new Error('No categories in DB — run pnpm db:migrate first.');
  }
  console.log(`[seed] ${categoryMap.size} categories loaded`);

  // 3. Upsert bundles
  let inserted = 0;
  let updated = 0;
  for (const ui of BUNDLES) {
    const categorySlug = categorySlugFor(ui.category);
    const categoryId = categoryMap.get(categorySlug);
    if (!categoryId) {
      console.warn(`[seed] skipping ${ui.id}: unknown category slug ${categorySlug}`);
      continue;
    }

    const designStyles = [designStyleFor(ui.feel)];
    const tools = ui.worksWith.map(toolSlugFor);
    const sc = ui.sectionCoverage;

    const values = {
      slug: ui.id,
      title: ui.name,
      description: ui.description,
      type: 'design_md' as const,
      designMd: ui.designMd,
      companionPrompt: ui.companionPrompt,
      coverageScore: ui.coverage,
      coverageColors: sc?.colors ?? null,
      coverageTypography: sc?.typography ?? null,
      coverageLayout: sc?.spacing ?? null,
      coverageElevation: sc?.elevation ?? null,
      coverageShapes: sc?.shapes ?? null,
      coverageComponents: sc?.components ?? null,
      coverageDosDonts: sc?.dosDonts ?? null,
      primaryCategoryId: categoryId,
      designStyle: designStyles,
      compatibleTools: tools,
      status: 'published' as const,
      isCurated: true,
      isFeatured: ui.voteRate >= 95,
      createdBy: systemUserId,
      sourceUrl: `https://${ui.url}`,
      sourceDomain: ui.url,
      authorName: ui.maintainer,
      license: ui.license,
      paletteColors: ui.palette,
      brandInitial: ui.name.charAt(0).toUpperCase(),
      brandColor: ui.palette[0] ?? null,
      voteCount: ui.voteCount,
      positiveVoteCount: Math.round((ui.voteCount * ui.voteRate) / 100),
      positiveVoteRate: ui.voteRate.toFixed(2),
      verifiedAt: sql`now()`,
      submittedAt: sql`now()`,
      reviewedBy: systemUserId,
      reviewedAt: sql`now()`,
      publishedAt: sql`now()`,
    };

    const [row] = await db
      .insert(bundles)
      .values(values)
      .onConflictDoUpdate({
        target: bundles.slug,
        set: {
          title: values.title,
          description: values.description,
          designMd: values.designMd,
          companionPrompt: values.companionPrompt,
          coverageScore: values.coverageScore,
          coverageColors: values.coverageColors,
          coverageTypography: values.coverageTypography,
          coverageLayout: values.coverageLayout,
          coverageElevation: values.coverageElevation,
          coverageShapes: values.coverageShapes,
          coverageComponents: values.coverageComponents,
          coverageDosDonts: values.coverageDosDonts,
          primaryCategoryId: values.primaryCategoryId,
          designStyle: values.designStyle,
          compatibleTools: values.compatibleTools,
          isFeatured: values.isFeatured,
          paletteColors: values.paletteColors,
          brandColor: values.brandColor,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: bundles.id, createdAt: bundles.createdAt, updatedAt: bundles.updatedAt });

    if (!row) continue;
    const created = +row.createdAt;
    const updatedAt = +row.updatedAt;
    if (Math.abs(updatedAt - created) < 1500) inserted++;
    else updated++;
  }

  console.log(`[seed] bundles → inserted: ${inserted}, updated: ${updated}`);
  console.log('[seed] done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
