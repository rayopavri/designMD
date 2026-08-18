import assert from 'node:assert/strict';
import { it } from 'node:test';
import { perf } from './perf-log';

it('normalizes dynamic perf stages so controls cannot forge a log line', () => {
  const originalLog = console.log;
  const lines: string[] = [];
  console.log = (...values: unknown[]) => lines.push(values.map(String).join(' '));

  try {
    perf('worker\u0085forged\u2028stage', 'err', 12, { reason: 'safe' });
  } finally {
    console.log = originalLog;
  }

  assert.deepEqual(lines, ['[perf] worker_forged_stage err 12ms reason=safe']);
});
