import { promises as dns } from 'node:dns';
import net from 'node:net';
import * as undici from 'undici';

const DEFAULT_TIMEOUT_MS = 4_000;
const DEFAULT_DEADLINE_MS = 8_000;
const DEFAULT_MAX_BYTES = 64 * 1024;
const DEFAULT_MAX_REDIRECTS = 4;
const SENSITIVE_REDIRECT_HEADERS = [
  'authorization',
  'cookie',
  'cookie2',
  'proxy-authorization',
  'x-api-key',
  'x-auth-token',
];

type ResolvedAddress = { address: string; family: 4 | 6 };
type FetchResponse = Awaited<ReturnType<typeof undici.fetch>>;

export interface SafeFetchHtmlOptions {
  /** Overall time budget, including DNS, redirects, and body reads. */
  deadlineMs?: number;
  /** Maximum time for any individual request hop. */
  timeoutMs?: number;
  /** Maximum number of response bytes retained in memory. */
  maxBytes?: number;
  /** Maximum number of redirects to follow. */
  maxRedirects?: number;
  headers?: HeadersInit;
  /** `html` preserves strict HTML-only callers; the default keeps metadata probes compatible. */
  contentType?: 'html' | 'html-or-text';
}

/**
 * Fetch a public HTTP(S) document without following redirects automatically.
 * Every redirect target is independently validated and any error degrades to null.
 */
export async function safeFetchHtml(
  initialUrl: string,
  options: SafeFetchHtmlOptions = {},
): Promise<string | null> {
  const deadlineMs = positiveInteger(options.deadlineMs, DEFAULT_DEADLINE_MS);
  const timeoutMs = positiveInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS);
  const maxBytes = positiveInteger(options.maxBytes, DEFAULT_MAX_BYTES);
  const maxRedirects = nonNegativeInteger(options.maxRedirects, DEFAULT_MAX_REDIRECTS);
  if (deadlineMs === null || timeoutMs === null || maxBytes === null || maxRedirects === null) {
    return null;
  }
  const deadline = Date.now() + deadlineMs;
  let current = initialUrl;
  let forwardSensitiveHeaders = true;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    if (Date.now() >= deadline) return null;

    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return null;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    const addresses = await resolveSafeHost(parsed.hostname, deadline);
    if (!addresses) return null;

    const remaining = deadline - Date.now();
    if (remaining <= 0) return null;

    const request = await fetchPinned(
      parsed,
      addresses,
      requestHeaders(options.headers, parsed, forwardSensitiveHeaders),
      AbortSignal.timeout(Math.min(timeoutMs, remaining)),
    );
    if (!request) return null;
    const { response, dispatcher } = request;

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await cancelResponseBody(response);
      await dispatcher.destroy().catch(() => {});
      if (!location) return null;
      try {
        const next = new URL(location, parsed);
        if (next.origin !== parsed.origin) forwardSensitiveHeaders = false;
        current = next.toString();
      } catch {
        return null;
      }
      continue;
    }

    try {
      if (!response.ok || !isAllowedHtmlContentType(response, options.contentType)) return null;
      return await readCapped(response, maxBytes);
    } finally {
      await dispatcher.destroy().catch(() => {});
    }
  }

  return null;
}

async function resolveSafeHost(
  hostname: string,
  deadline: number,
): Promise<ResolvedAddress[] | null> {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return null;
  }

  const family = net.isIP(host);
  if (family === 4 || family === 6) {
    return isBlockedIp(host) ? null : [{ address: host, family }];
  }

  let addresses: ResolvedAddress[];
  try {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return null;
    const resolved = await withTimeout(
      dns.lookup(host, { all: true, verbatim: true }),
      remaining,
    );
    addresses = resolved.flatMap(({ address, family }) =>
      family === 4 || family === 6 ? [{ address, family }] : [],
    );
  } catch {
    return null;
  }
  return addresses.length > 0 && addresses.every(({ address }) => !isBlockedIp(address))
    ? addresses
    : null;
}

/**
 * Builds a short-lived dispatcher that connects only to an address validated
 * for this request. The URL hostname remains intact for Host and TLS SNI.
 */
export function createPinnedDispatcher(
  addresses: readonly ResolvedAddress[],
): undici.Dispatcher {
  const address = addresses[0];
  if (!address) throw new Error('Pinned dispatcher requires an address');
  const connect = undici.buildConnector({});
  return new undici.Agent({
    connect(options, callback) {
      connect({ ...options, hostname: address.address }, callback);
    },
  });
}

async function fetchPinned(
  url: URL,
  addresses: readonly ResolvedAddress[],
  headers: Headers,
  signal: AbortSignal,
): Promise<{ response: FetchResponse; dispatcher: undici.Dispatcher } | null> {
  for (const address of addresses) {
    const dispatcher = createPinnedDispatcher([address]);
    try {
      const response = await undici.fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal,
        headers,
        dispatcher,
      });
      return { response, dispatcher };
    } catch {
      await dispatcher.destroy().catch(() => {});
      if (signal.aborted) return null;
    }
  }
  return null;
}

function requestHeaders(
  source: HeadersInit | undefined,
  url: URL,
  forwardSensitiveHeaders: boolean,
): Headers {
  const headers = new Headers(source);
  if (!forwardSensitiveHeaders) {
    for (const name of [...headers.keys()]) {
      if (isSensitiveRedirectHeader(name)) headers.delete(name);
    }
  }
  headers.set('host', url.host);
  return headers;
}

