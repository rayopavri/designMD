import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  safeDiagnosticErrorDetail,
  safeDiagnosticUrl,
  safePerfDiagnosticValue,
} from './diagnostics';

describe('diagnostic redaction', () => {
  const credentialBearingUrl =
    'https://firecrawl-user:firecrawl-secret@private.example.test:8443/page?token=query-token#fragment';
  const providerPayload =
    'prompt=private system prompt authorization=Bearer provider-token request=https://api.example.test/v1';

  it('keeps only an allowlisted error type from provider failures', () => {
    const detail = safeDiagnosticErrorDetail(new TypeError(`${providerPayload} ${credentialBearingUrl}`));

    assert.equal(detail, 'diagnostic_error type=TypeError');
    assert.doesNotMatch(detail, /prompt|authorization|token|secret|private\.example|api\.example/i);
  });

  it('reduces URLs to their origin and rejects malformed values', () => {
    assert.equal(safeDiagnosticUrl(credentialBearingUrl), 'https://private.example.test:8443');
    assert.equal(safeDiagnosticUrl('https://example.test/line\nbreak'), 'invalid-url');
    assert.equal(safeDiagnosticUrl('not a URL'), 'invalid-url');
  });

  it('keeps perf error fields allowlisted and prevents log-line injection', () => {
    assert.equal(
      safePerfDiagnosticValue('error', `${providerPayload}\nforged=value`),
      'diagnostic_error type=non_error_throw',
    );
    assert.equal(safePerfDiagnosticValue('reason', 'payload\nforged=value'), 'payload forged=value');
  });

  it('removes C1 controls and Unicode line separators from diagnostic fields', () => {
    assert.equal(
      safePerfDiagnosticValue('reason', 'payload\u0085forged=one\u2028forged=two\u2029forged=three'),
      'payload forged=one forged=two forged=three',
    );
    const unsafeUrl = 'https://example.test/path\u0085forged';
    assert.equal(safeDiagnosticUrl(unsafeUrl), 'invalid-url');
    assert.equal(safeDiagnosticUrl(unsafeUrl), 'invalid-url');
  });
});
