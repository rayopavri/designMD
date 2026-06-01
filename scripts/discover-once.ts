/**
 * One-shot discovery fetch for eyeballing (P2-1).
 *
 *   pnpm tsx scripts/discover-once.ts [source] [limit]
 *
 * Runs the fetch + pre-guardrail directly (no QStash, no worker) against the
 * DATABASE_URL in .env.local, then prints what was inserted and what the
 * guardrail rejected. Inserts real `unclassified` rows — they're quarantined in
 * discovery_candidates (nothing reads them yet) and safe to delete.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import {
  DISCOVERY_SOURCES,
  runDiscoverFetch,
  type DiscoverySource,
} from '../src/lib/discovery/run-fetch';
import { listCandidatesByStatus } from '../src/lib/db/queries/discovery';

async function main(): Promise<void> {
  const source = (process.argv[2] ?? 'hackernews') as DiscoverySource;
  const limit = Number.parseInt(process.argv[3] ?? '30', 10);

  if (!DISCOVERY_SOURCES.includes(source)) {
    throw new Error(`Unknown source "${source}". Known: ${DISCOVERY_SOURCES.join(', ')}`);
  }

  console.log(`\n▶ discover-once: source=${source} limit=${limit}\n`);
  const summary = await runDiscoverFetch({ source, limit });

  console.log('── summary ──');
  console.table({
    fetched: summary.fetched,
    inserted: summary.inserted,
    rejected: summary.rejected,
    duplicates: summary.duplicates,
  });

  if (summary.rejections.length > 0) {
    console.log('\n── guardrail rejections ──');
    for (const r of summary.rejections) {
      console.log(`  ✗ ${r.reason.padEnd(20)} ${r.url}`);
    }
  }

  const show = summary.inserted > 0 ? summary.inserted : 20;
  const rows = await listCandidatesByStatus('unclassified', show);
  console.log(`\n── unclassified candidates (latest ${rows.length}) ──`);
  for (const c of rows) {
    let title = '';
    try {
      title = (JSON.parse(c.rawContent ?? '{}').title as string) ?? '';
    } catch {
      /* rawContent may be absent for non-HN sources */
    }
    console.log(`  • ${c.sourceUrl}`);
    if (title) console.log(`    "${title}"  (@${c.authorHandle ?? '?'})`);
  }

  console.log('\n✔ done\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('discover-once failed:', err);
  process.exit(1);
});