function isSensitiveRedirectHeader(name: string): boolean {
  return SENSITIVE_REDIRECT_HEADERS.includes(name)
    || /(?:auth|token|secret|credential|api[-_]?key|cookie)/i.test(name);
}

async function cancelResponseBody(response: FetchResponse): Promise<void> {
  await response.body?.cancel().catch(() => {});
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out')), timeoutMs);
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Returns true for IP addresses that must never be reachable via server-side fetches. */
export function isBlockedIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isBlockedIpv4(ip);
  if (family === 6) return isBlockedIpv6(ip);
  return true;
}

function isAllowedHtmlContentType(response: FetchResponse, policy: SafeFetchHtmlOptions['contentType']): boolean {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType) return true;
  if (policy === 'html') return contentType.includes('html');
  return contentType.includes('html') || contentType.includes('text');
}

async function readCapped(response: FetchResponse, maxBytes: number): Promise<string | null> {
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      const remaining = maxBytes - total;
      chunks.push(new Uint8Array(value.subarray(0, remaining)));
      total += Math.min(value.byteLength, remaining);
    }
  } catch {
    return null;
  } finally {
    await reader.cancel().catch(() => {});
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(body);
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 192 && b === 88 && c === 99) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const bytes = ipv6Bytes(ip);
  if (!bytes) return true;
  if (bytes.every((byte) => byte === 0)) return true;
  if (bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1) return true;
  if (bytes[0] === 0xff) return true; // ff00::/8 multicast
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true; // fe80::/10 link-local
  if ((bytes[0] & 0xfe) === 0xfc) return true; // fc00::/7 ULA
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0xc0) return true; // fec0::/10 site-local
  if (bytes[0] === 0 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b && bytes.slice(4, 12).every((byte) => byte === 0)) {
    return true; // 64:ff9b::/96 NAT64
  }
  if (bytes[0] === 0 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b && bytes[4] === 0 && bytes[5] === 1) {
    return true; // 64:ff9b:1::/48 local-use NAT64
  }
  if (bytes[0] === 0x20 && bytes[1] === 0x02) return true; // 2002::/16 6to4
  if (bytes[0] === 0x01 && bytes.slice(1, 8).every((byte) => byte === 0)) return true; // 100::/64 discard-only
  if (bytes[0] === 0x01 && bytes.slice(1, 7).every((byte) => byte === 0) && bytes[7] === 0x01) return true; // 100:0:0:1::/64 dummy prefix
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && (bytes[2] & 0xfe) === 0) return true; // 2001::/23 IETF protocol assignments
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0 && bytes[3] === 0x02 && bytes[4] === 0 && bytes[5] === 0) return true; // 2001:2::/48 benchmarking
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0 && (bytes[3] & 0xf0) === 0x10) return true; // 2001:10::/28 Orchid
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0 && (bytes[3] & 0xf0) === 0x20) return true; // 2001:20::/28 Orchidv2
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) {
    return true; // 2001:db8::/32 documentation
  }
  if (bytes[0] === 0x26 && bytes[1] === 0x20 && bytes[2] === 0 && bytes[3] === 0x4f && bytes[4] === 0x80 && bytes[5] === 0) return true; // 2620:4f:8000::/48 AS112
  if (bytes[0] === 0x3f && bytes[1] === 0xff && (bytes[2] & 0xf0) === 0) return true; // 3fff::/20 documentation
  if (bytes[0] === 0x5f && bytes[1] === 0) return true; // 5f00::/16 SRv6 SIDs

  const isIpv4Mapped = bytes.slice(0, 10).every((byte) => byte === 0)
    && bytes[10] === 0xff
    && bytes[11] === 0xff;
  const isIpv4Compatible = bytes.slice(0, 12).every((byte) => byte === 0);
  const isIpv4Translated = bytes.slice(0, 8).every((byte) => byte === 0)
    && bytes[8] === 0xff
    && bytes[9] === 0xff
    && bytes[10] === 0
    && bytes[11] === 0;
  if (isIpv4Mapped || isIpv4Compatible || isIpv4Translated) {
    return isBlockedIpv4(Array.from(bytes.slice(12)).join('.'));
  }
  return false;
}

function ipv6Bytes(ip: string): Uint8Array | null {
  let value = ip.toLowerCase();
  if (value.includes('.')) {
    const separator = value.lastIndexOf(':');
    const ipv4 = value.slice(separator + 1).split('.').map(Number);
    if (ipv4.length !== 4 || ipv4.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return null;
    }
    value = `${value.slice(0, separator)}:${((ipv4[0] << 8) | ipv4[1]).toString(16)}:${((ipv4[2] << 8) | ipv4[3]).toString(16)}`;
  }

  const sections = value.split('::');
  if (sections.length > 2) return null;
  const left = sections[0] ? sections[0].split(':') : [];
  const right = sections[1] ? sections[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (sections.length === 1 && missing !== 0)) return null;
  const words = [...left, ...Array(missing).fill('0'), ...right];
  if (words.length !== 8 || words.some((word) => !/^[0-9a-f]{1,4}$/.test(word))) return null;

  const bytes = new Uint8Array(16);
  for (let index = 0; index < words.length; index += 1) {
    const word = Number.parseInt(words[index], 16);
    bytes[index * 2] = word >> 8;
    bytes[index * 2 + 1] = word & 0xff;
  }
  return bytes;
}

function positiveInteger(value: number | undefined, fallback: number): number | null {
  if (value === undefined) return fallback;
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function nonNegativeInteger(value: number | undefined, fallback: number): number | null {
  if (value === undefined) return fallback;
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}
