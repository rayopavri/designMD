import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readJsonBodyWithinLimit, requestExceedsContentLength } from './request-body';

describe('request body limits', () => {
  it('rejects a multipart request above the declared envelope before it is read', () => {
    const req = new Request('https://example.com/api/generate', {
      headers: { 'content-length': '6815745' },
    });

    assert.equal(requestExceedsContentLength(req, 6_815_744), true);
  });

  it('does not reject a request at the declared envelope', () => {
    const req = new Request('https://example.com/api/generate', {
      headers: { 'content-length': '6815744' },
    });

    assert.equal(requestExceedsContentLength(req, 6_815_744), false);
  });

  it('stops reading a chunked JSON body that grows beyond the supplied limit', async () => {
    const req = new Request('https://example.com/api/auth/email-link', {
      method: 'POST',
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"email":"'));
          controller.enqueue(new TextEncoder().encode('a'.repeat(100)));
          controller.enqueue(new TextEncoder().encode('"}'));
          controller.close();
        },
      }),
      duplex: 'half',
    } as RequestInit);

    assert.deepEqual(await readJsonBodyWithinLimit(req, 32), { ok: false, error: 'body_too_large' });
  });

  it('reports malformed JSON without exposing the parser error', async () => {
    const req = new Request('https://example.com/api/auth/email-link', {
      method: 'POST',
      body: '{not json',
    });

    assert.deepEqual(await readJsonBodyWithinLimit(req, 1024), { ok: false, error: 'invalid_json' });
  });
});
