/**
 * Structured timing logs for the generation pipeline.
 *
 * Every expensive call in the scrape → extract → author → companion chain
 * emits one greppable line so a single production generation can be
 * reconstructed from Vercel logs without a debugger or DB access:
 *
 *   [perf] scrape.primary ok 8120ms
 *   [perf] scrape.map ok 3400ms links=12
 *   [perf] extract.gemini ok 9100ms cacheMs=210 cached=true prompt=5400 thoughts=0 output=1800
 *   [perf] author.gemini ok 11240ms cacheMs=80 cached=true prompt=4200 thoughts=1850 output=2030
 *   [perf] companion.sonnet ok 14880ms in=3900 out=410 cacheRead=3712 cacheWrite=0
 *   [perf] companion.hydrate skip 12ms reason=payload-consumed-or-malformed
 *   [perf] worker.author done 64200ms jobId=...
 *
 * Why this exists: the author (Gemini, 240s abort) and companion (Sonnet, 90s ×
 * retries) steps were observed timing out, and we can't reproduce locally
 * (Vercel keeps the keys Sensitive). A 240s author "timeout" surfaces here as
 * `author.gemini err 240000ms thoughts=...`, which separates a genuinely slow
 * generation (high thoughts/output tokens) from a fast failure (auth / quota /
 * cold-start hang before first byte) and from the silent companion payload-race
 * (`companion.hydrate skip`, where the author cleared phase_payload first).
 *
 * Grep `[perf]` in Vercel logs — or `[perf] author` / `[perf] companion` to
 * isolate the two stages under suspicion. The gap between a worker total and
 * its inner AI-call time is cold-start + QStash + DB overhead.
 */

/** Call outcome. `done` = a worker returned (may have failed an inner stage);
 *  `watchdog` = the worker was aborted by its own watchdog before cleanup. */
type PerfOutcome = 'ok' | 'err' | 'skip' | 'done' | 'watchdog';

type PerfFields = Record<string, string | number | boolean | null | undefined>;

/**
 * Emit one structured timing line. `undefined`/`null` fields are dropped so
 * the output stays compact when token usage isn't available.
 */
export function perf(stage: string, outcome: PerfOutcome, ms: number, fields?: PerfFields): void {
  let extra = '';
  if (fields) {
    extra = Object.entries(fields)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
  }
  // console.log is the established observability channel in this pipeline
  // (see the pre-existing `[generate-design-md]` / `[firecrawl]` lines) and
  // is what Vercel captures into function logs.
  console.log(`[perf] ${stage} ${outcome} ${ms}ms${extra ? ` ${extra}` : ''}`);
}
