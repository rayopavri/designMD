import assert from 'node:assert/strict';
import { promises as dns } from 'node:dns';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, describe, it, mock } from 'node:test';
import { createSecureContext } from 'node:tls';
import { createPinnedDispatcher, isBlockedIp, safeFetchHtml, safeFetchImage } from './safe-fetch';

const require = createRequire(import.meta.url);
const undici = require('undici') as typeof import('undici');
type TestFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

afterEach(() => {
  mock.restoreAll();
});

function mockDns(addresses: string[]): void {
  mock.method(dns, 'lookup', async () =>
    addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })),
  );
}

function mockUndiciFetch(implementation: TestFetch) {
  mock.method(globalThis, 'fetch', async () => {
    throw new Error('safeFetchHtml must not use the unpinned global fetch');
  });
  return mock.method(undici, 'fetch', implementation as unknown as typeof undici.fetch);
}

describe('isBlockedIp', () => {
  it('blocks private, loopback, link-local, carrier-grade NAT, and reserved IPv4 ranges', () => {
    for (const ip of [
      '0.0.0.0',
      '10.0.0.1',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.169.254',
      '172.16.0.1',
      '192.168.1.1',
      '192.0.0.11',
      '192.0.2.1',
      '198.18.0.1',
      '198.51.100.1',
      '203.0.113.1',
      '224.0.0.1',
      '240.0.0.1',
    ]) {
      assert.equal(isBlockedIp(ip), true, ip);
    }
  });

  it('blocks loopback, link-local, ULA, documentation, multicast, and IPv4-mapped IPv6 ranges', () => {
    for (const ip of [
      '::',
      '::1',
      '::ffff:127.0.0.1',
      '::ffff:0:192.168.0.1',
      '64:ff9b::c0a8:1',
      '64:ff9b:1::c0a8:1',
      '2002:c0a8:0101::1',
      'fe80::1',
      'fec0::1',
      'fd00::1',
      '100::1',
      '100:0:0:1::1',
      '2001::1',
      '2001:1::4',
      '2001:2::1',
      '2001:10::1',
      '2001:db8::1',
      '3fff::1',
      '5f00::1',
      'ff00::1',
    ]) {
      assert.equal(isBlockedIp(ip), true, ip);
    }
  });

  it('blocks the entire local-use IPv4/IPv6 translation prefix', () => {
    for (const ip of [
      '64:ff9b:1::5db8:d822',
      '64:ff9b:1:0:c0:a801:100:0',
    ]) {
      assert.equal(isBlockedIp(ip), true, ip);
    }
  });

  it('allows public addresses', () => {
    for (const ip of [
      '93.184.216.34',
      '192.0.0.9',
      '192.0.0.10',
      '198.51.1.1',
      '2606:2800:220:1:248:1893:25c8:1946',
      '64:ff9b::5db8:d822',
      '2002:5db8:d822::1',
      '2001:1::1',
      '2001:3::1',
      '2001:4:112::1',
      '2001:20::1',
      '2001:30::1',
      '2620:4f:8000::1',
    ]) {
      assert.equal(isBlockedIp(ip), false, ip);
    }
  });
});

