import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';

const diagnosticSinkFiles = [
  'src/app/api/admin/backfill-screenshots/route.ts',
  'src/app/api/admin/bulk-upload/route.ts',
  'src/app/api/admin/bulk-upload/[batchId]/retry-failed/route.ts',
  'src/app/api/admin/bulk-upload/[batchId]/unstick/route.ts',
  'src/app/api/admin/bundles/[slug]/regenerate-companion/route.ts',
  'src/app/api/admin/bundles/[slug]/rerun-pipeline/route.ts',
  'src/app/api/admin/bundles/[slug]/reject/route.ts',
  'src/app/api/admin/bundles/[slug]/restore/route.ts',
  'src/app/api/admin/bundles/[slug]/route.ts',
  'src/app/api/admin/bundles/bulk-reject/route.ts',
  'src/app/api/admin/categories/route.ts',
  'src/app/api/bundles/[slug]/vote/route.ts',
  'src/app/api/search/route.ts',
  'src/app/auth/callback/page.tsx',
  'src/lib/discovery/guardrail.ts',
  'src/lib/discovery/run-fetch.ts',
  'src/lib/ui-data/mockAuth.ts',
  'scripts/backfill-screenshots.ts',
  'scripts/backfill-companion-prompts.ts',
  'scripts/discover-once.ts',
  'scripts/backfill-elevation.ts',
  'scripts/backfill-section-order.ts',
  'scripts/backfill-bundle-categories.ts',
];

const persistedJobProjectionFiles = [
  'src/app/api/admin/bulk-upload/status/route.ts',
  'src/app/api/admin/bundles/[slug]/job-status/route.ts',
  'src/app/api/admin/bundles/bulk-rerun/status/route.ts',
];

const unsafeSinkPatterns = [
  /(?:details|error):\s*err instanceof Error \? err\.message/,
  /setErrorMessage\(err instanceof Error \? err\.message/,
  /console\.(?:error|warn)\([^\n]*,\s*err\s*\)/,
  /details:\s*msg\b/,
  /errors:\s*message\.slice/,
  /details:\s*\{\s*rawUrl\b/,
];

describe('diagnostic sink policy', () => {
  it('does not expose raw exceptions at admin, public, auth, or discovery sinks', async () => {
    for (const file of diagnosticSinkFiles) {
      const source = await readFile(path.join(process.cwd(), file), 'utf8');
      for (const pattern of unsafeSinkPatterns) {
        assert.doesNotMatch(source, pattern, `${file} contains an unredacted diagnostic sink`);
      }
    }
  });

  it('uses the diagnostic boundary in operational backfill scripts', async () => {
    for (const file of ['scripts/backfill-screenshots.ts', 'scripts/backfill-companion-prompts.ts']) {
      const source = await readFile(path.join(process.cwd(), file), 'utf8');
      assert.match(source, /safeDiagnosticErrorDetail\(err\)/, `${file} must redact provider errors`);
      assert.doesNotMatch(
        source,
        /err instanceof Error \? err\.message : (?:String\(err\)|err)/,
        `${file} must not interpolate a provider error`,
      );
      assert.doesNotMatch(source, /console\.error\([^\n]*,\s*err\)/, `${file} must not log raw errors`);
    }

    const screenshotSource = await readFile(
      path.join(process.cwd(), 'scripts/backfill-screenshots.ts'),
      'utf8',
    );
    assert.match(screenshotSource, /safeDiagnosticUrl\(source_url\)/);
    assert.match(screenshotSource, /safeDiagnosticUrl\(url\)/);
    assert.doesNotMatch(
      screenshotSource,
      /console\.(?:warn|log)\([^\n]*\$\{(?:source_url|url)\}/,
      'screenshot diagnostics must not print raw URLs',
    );
  });

  it('redacts legacy persisted generation errors at every admin projection', async () => {
    for (const file of persistedJobProjectionFiles) {
      const source = await readFile(path.join(process.cwd(), file), 'utf8');
      assert.match(
        source,
        /safePersistedGenerationErrorDetail\([^)]*\.errorMessage\)/,
        `${file} must redact legacy generation_jobs.error_message values`,
      );
    }
  });
});
