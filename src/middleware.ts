/**
 * Edge middleware — light gate that redirects unauthenticated users away
 * from app-only pages. Cookie verification still happens server-side
 * inside `getCurrentUser()`; this layer is just a UX fast-path.
 */
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/account', '/welcome', '/admin', '/submit', '/dashboard'];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const requiresAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (!requiresAuth) return NextResponse.next();

  const session = req.cookies.get('__session')?.value;
  if (session) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?returnTo=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Match everything except static assets and API routes.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