describe('safeFetchHtml', () => {
  it('pins a dispatcher connection while preserving the requested host header', async () => {
    const server = createServer((req, res) => res.end(req.headers.host));
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const listening = server.address();
    assert.ok(listening && typeof listening !== 'string');
    if (!listening || typeof listening === 'string') return;

    const dispatcher = createPinnedDispatcher([{ address: '127.0.0.1', family: 4 }]);
    try {
      const response = await undici.fetch(`http://unresolvable.test:${listening.port}/`, {
        dispatcher,
        headers: { host: `unresolvable.test:${listening.port}` },
      });
      assert.equal(await response.text(), `unresolvable.test:${listening.port}`);
    } finally {
      await dispatcher.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('pins TLS to the validated address while preserving original URL SNI', async () => {
    const fixtures = path.join(process.cwd(), 'src/lib/security/fixtures');
    const [key, cert] = await Promise.all([
      readFile(path.join(fixtures, 'origin.test-key.txt')),
      readFile(path.join(fixtures, 'origin.test-cert.txt')),
    ]);
    const context = createSecureContext({ key, cert });
    let observedServername: string | undefined;
    const server = createHttpsServer({
      key,
      cert,
      SNICallback(servername, callback) {
        observedServername = servername;
        callback(null, context);
      },
    }, (req, res) => res.end(req.headers.host));
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const listening = server.address();
    assert.ok(listening && typeof listening !== 'string');
    if (!listening || typeof listening === 'string') return;

    const dispatcher = createPinnedDispatcher(
      [{ address: '127.0.0.1', family: 4 }],
      { ca: cert },
    );
    try {
      const response = await undici.fetch(`https://origin.test:${listening.port}/`, {
        dispatcher,
        headers: { host: `origin.test:${listening.port}` },
      });
      assert.equal(await response.text(), `origin.test:${listening.port}`);
      assert.equal(observedServername, 'origin.test');
    } finally {
      await dispatcher.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('rejects unsafe schemes before DNS lookup or fetch', async () => {
    const lookup = mock.method(dns, 'lookup', async () => []);
    const request = mockUndiciFetch(async () => new Response('unexpected'));

    assert.equal(await safeFetchHtml('file:///etc/passwd'), null);
    assert.equal(lookup.mock.calls.length, 0);
    assert.equal(request.mock.calls.length, 0);
  });

  it('rejects URL userinfo before fetch', async () => {
    mockDns(['93.184.216.34']);
    const request = mockUndiciFetch(async () => new Response('unexpected'));

    assert.equal(await safeFetchHtml('https://user:password@example.com'), null);
    assert.equal(request.mock.calls.length, 0);
  });

  it('does not fetch a hostname when any DNS answer is blocked', async () => {
    mockDns(['93.184.216.34', '127.0.0.1']);
    const request = mockUndiciFetch(async () => new Response('unexpected'));

    assert.equal(await safeFetchHtml('https://example.com'), null);
    assert.equal(request.mock.calls.length, 0);
  });

  it('does not fetch when the overall deadline is already exhausted', async () => {
    const lookup = mock.method(dns, 'lookup', async () => []);
    const request = mockUndiciFetch(async () => new Response('unexpected'));

    assert.equal(await safeFetchHtml('https://example.com', { deadlineMs: 0 }), null);
    assert.equal(lookup.mock.calls.length, 0);
    assert.equal(request.mock.calls.length, 0);
  });

  it('returns null when DNS does not resolve within the overall deadline', async () => {
    mock.method(dns, 'lookup', async () => new Promise<never>(() => {}));
    const request = mockUndiciFetch(async () => new Response('unexpected'));

    const result = await Promise.race([
      safeFetchHtml('https://example.com', { deadlineMs: 5 }),
      new Promise<'test timeout'>((resolve) => setTimeout(() => resolve('test timeout'), 100)),
    ]);

    assert.equal(result, null);
    assert.equal(request.mock.calls.length, 0);
  });

  it('uses a dispatcher when fetching a validated hostname', async () => {
    mockDns(['93.184.216.34']);
    let dispatcher: unknown;
    mockUndiciFetch(async (_input, init) => {
      dispatcher = (init as (RequestInit & { dispatcher?: unknown }) | undefined)?.dispatcher;
      return new Response('<title>Example</title>', {
        headers: { 'content-type': 'text/html' },
      });
    });

    assert.equal(await safeFetchHtml('https://example.com'), '<title>Example</title>');
    assert.ok(dispatcher instanceof undici.Agent);
  });

  it('cancels a redirect body before following its location', async () => {
    mockDns(['93.184.216.34']);
    let cancelled = false;
    let requestNumber = 0;
    mockUndiciFetch(async () => {
      requestNumber += 1;
      if (requestNumber === 1) {
        return new Response(
          new ReadableStream({
            cancel() {
              cancelled = true;
            },
          }),
          { status: 302, headers: { location: '/next' } },
        );
      }
      assert.equal(cancelled, true);
      return new Response('<title>Example</title>', {
        headers: { 'content-type': 'text/html' },
      });
    });

    assert.equal(await safeFetchHtml('https://example.com'), '<title>Example</title>');
    assert.equal(cancelled, true);
  });

  it('copies capped bytes before cancelling the source stream', async () => {
    mockDns(['93.184.216.34']);
    const source = new TextEncoder().encode('abcdefgh');
    mockUndiciFetch(async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(source);
          },
          cancel() {
            source.fill('z'.charCodeAt(0));
          },
        }),
        { headers: { 'content-type': 'text/html' } },
      ),
    );

    assert.equal(await safeFetchHtml('https://example.com', { maxBytes: 6 }), 'abcdef');
  });

  it('strips sensitive headers after a cross-origin redirect', async () => {
    mockDns(['93.184.216.34']);
    const headersByRequest: Headers[] = [];
    let requestNumber = 0;
    mockUndiciFetch(async (_input, init) => {
      headersByRequest.push(new Headers(init?.headers));
      requestNumber += 1;
      if (requestNumber === 1) {
        return new Response(null, {
          status: 302,
          headers: { location: 'https://other.example/next' },
        });
      }
      return new Response('<title>Example</title>', {
        headers: { 'content-type': 'text/html' },
      });
    });

    assert.equal(
      await safeFetchHtml('https://example.com', {
        headers: {
          authorization: 'Bearer private-token',
          cookie: 'session=private',
          'proxy-authorization': 'Basic private',
          'x-api-key': 'private-key',
          'x-access-token': 'private-access-token',
          'x-request-id': 'safe-to-forward',
        },
      }),
      '<title>Example</title>',
    );
    assert.equal(headersByRequest[0].get('authorization'), 'Bearer private-token');
    assert.equal(headersByRequest[1].get('authorization'), null);
    assert.equal(headersByRequest[1].get('cookie'), null);
    assert.equal(headersByRequest[1].get('proxy-authorization'), null);
    assert.equal(headersByRequest[1].get('x-api-key'), null);
    assert.equal(headersByRequest[1].get('x-access-token'), null);
    assert.equal(headersByRequest[1].get('x-request-id'), 'safe-to-forward');
  });

  it('revalidates redirect destinations before fetching them', async () => {
    mockDns(['93.184.216.34']);
    const seen: string[] = [];
    mockUndiciFetch(async (input) => {
      seen.push(String(input));
      return new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/private' },
      });
    });

    assert.equal(await safeFetchHtml('https://example.com'), null);
    assert.deepEqual(seen, ['https://example.com/']);
  });

  it('returns HTML after a validated public redirect', async () => {
    mockDns(['93.184.216.34']);
    let requestNumber = 0;
    mockUndiciFetch(async () => {
      requestNumber += 1;
      if (requestNumber === 1) {
        return new Response(null, {
          status: 302,
          headers: { location: '/brand' },
        });
      }
      return new Response('<title>Example</title>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    });

    assert.equal(await safeFetchHtml('https://example.com'), '<title>Example</title>');
  });

  it('stops after the configured redirect limit', async () => {
    mockDns(['93.184.216.34']);
    let requestNumber = 0;
    mockUndiciFetch(async () => {
      requestNumber += 1;
      return new Response(null, {
        status: 302,
        headers: { location: `/hop-${requestNumber}` },
      });
    });

    assert.equal(
      await safeFetchHtml('https://example.com', { maxRedirects: 1 }),
      null,
    );
    assert.equal(requestNumber, 2);
  });

  it('returns no more than the configured number of response bytes', async () => {
    mockDns(['93.184.216.34']);
    mockUndiciFetch(async () =>
      new Response('abcdefgh', {
        headers: { 'content-type': 'text/html' },
      }),
    );

    assert.equal(
      await safeFetchHtml('https://example.com', { maxBytes: 6 }),
      'abcdef',
    );
  });

  it('returns null when the per-hop timeout aborts the request', async () => {
    mockDns(['93.184.216.34']);
    mockUndiciFetch(
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );

    assert.equal(
      await safeFetchHtml('https://example.com', { deadlineMs: 50, timeoutMs: 1 }),
      null,
    );
  });
});

describe('safeFetchImage', () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  it('does not fetch a screenshot host when any DNS answer is private', async () => {
    mockDns(['93.184.216.34', '127.0.0.1']);
    const request = mockUndiciFetch(async () => new Response('unexpected'));

    assert.equal(await safeFetchImage('https://screenshots.example.test/capture.png'), null);
    assert.equal(request.mock.calls.length, 0);
  });

  it('revalidates screenshot redirects before fetching their destination', async () => {
    mockDns(['93.184.216.34']);
    const seen: string[] = [];
    mockUndiciFetch(async (input) => {
      seen.push(String(input));
      return new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/private.png' },
      });
    });

    assert.equal(await safeFetchImage('https://screenshots.example.test/capture.png'), null);
    assert.deepEqual(seen, ['https://screenshots.example.test/capture.png']);
  });

  it('uses the pinned dispatcher and returns a signature-validated image', async () => {
    mockDns(['93.184.216.34']);
    let dispatcher: unknown;
    mockUndiciFetch(async (_input, init) => {
      dispatcher = (init as (RequestInit & { dispatcher?: unknown }) | undefined)?.dispatcher;
      return new Response(png, { headers: { 'content-type': 'image/png' } });
    });

    const image = await safeFetchImage('https://screenshots.example.test/capture.png');
    assert.deepEqual(image?.bytes, png);
    assert.equal(image?.mimeType, 'image/png');
    assert.ok(dispatcher instanceof undici.Agent);
  });

  it('rejects a response with a non-image content type or mismatched signature', async () => {
    mockDns(['93.184.216.34']);
    mockUndiciFetch(async () => new Response(png, { headers: { 'content-type': 'text/html' } }));
    assert.equal(await safeFetchImage('https://screenshots.example.test/capture.png'), null);

    mock.restoreAll();
    mockDns(['93.184.216.34']);
    mockUndiciFetch(async () => new Response('<html>not an image</html>', {
      headers: { 'content-type': 'image/png' },
    }));
    assert.equal(await safeFetchImage('https://screenshots.example.test/capture.png'), null);
  });

  it('rejects and cancels a screenshot response that exceeds its hard byte cap', async () => {
    mockDns(['93.184.216.34']);
    let cancelled = false;
    mockUndiciFetch(async () => new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(png);
          controller.enqueue(new Uint8Array([0, 1, 2, 3]));
        },
        cancel() {
          cancelled = true;
        },
      }),
      { headers: { 'content-type': 'image/png' } },
    ));

    assert.equal(
      await safeFetchImage('https://screenshots.example.test/capture.png', { maxBytes: png.byteLength }),
      null,
    );
    assert.equal(cancelled, true);
  });
});
