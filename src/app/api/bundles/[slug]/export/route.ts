/**
 * GET /api/bundles/[slug]/export?format=tailwind-v3|tailwind-v4|dtcg
 *
 * Transforms a published bundle's design.md into the requested framework
 * format using the official @google/design.md emitters where available;
 * we emit Tailwind v4 CSS ourselves (the library ships only the v3 + DTCG
 * emitters publicly).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { bundles } from '@/lib/db/schema';
import { rateLimitByIp, tooManyRequests } from '@/lib/rate-limit/by-ip';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const QuerySchema = z.object({
  format: z.enum(['tailwind-v3', 'tailwind-v4', 'dtcg']),
});

export async function GET(req: NextRequest, ctx: RouteContext) {
  const rl = await rateLimitByIp(req, { limit: 20, window: '1 m', prefix: 'rl:export' });
  if (!rl.ok) return tooManyRequests(rl);

  const { slug } = await ctx.params;
  if (!slug || slug.length > 200) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }

  const parsed = QuerySchema.safeParse({
    format: req.nextUrl.searchParams.get('format') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid format', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [bundle] = await db
    .select({
      slug: bundles.slug,
      designMd: bundles.designMd,
      status: bundles.status,
    })
    .from(bundles)
    .where(and(eq(bundles.slug, slug), eq(bundles.status, 'published')))
    .limit(1);

  if (!bundle || !bundle.designMd) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Lint to get the resolved DesignSystemState + tailwindConfig.
  const mod = await import('@google/design.md/linter');
  const { lint, DtcgEmitterHandler } = mod as unknown as {
    lint: (c: string) => {
      designSystem: import('@google/design.md/linter').DesignSystemState;
      tailwindConfig: import('@google/design.md/linter').TailwindEmitterResult;
    };
    DtcgEmitterHandler: new () => {
      execute: (
        state: import('@google/design.md/linter').DesignSystemState,
      ) => { success: boolean; data?: unknown };
    };
  };

  const report = lint(bundle.designMd);

  const cacheHeaders = { 'cache-control': 'public, max-age=600, s-maxage=3600' };

  if (parsed.data.format === 'tailwind-v3') {
    if (!report.tailwindConfig.success) {
      return NextResponse.json(
        { error: 'Tailwind emitter failed' },
        { status: 500 },
      );
    }
    return NextResponse.json(report.tailwindConfig.data, { headers: cacheHeaders });
  }

  if (parsed.data.format === 'dtcg') {
    const h = new DtcgEmitterHandler();
    const out = h.execute(report.designSystem);
    if (!out.success) {
      return NextResponse.json({ error: 'DTCG emitter failed' }, { status: 500 });
    }
    return NextResponse.json(out.data, { headers: cacheHeaders });
  }

  // tailwind-v4: emit our own @theme CSS block from the resolved tokens.
  const css = emitTailwindV4Css(report.designSystem);
  return new NextResponse(css, {
    headers: {
      ...cacheHeaders,
      'content-type': 'text/css; charset=utf-8',
    },
  });
}

// ─── Tailwind v4 @theme emitter ─────────────────────────────
// Spec: https://tailwindcss.com/docs/upgrade-guide#using-css-variables
// Namespaces: --color-*, --font-*, --text-*, --leading-*, --tracking-*,
// --font-weight-*, --radius-*, --spacing-*.

function emitTailwindV4Css(
  state: import('@google/design.md/linter').DesignSystemState,
): string {
  const lines: string[] = ['@theme {'];

  for (const [name, color] of state.colors) {
    lines.push(`  --color-${cssSafe(name)}: ${color.hex.toUpperCase()};`);
  }

  // Typography: split into font-family / text / leading / tracking / font-weight.
  for (const [name, t] of state.typography) {
    if (t.fontFamily) lines.push(`  --font-${cssSafe(name)}: ${quoteIfNeeded(t.fontFamily)};`);
    if (t.fontSize) lines.push(`  --text-${cssSafe(name)}: ${dimToCss(t.fontSize)};`);
    if (t.lineHeight)
      lines.push(`  --leading-${cssSafe(name)}: ${dimToCss(t.lineHeight)};`);
    if (t.letterSpacing)
      lines.push(`  --tracking-${cssSafe(name)}: ${dimToCss(t.letterSpacing)};`);
    if (t.fontWeight !== undefined)
      lines.push(`  --font-weight-${cssSafe(name)}: ${t.fontWeight};`);
  }

  for (const [name, r] of state.rounded) {
    lines.push(`  --radius-${cssSafe(name)}: ${dimToCss(r)};`);
  }

  for (const [name, s] of state.spacing) {
    lines.push(`  --spacing-${cssSafe(name)}: ${dimToCss(s)};`);
  }

  lines.push('}');
  return lines.join('\n') + '\n';
}

function cssSafe(name: string): string {
  return name.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

function quoteIfNeeded(family: string): string {
  return /^[a-zA-Z][a-zA-Z0-9\s\-]*$/.test(family) && family.includes(' ')
    ? `"${family}"`
    : family;
}

function dimToCss(d: import('@google/design.md/linter').ResolvedDimension): string {
  return `${d.value}${d.unit}`;
}
