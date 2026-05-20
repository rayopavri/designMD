/**
 * Extract the client IP address from a request.
 *
 * Vercel sets `x-forwarded-for` (and `x-real-ip`) on incoming requests.
 * `NextRequest.ip` was removed from the App Router runtime, so we read
 * the headers directly.
 *
 * Returns `'unknown'` if no IP can be determined — callers should
 * decide whether to bucket all unknowns into one rate-limit key (safe
 * default) or skip rate limiting entirely.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    // x-forwarded-for is a comma-separated list; first entry is the
    // original client (the rest are proxies).
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}
