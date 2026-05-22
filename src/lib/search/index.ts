/**
 * In-memory Orama search index for published bundles.
 *
 * The index is built lazily on first request and cached for 5 minutes.
 * Invalidated explicitly whenever a bundle's status changes (publish /
 * archive / restore / reject / delete).
 *
 * Concurrent cold-start requests share a single build promise so we
 * don't kick off parallel DB fetches.
 */
import { create, insertMultiple, search, type AnyOrama } from '@orama/orama';
import { listPublishedForIndex } from '@/lib/db/queries/bundles';

const TTL_MS = 5 * 60_000;

interface IndexCache {
  idx: AnyOrama;
  builtAt: number;
}

let cache: IndexCache | null = null;
let buildPromise: Promise<IndexCache> | null = null;

async function buildIndex(): Promise<IndexCache> {
  const bundles = await listPublishedForIndex();

  const idx = await create({
    schema: {
      id: 'string',
      slug: 'string',
      title: 'string',
      description: 'string',
      body: 'string',
      tools: 'string[]',
      category: 'string',
    },
  });

  await insertMultiple(
    idx,
    bundles.map((b) => ({
      id: b.id,
      slug: b.slug,
      title: b.title ?? '',
      description: b.description ?? '',
      body: b.designMd ?? '',
      tools: b.compatibleTools ?? [],
      category: b.primaryCategoryName ?? '',
    })),
  );

  return { idx, builtAt: Date.now() };
}

async function getIndex(): Promise<IndexCache> {
  if (cache && Date.now() - cache.builtAt < TTL_MS) return cache;

  if (!buildPromise) {
    buildPromise = buildIndex()
      .then((c) => {
        cache = c;
        buildPromise = null;
        return c;
      })
      .catch((err) => {
        buildPromise = null;
        throw err;
      });
  }

  return buildPromise;
}

export function invalidateSearchIndex(): void {
  cache = null;
  buildPromise = null;
}

export interface SearchHit {
  slug: string;
  title: string;
  description: string;
  score: number;
}

export async function searchBundles(q: string): Promise<SearchHit[]> {
  const { idx } = await getIndex();

  const results = await search(idx, {
    term: q,
    properties: ['title', 'description', 'body', 'tools', 'category'],
    limit: 30,
    tolerance: 1,
    boost: { title: 3, category: 2, tools: 1.5 },
  });

  type Doc = { slug: string; title: string; description: string };
  return results.hits.map((h) => {
    const doc = h.document as unknown as Doc;
    return { slug: doc.slug, title: doc.title, description: doc.description, score: h.score };
  });
}
