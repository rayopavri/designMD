import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

const BG = '#0A0A0B';
const INK = '#F2F1EE';
const SUB = '#8E8E94';
const MUTED = '#5F5F66';
const DARK_FILL = '#1A1A20';

function contrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? BG : INK;
}

export function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;

  const title = p.get('t') ?? 'Design System';
  const colorsRaw = p.get('c') ?? '';
  const initial = (p.get('i') ?? title[0] ?? '?').toUpperCase().slice(0, 1);
  const brandHex = p.get('b') ?? '8B7BFF';
  const category = p.get('cat') ?? '';

  const palette = colorsRaw
    .split(',')
    .filter(Boolean)
    .map(c => `#${c}`)
    .slice(0, 6);

  while (palette.length < 4) palette.push(DARK_FILL);

  const brandColor = `#${brandHex}`;
  const textOnBrand = contrastColor(brandColor);

  const rows: [string, string | undefined][] = [];
  for (let i = 0; i < palette.length; i += 2) {
    rows.push([palette[i], palette[i + 1]]);
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '1200px',
          height: '630px',
          background: BG,
          overflow: 'hidden',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
        }}
      >
        {/* Left — text */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '580px',
            padding: '60px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Brand avatar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: brandColor,
                color: textOnBrand,
                fontSize: '30px',
                fontWeight: 700,
                marginBottom: '36px',
              }}
            >
              {initial}
            </div>

            {/* Brand name */}
            <div
              style={{
                display: 'flex',
                fontSize: '64px',
                fontWeight: 700,
                color: INK,
                lineHeight: 1.0,
                letterSpacing: '-1.5px',
                marginBottom: '10px',
              }}
            >
              {title}
            </div>

            {/* "Design System" label */}
            <div
              style={{
                display: 'flex',
                fontSize: '28px',
                fontWeight: 400,
                color: SUB,
                marginBottom: category ? '10px' : '0',
              }}
            >
              Design System
            </div>

            {/* Category */}
            {category ? (
              <div
                style={{
                  display: 'flex',
                  fontSize: '20px',
                  color: MUTED,
                }}
              >
                {category}
              </div>
            ) : null}
          </div>

          {/* Site URL */}
          <div style={{ display: 'flex', fontSize: '18px', color: MUTED }}>
            uiuxskills.com
          </div>
        </div>

        {/* Right — palette swatches */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            padding: '40px 40px 40px 0',
            gap: '10px',
          }}
        >
          {rows.map(([a, b], ri) => (
            <div
              key={ri}
              style={{ display: 'flex', flex: 1, gap: '10px' }}
            >
              <div
                style={{
                  flex: 1,
                  background: a,
                  borderRadius: '16px',
                }}
              />
              {b ? (
                <div
                  style={{
                    flex: 1,
                    background: b,
                    borderRadius: '16px',
                  }}
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
