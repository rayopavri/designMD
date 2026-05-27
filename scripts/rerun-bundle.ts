/**
 * Re-run the generation pipeline for an existing bundle, optionally pointing
 * at a different source URL. Mirrors what
 * `POST /api/admin/bundles/[slug]/rerun-pipeline` does, but lets you supply a
 * new URL — useful when the original source (e.g. a login wall) produced a
 * bad extraction.
 *
 * Usage:
 *   pnpm tsx scripts/rerun-bundle.ts <slug> [newUrl]
 *
 * Examples:
 *   pnpm tsx scripts/rerun-bundle.ts claude https://claude.com
 *   pnpm tsx scripts/rerun-bundle.ts vercel-3   # re-scrape existing sourceUrl
 *
 * Requires .env.local with DATABASE_URL, QSTASH_TOKEN (or INLINE_TASKS=true),
 * NEXT_PUBLIC_APP_URL, INTERNAL_TASK_TOKEN.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

async function main() {
  const slug = process.argv[2];
  const overrideUrl = process.argv[3];
  if (!slug) {
    console.error('Usage: pnpm tsx scripts/rerun-bundle.ts <slug> [newUrl]');
    process.exit(1);
  }

  const { db } = await import('../src/lib/db/client');
  const { bundles, generationJobs, users } = await import('../src/lib/db/schema');
  const { eq, and, inArray, sql } = await import('drizzle-orm');
  const { normalizeUrl } = await import('../src/lib/generator/url');
  const { enqueueTask } = await import('../src/lib/queue');

  const [bundle] = await db
    .select({
      id: bundles.id,
      slug: bundles.slug,
      sourceUrl: bundles.sourceUrl,
      brandColor: bundles.brandColor,
      paletteColors: bundles.paletteColors,
    })
    .from(bundles)
    .where(eq(bundles.slug, slug))
    .limit(1);

  if (!bundle) {
    console.error(`No bundle with slug "${slug}".`);
    const candidates = await db
      .select({ slug: bundles.slug, sourceUrl: bundles.sourceUrl })
      .from(bundles)
      .where(sql`${bundles.slug} ILIKE ${`%${slug}%`}`)
      .limit(10);
    if (candidates.length > 0) {
      console.error(`\nClose matches in this database:`);
      for (const c of candidates) {
        console.error(`  ${c.slug.padEnd(40)}  ${c.sourceUrl ?? ''}`);
      }
      console.error(`\nIf the slug you want is in the list, re-run with that exact slug.`);
    } else {
      const dbUrl = process.env.DATABASE_URL ?? '';
      let host = '<DATABASE_URL not set>';
      try {
        host = new URL(dbUrl).host;
      } catch {
        /* ignore */
      }
      const totalRows = await db.select({ c: sql<number>`count(*)::int` }).from(bundles);
      console.error(
        `\nNo bundles matching "%${slug}%" either. Total bundles in this database: ${totalRows[0]?.c ?? 0}.`,
      );
      console.error(`Connected to: ${host}`);
      console.error(
        `If that's not the production Supabase host, update .env.local DATABASE_URL.`,
      );
    }
    process.exit(1);
  }

  const url = overrideUrl ?? bundle.sourceUrl;
  if (!url || url.startsWith('upload://')) {
    console.error(
      `Bundle "${slug}" has no scrapable sourceUrl and no override was supplied.`,
    );
    process.exit(1);
  }

  const [inFlight] = await db
    .select({ id: generationJobs.id })
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.targetBundleId, bundle.id),
        inArray(generationJobs.status, ['queued', 'running']),
      ),
    )
    .limit(1);

  if (inFlight) {
    console.error(`Re-run already in flight for this bundle (job ${inFlight.id})`);
    process.exit(1);
  }

  const [editor] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.isEditor, true))
    .limit(1);

  if (!editor) {
    console.error('No editor user found — set isEditor=true on a user first.');
    process.exit(1);
  }

  const normalizedUrl = normalizeUrl(url);

  console.log(`Re-running bundle "${slug}" (${bundle.id})`);
  console.log(`  Old source : ${bundle.sourceUrl}`);
  console.log(`  New source : ${url}`);
  console.log(`  Normalized : ${normalizedUrl}`);
  console.log(`  Old palette: ${JSON.stringify(bundle.paletteColors)}`);
  console.log(`  Editor     : ${editor.email}`);

  const [job] = await db
    .insert(generationJobs)
    .values({
      url,
      normalizedUrl,
      sourceType: 'url',
      status: 'queued',
      userId: editor.id,
      targetBundleId: bundle.id,
      autoPublish: false,
    })
    .returning({ id: generationJobs.id });

  if (!job) {
    console.error('Failed to insert generation job');
    process.exit(1);
  }

  const result = await enqueueTask('scrape-and-extract', { jobId: job.id });
  console.log(`Enqueued job ${job.id} (inline=${result.inline}). Worker will UPDATE the existing bundle in place.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
