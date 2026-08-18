import assert from 'node:assert/strict';
import { promises as dns } from 'node:dns';
import { afterEach, describe, it, mock } from 'node:test';
import { isBlockedIp, safeFetchHtml } from './safe-fetch';

afterEach(() => {
  mock.restoreAll();
});

function mockDns(addresses: string[]): void {
  mock.method(dns, 'lookup', async () =>
    addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })),
  );
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
      'fe80::1',
      'fd00::1',
      '2001:db8::1',
      'ff00::1',
    ]) {
      assert.equal(isBlockedIp(ip), true, ip);
    }
  });

  it('allows public addresses', () => {
    assert.equal(isBlockedIp('93.184.216.34'), false);
    assert.equal(isBlockedIp('198.51.1.1'), false);
    assert.equal(isBlockedIp('2606:2800:220:1:248:1893:25c8:1946'), false);
  });
});

describe('safeFetchHtml', () => {
  it('rejects unsafe schemes before DNS lookup or fetch', async () => {
    const lookup = mock.method(dns, 'lookup', async () => []);
    const request = mock.method(globalThis, 'fetch', async () => new Response('unexpected'));

    assert.equal(await safeFetchHtml('file:///etc/passwd'), null);
    assert.equal(lookup.mock.calls.length, 0);
    assert.equal(request.mock.calls.length, 0);
  });

  it('does not fetch a hostname when any DNS answer is blocked', async () => {
    mockDns(['93.184.216.34', '127.0.0.1']);
    const request = mock.method(globalThis, 'fetch', async () => new Response('unexpected'));

    assert.equal(await safeFetchHtml('https://example.com'), null);
    assert.equal(request.mock.calls.length, 0);
  });

  it('does not fetch when the overall deadline is already exhausted', async () => {
    const lookup = mock.method(dns, 'lookup', async () => []);
    const request = mock.method(globalThis, 'fetch', async () => new Response('unexpected'));

    assert.equal(await safeFetchHtml('https://example.com', { deadlineMs: 0 }), null);
    assert.equal(lookup.mock.calls.length, 0);
    assert.equal(request.mock.calls.length, 0);
  });

  it('returns null when DNS does not resolve within the overall deadline', async () => {
    mock.method(dns, 'lookup', async () => new Promise<never>(() => {}));
    const request = mock.method(globalThis, 'fetch', async () => new Response('unexpected'));

    const result = await Promise.race([
      safeFetchHtml('https://example.com', { deadlineMs: 5 }),
      new Promise<'test timeout'>((resolve) => setTimeout(() => resolve('test timeout'), 100)),
    ]);

    assert.equal(result, null);
    assert.equal(request.mock.calls.length, 0);
  });

  it('revalidates redirect destinations before fetching them', async () => {
    mockDns(['93.184.216.34']);
    const seen: string[] = [];
    mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0]) => {
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
    mock.method(globalThis, 'fetch', async () => {
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
    mock.method(globalThis, 'fetch', async () => {
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
    mock.method(
      globalThis,
      'fetch',
      async () =>
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
    mock.method(
      globalThis,
      'fetch',
      async (
        _input: Parameters<typeof fetch>[0],
        init: Parameters<typeof fetch>[1],
      ) =>
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
