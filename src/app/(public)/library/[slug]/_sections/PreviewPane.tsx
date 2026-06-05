"use client";

import { useState } from "react";
import { BORDER, MONO, MUTED, SURFACE, VIOLET } from "@/lib/ui-data/tokens";
import {
  parseDesignMd,
  isLuminanceDark,
  parsePx,
  type ParsedTokens,
} from "@/lib/ui-data/parse-design-md";
import { type Bundle } from "@/lib/ui-data/bundles";

// ─── Preview section label ────────────────────────────────────────────────────
function PreviewSectionLabel({ label, muted, isDark }: { label: string; muted: string; isDark: boolean }) {
  return (
    <div
      className="text-[9px] uppercase tracking-[0.22em] mb-3 pb-2 border-b"
      style={{
        fontFamily: MONO,
        color: muted,
        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
      }}
    >
      {label}
    </div>
  );
}

/**
 * Live, token-rendered preview of a bundle's design system. Parses the
 * design.md and paints a palette / type scale / component sampler / scales
 * in the brand's own colors. Used both as the detail-page hero fallback
 * (when no stored screenshot exists) and inside the Overview section.
 */
export function PreviewPane({ bundle }: { bundle: Bundle }) {
  const parsed: ParsedTokens = parseDesignMd(bundle.designMd ?? "");

  // Default to the brand's native color scheme
  const [mode, setMode] = useState<"dark" | "light">(
    parsed.colorScheme === "light" ? "light" : "dark"
  );

  // ── Surface backgrounds ────────────────────────────────────────────────────
  const lightSurface =
    parsed.colors.find(c => !isLuminanceDark(c.hex) && /^(canvas|background|surface)$/.test(c.name))?.hex ??
    parsed.colors.find(c => !isLuminanceDark(c.hex) && /canvas|background|surface/.test(c.name))?.hex ??
    "#FAFAFA";

  // For light brands: their ink/foreground token makes a great dark background
  const darkSurface =
    parsed.colors.find(c => isLuminanceDark(c.hex) && /^(surface|bg|background|canvas)$/.test(c.name))?.hex ??
    parsed.colors.find(c => isLuminanceDark(c.hex) && /surface|bg|canvas/.test(c.name))?.hex ??
    parsed.colors.find(c => isLuminanceDark(c.hex) && /^(ink|foreground|text[-_]primary|text[-_]main)$/.test(c.name))?.hex ??
    (bundle.palette[1] && isLuminanceDark(bundle.palette[1]) ? bundle.palette[1] : undefined) ??
    "#101012";

  const bgColor  = mode === "dark" ? darkSurface : lightSurface;
  const bgIsDark = isLuminanceDark(bgColor);

  // ── Text — validated against the actual bgColor luminance ─────────────────
  const textColor = bgIsDark
    ? (parsed.colors.find(c => !isLuminanceDark(c.hex) && /^(on-surface|on-canvas|on-bg|on-primary-container)$/.test(c.name))?.hex
    ?? parsed.colors.find(c => !isLuminanceDark(c.hex) && /^(foreground|on-primary|canvas)$/.test(c.name))?.hex
    ?? "#F0EFEC")
    : (parsed.colors.find(c => isLuminanceDark(c.hex) && /^(ink|text[-_]main|text[-_]primary|foreground)$/.test(c.name))?.hex
    ?? parsed.colors.find(c => isLuminanceDark(c.hex) && /^(text|ink)/.test(c.name))?.hex
    ?? "#1A1A1A");

  // Muted: only use brand token if it actually contrasts with current bg
  const mutedText = (() => {
    const brand = parsed.colors.find(c =>
      /^(ink-mute|ink-mute-2|text[-_]muted|text[-_]secondary|on-surface-variant|muted|sub)$/.test(c.name)
    );
    if (brand && bgIsDark !== isLuminanceDark(brand.hex)) return brand.hex;
    return bgIsDark ? "#9090A0" : "#6B7280";
  })();

  // ── Card + border ──────────────────────────────────────────────────────────
  const darkCard =
    parsed.colors.find(c => isLuminanceDark(c.hex) && /^(surface-container|surface-container-low|card)$/.test(c.name))?.hex ??
    parsed.colors.find(c => isLuminanceDark(c.hex) && /^(ink-secondary|text[-_]secondary)$/.test(c.name))?.hex ??
    darkSurface;
  const lightCard =
    parsed.colors.find(c => !isLuminanceDark(c.hex) && /^(canvas-soft|surface-container-low|surface-variant|card)$/.test(c.name))?.hex ??
    lightSurface;

  const borderCol =
    parsed.colors.find(c => /^(hairline|outline|border|divider|surface-container-high)$/.test(c.name))?.hex ??
    (bgIsDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)");

  // Accent — never changes by mode
  const findColor = (test: RegExp) => parsed.colors.find(c => test.test(c.name))?.hex;
  const accent = findColor(/^(primary|accent[-_]brand|accent|brand)$/) ?? bundle.palette[0] ?? VIOLET;
  const accentText = findColor(/^(on-primary)$/) ??
    (isLuminanceDark(accent) ? "#FFFFFF" : "#000000");

  const cardBg = mode === "dark" ? darkCard : lightCard;

  // ── Typography selection (up to 5 key levels) ─────────────────────────────
  const typoLevels = (() => {
    if (!parsed.typography.length) return [];
    const pick = (patterns: RegExp[]) =>
      patterns.map(p => parsed.typography.find(t => p.test(t.name))).find(Boolean);
    const display  = pick([/display-xxl/i, /display-xl/i, /display-lg/i, /display/i]);
    const heading  = pick([/heading-md/i, /heading-lg/i, /headline-md/i, /heading/i, /headline/i]);
    const body     = pick([/body-lg/i, /body-md/i, /body/i]);
    const label    = pick([/button-md/i, /label-md/i, /label/i, /button/i]);
    const caption  = pick([/caption/i, /micro/i, /small/i, /label-sm/i]);
    return [display, heading, body, label, caption].filter(Boolean).slice(0, 5);
  })();

  // ── Component selection ───────────────────────────────────────────────────
  const btnPrimary  = parsed.components.find(c => /button-primary-pill$|^button-primary$/.test(c.name))
                    ?? parsed.components.find(c => /button-primary/.test(c.name));
  const btnSecondary = parsed.components.find(c => /button-secondary/.test(c.name));
  const cardComp    = parsed.components.find(c => /^card(-feature)?$/.test(c.name))
                    ?? parsed.components.find(c => /^card/.test(c.name));
  const inputComp   = parsed.components.find(c => /^text-input$|^input-field$/.test(c.name))
                    ?? parsed.components.find(c => /input/.test(c.name));

  const btnBg       = btnPrimary?.backgroundColor ?? accent;
  const btnFg       = btnPrimary?.textColor       ?? accentText;
  const btnRadius   = btnPrimary?.rounded         ?? "6px";
  const btnPadding  = btnPrimary?.padding         ?? "0 16px";

  const cardBgResolved = cardComp?.backgroundColor ?? cardBg;
  const cardBorder     = cardComp?.borderColor     ?? borderCol;
  const cardRadius     = cardComp?.rounded         ?? "8px";
  // Card may have different luminance than canvas (e.g. white card on dark bg) — pick text that contrasts with it
  const cardIsDark     = isLuminanceDark(cardBgResolved);
  const cardText       = cardIsDark !== bgIsDark
    ? (cardIsDark
        ? (parsed.colors.find(c => !isLuminanceDark(c.hex) && /^(on-surface|canvas|foreground|on-primary)$/.test(c.name))?.hex ?? "#F0EFEC")
        : (parsed.colors.find(c => isLuminanceDark(c.hex) && /^(ink|text[-_]main|foreground)$/.test(c.name))?.hex ?? "#1A1A1A"))
    : textColor;
  const cardMuted      = cardIsDark !== bgIsDark
    ? (cardIsDark ? "#9090A0" : "#6B7280")
    : mutedText;

  const inputBg       = inputComp?.backgroundColor ?? cardBg;
  const inputBorder   = inputComp?.borderColor     ?? borderCol;
  const inputRadius   = inputComp?.rounded         ?? "6px";
  const inputIsDark   = isLuminanceDark(inputBg);
  const inputText     = inputIsDark !== bgIsDark ? (inputIsDark ? "#9090A0" : "#6B7280") : mutedText;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const sectionDivider: import("react").CSSProperties = {
    borderTop: `1px solid ${bgIsDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
    marginTop: "20px",
    paddingTop: "20px",
  };

  const hasParsedColors = parsed.colors.length > 0;
  const hasTypo         = typoLevels.length > 0;
  const hasSpacing      = parsed.spacing.length >= 2;
  const hasRounded      = parsed.rounded.length >= 2;

  return (
    <div
      className="rounded-xl border p-6"
      style={{ borderColor: BORDER, background: SURFACE }}
    >
      {/* ── Header: label + toggle ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="text-[10.5px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: MUTED }}>
          rendered with {bundle.name.toLowerCase()} tokens
        </div>
        <div className="flex gap-1">
          {(["dark", "light"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.15em]"
              style={{
                fontFamily: MONO,
                background: mode === m ? VIOLET : "transparent",
                color: mode === m ? "#fff" : MUTED,
                border: `1px solid ${mode === m ? VIOLET : BORDER}`,
                cursor: "pointer",
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* ── Canvas ── */}
      <div
        className="rounded-lg p-6 transition-colors duration-200"
        style={{ background: bgColor }}
      >

        {/* ─── Section 1: Color Palette ─── */}
        <PreviewSectionLabel label={`Color Palette · ${hasParsedColors ? parsed.colors.length : bundle.palette.length} tokens`} muted={mutedText} isDark={bgIsDark} />
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-1">
          {(hasParsedColors ? parsed.colors.slice(0, 18) : bundle.palette.map((h, i) => ({ name: `color-${i}`, hex: h }))).map(c => (
            <div key={c.name} className="flex items-center gap-2 min-w-0">
              <span
                className="shrink-0 h-4 w-7 rounded-sm border"
                style={{ background: c.hex, borderColor: mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}
              />
              <span
                className="text-[10px] truncate"
                style={{ fontFamily: MONO, color: mutedText }}
                title={c.name}
              >
                {c.name}
              </span>
              <span
                className="text-[10px] shrink-0 ml-auto"
                style={{ fontFamily: MONO, color: textColor, opacity: 0.7 }}
              >
                {c.hex.toUpperCase()}
              </span>
            </div>
          ))}
        </div>

        {/* ─── Section 2: Typography Scale ─── */}
        {hasTypo && (
          <div style={sectionDivider}>
            <PreviewSectionLabel label={`Typography Scale · ${parsed.typography.length} levels`} muted={mutedText} isDark={bgIsDark} />
            <div className="space-y-2">
              {typoLevels.map(t => {
                const rawPx = parsePx(t!.fontSize);
                const displayPx = Math.min(rawPx, 44);
                const sampleText = t!.name.replace(/-/g, ' ');
                return (
                  <div key={t!.name} className="flex items-baseline gap-3 overflow-hidden">
                    <span
                      className="shrink-0 text-[9px] uppercase tracking-[0.15em] w-20"
                      style={{ fontFamily: MONO, color: mutedText }}
                    >
                      {t!.name}
                    </span>
                    <span
                      className="truncate leading-tight"
                      style={{
                        fontFamily: t!.fontFamily,
                        fontSize: `${displayPx}px`,
                        fontWeight: t!.fontWeight ?? 400,
                        letterSpacing: t!.letterSpacing ?? undefined,
                        color: textColor,
                      }}
                    >
                      {sampleText.charAt(0).toUpperCase() + sampleText.slice(1)}
                    </span>
                    <span
                      className="shrink-0 text-[9px] ml-auto"
                      style={{ fontFamily: MONO, color: mutedText }}
                    >
                      {rawPx}px{t!.fontWeight ? ` / ${t!.fontWeight}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Section 3: Components ─── */}
        <div style={sectionDivider}>
          <PreviewSectionLabel label="Components" muted={mutedText} isDark={bgIsDark} />
          <div className="flex flex-wrap gap-3 mb-4">
            {/* Primary button */}
            <button
              className="text-[13px] font-medium"
              style={{
                background: btnBg,
                color: btnFg,
                borderRadius: btnRadius,
                padding: btnPadding,
                height: "36px",
                border: "none",
                cursor: "default",
              }}
            >
              Primary action
            </button>
            {/* Secondary button */}
            {btnSecondary ? (
              <button
                className="text-[13px]"
                style={{
                  background: btnSecondary.backgroundColor ?? "transparent",
                  color: btnSecondary.textColor ?? accent,
                  borderRadius: btnPrimary?.rounded ?? "6px",
                  padding: btnSecondary.padding ?? "0 16px",
                  height: "36px",
                  border: `1px solid ${btnSecondary.textColor ?? accent}`,
                  cursor: "default",
                }}
              >
                Secondary
              </button>
            ) : (
              <button
                className="text-[13px]"
                style={{
                  background: "transparent",
                  color: accent,
                  borderRadius: btnRadius,
                  padding: btnPadding,
                  height: "36px",
                  border: `1px solid ${accent}`,
                  cursor: "default",
                }}
              >
                Secondary
              </button>
            )}
          </div>
          {/* Card + Input row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div
              className="rounded p-4"
              style={{
                background: cardBgResolved,
                border: `1px solid ${cardBorder}`,
                borderRadius: cardRadius,
              }}
            >
              <div className="text-[13px] font-medium mb-1" style={{ color: cardText }}>
                {bundle.name} card
              </div>
              <div className="text-[11.5px]" style={{ color: cardMuted }}>
                {bundle.tokens > 0 ? `${bundle.tokens.toLocaleString()} tokens` : "design.md"} · {bundle.components > 0 ? `${bundle.components} components` : parsed.components.length > 0 ? `${parsed.components.length} components` : "live preview"}
              </div>
            </div>
            <div>
              <div
                className="w-full text-[12.5px] px-3"
                style={{
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  borderRadius: inputRadius,
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  color: inputText,
                }}
              >
                Input field
              </div>
            </div>
          </div>
        </div>

        {/* ─── Section 4: Scales ─── */}
        {(hasSpacing || hasRounded) && (
          <div style={sectionDivider}>
            {hasSpacing && (
              <>
                <PreviewSectionLabel label="Spacing Scale" muted={mutedText} isDark={bgIsDark} />
                <div className="flex flex-wrap items-end gap-2 mb-4">
                  {parsed.spacing.map(s => {
                    const px = parsePx(s.value);
                    const w = Math.max(8, Math.min(px, 64));
                    return (
                      <div key={s.name} className="flex flex-col items-center gap-1">
                        <div
                          className="rounded-sm"
                          style={{
                            width: `${w}px`,
                            height: "12px",
                            background: accent,
                            opacity: 0.7,
                          }}
                        />
                        <span className="text-[8.5px]" style={{ fontFamily: MONO, color: mutedText }}>
                          {s.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {hasRounded && (
              <>
                <PreviewSectionLabel label="Border Radius Scale" muted={mutedText} isDark={bgIsDark} />
                <div className="flex flex-wrap items-center gap-3">
                  {parsed.rounded.map(r => (
                    <div key={r.name} className="flex flex-col items-center gap-1">
                      <div
                        style={{
                          width: "28px",
                          height: "28px",
                          background: accent,
                          opacity: 0.75,
                          borderRadius: r.value === "9999px" ? "9999px" : r.value,
                        }}
                      />
                      <span className="text-[8.5px]" style={{ fontFamily: MONO, color: mutedText }}>
                        {r.name}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
