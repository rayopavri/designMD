import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Check, Globe, Loader2, RefreshCw } from "lucide-react";
import { SectionLabel } from "../components/Shell";
import { CodePanel } from "../components/CodePanel";
import {
  BG,
  BORDER,
  BORDER_SOFT,
  INK,
  INK_ON_LIGHT,
  LIME,
  MONO,
  MUTED,
  PEACH,
  SUB,
  SURFACE,
  VIOLET,
} from "../lib/tokens";

type Step = {
  id: string;
  label: string;
  detail: string;
  durationMs: number;
};

const STEPS: Step[] = [
  { id: "scrape", label: "Scraping pages", detail: "Firecrawl · 14 pages · 2.4s", durationMs: 1400 },
  { id: "palette", label: "Extracting palette", detail: "OKLCH clustering · 8 colors", durationMs: 1100 },
  { id: "type", label: "Inferring type scale", detail: "Geist · 7 sizes · 3 weights", durationMs: 1300 },
  { id: "anatomy", label: "Mapping components", detail: "Button · Card · Input · Pill", durationMs: 1400 },
  { id: "score", label: "Scoring coverage", detail: "94% — drafting companion prompt", durationMs: 1100 },
];

type Status = "idle" | "running" | "done";

function presetSpec(host: string, palette: string[]): string {
  return `---
brand: ${host}
version: 0.1.0-draft
source: ${host}
extracted_at: ${new Date().toISOString()}
---

# DETECTED PALETTE
- primary:    ${palette[0]}
- surface:    ${palette[1]}
- text_main:  ${palette[2]}
- text_muted: ${palette[3]}
- accent:     ${palette[4]}

# TYPOGRAPHY
- family: Inter
- scale:  [12, 14, 16, 18, 24, 32, 48]
- weight: { body: 400, medium: 510, bold: 600 }
- tracking: -0.012em

# SPACING
- scale: [4, 8, 12, 16, 24, 32, 48, 64]

# RADIUS
- sm: 4px
- md: 8px
- lg: 12px

# COMPONENT ANATOMY
## Button (primary)
- height: 36px
- padding-x: 16px
- radius: md
- bg: accent
- fg: surface

## Card
- bg: surface
- border: 1px solid ${palette[3]}33
- radius: lg
- padding: 24px

# FORBIDDEN
- Pure black on surface chrome
- Decorative shadows on document blocks
- Sans-serif other than Inter
`;
}

function presetPrompt(host: string): string {
  return `You are designing a UI inside the ${host} design system. Treat the attached design.md as the absolute source of truth.

# OPERATING RULES
1. Read design.md before generating any UI. If a token is missing, ask before guessing.
2. Use only tokens declared in design.md.
3. Match the ${host} feel — do not blend with other brand aesthetics.
4. When the user says "make a card" or "add a button", look up the component anatomy section first.

# COVERAGE
Coverage target: 92%+ of declared tokens used per UI block.
Report which tokens you used and which you skipped after each generation.

# REFUSAL CRITERIA
If a request would violate FORBIDDEN rules, explain which rule is at risk and propose a compliant alternative.
`;
}

export function Generate() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [stepIdx, setStepIdx] = useState(-1);
  const [palette, setPalette] = useState<string[]>([]);
  const timersRef = useRef<number[]>([]);

  const host = (() => {
    try {
      if (!url) return "";
      const u = url.startsWith("http") ? url : `https://${url}`;
      return new URL(u).hostname.replace(/^www\./, "");
    } catch {
      return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    }
  })();

  function start() {
    if (!url.trim()) return;
    clearTimers();
    setStatus("running");
    setStepIdx(0);
    setPalette([]);
    // Seed a fake palette deterministically from URL
    const seed = host || "demo";
    const next = generatePalette(seed);
    let acc = 0;
    STEPS.forEach((s, i) => {
      acc += s.durationMs;
      const t = window.setTimeout(() => {
        setStepIdx(i + 1);
        if (i === 1) setPalette(next);
        if (i === STEPS.length - 1) setStatus("done");
      }, acc);
      timersRef.current.push(t);
    });
  }

  function reset() {
    clearTimers();
    setStatus("idle");
    setStepIdx(-1);
    setPalette([]);
  }

  function clearTimers() {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }
  useEffect(() => () => clearTimers(), []);

  const elapsed = stepIdx >= 0 ? STEPS.slice(0, stepIdx).reduce((s, x) => s + x.durationMs, 0) : 0;
  const total = STEPS.reduce((s, x) => s + x.durationMs, 0);

  return (
    <>
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-3xl px-6 lg:px-8 pt-20 pb-12 text-center">
          <SectionLabel n="01" t="From any URL" />
          <h1 className="mt-5 text-[44px] sm:text-[56px] leading-[1.02] font-medium tracking-[-0.022em]">
            Extract any brand's
            <br />
            <span style={{ color: SUB }}>system in 12 seconds.</span>
          </h1>
          <p className="mt-6 text-[15px] leading-[1.65] max-w-[34rem] mx-auto" style={{ color: SUB }}>
            Paste a URL. We'll scrape it, lift the tokens, write a calibrated companion prompt, and
            score the coverage — ready to drop into Claude.
          </p>

          <form
            className="mt-10 mx-auto max-w-2xl flex items-center gap-2 rounded-full border p-1.5"
            style={{ borderColor: BORDER, background: SURFACE }}
            onSubmit={(e) => {
              e.preventDefault();
              start();
            }}
          >
            <Globe className="h-4 w-4 ml-3" style={{ color: MUTED }} />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://linear.app"
              className="flex-1 h-9 bg-transparent text-[14px] px-1"
              style={{ color: INK, fontFamily: MONO }}
              disabled={status === "running"}
            />
            {status === "idle" ? (
              <button
                type="submit"
                disabled={!url.trim()}
                className="h-9 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center gap-2 disabled:opacity-50"
                style={{ background: INK, color: INK_ON_LIGHT }}
              >
                Extract <span style={{ fontFamily: MONO, color: MUTED }}>⏎</span>
              </button>
            ) : status === "running" ? (
              <button
                type="button"
                className="h-9 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center gap-2"
                style={{ background: INK, color: INK_ON_LIGHT }}
                disabled
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Extracting
              </button>
            ) : (
              <button
                type="button"
                onClick={reset}
                className="h-9 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center gap-2"
                style={{ background: INK, color: INK_ON_LIGHT }}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Try another
              </button>
            )}
          </form>
          <div className="mt-4 text-[11px]" style={{ fontFamily: MONO, color: MUTED }}>
            {status === "idle"
              ? "free during public beta · paste any production site"
              : status === "running"
              ? `${(elapsed / 1000).toFixed(1)}s elapsed of ~${(total / 1000).toFixed(0)}s`
              : `extracted from ${host} · ${(total / 1000).toFixed(0)}s total`}
          </div>
        </div>
      </section>

      {/* Pipeline + Preview */}
      <section>
        <div className="mx-auto max-w-6xl px-6 lg:px-8 py-16 grid grid-cols-1 lg:grid-cols-2 gap-px rounded-xl overflow-hidden" style={{ background: BORDER }}>
          <div className="p-8" style={{ background: BG }}>
            <SectionLabel n="02" t="Extraction pipeline" />
            <div className="mt-6 space-y-4">
              {STEPS.map((s, i) => {
                const state: "done" | "active" | "pending" =
                  stepIdx > i ? "done" : stepIdx === i ? "active" : "pending";
                return (
                  <div key={s.id} className="flex items-start gap-4">
                    <span
                      className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border shrink-0"
                      style={{
                        borderColor:
                          state === "done" ? LIME : state === "active" ? VIOLET : BORDER,
                        background: state === "done" ? `${LIME}22` : SURFACE,
                      }}
                    >
                      {state === "done" ? (
                        <Check className="h-3 w-3" style={{ color: LIME }} />
                      ) : state === "active" ? (
                        <Loader2 className="h-3 w-3 animate-spin" style={{ color: VIOLET }} />
                      ) : (
                        <span
                          className="text-[10px]"
                          style={{ fontFamily: MONO, color: MUTED }}
                        >
                          {i + 1}
                        </span>
                      )}
                    </span>
                    <div className="flex-1">
                      <div
                        className="text-[13.5px]"
                        style={{ color: state === "pending" ? SUB : INK }}
                      >
                        {s.label}
                      </div>
                      <div
                        className="text-[11px] mt-0.5"
                        style={{ fontFamily: MONO, color: state === "pending" ? MUTED : SUB }}
                      >
                        {s.detail}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-8" style={{ background: BG }}>
            <SectionLabel n="03" t="Early preview" />
            <div
              className="mt-6 rounded-lg border p-6"
              style={{ borderColor: BORDER, background: SURFACE }}
            >
              <div
                className="text-[11px] uppercase tracking-[0.22em] mb-4"
                style={{ fontFamily: MONO, color: MUTED }}
              >
                detected palette
              </div>
              {palette.length === 0 ? (
                <div
                  className="h-12 rounded border-dashed border flex items-center justify-center text-[12px]"
                  style={{ borderColor: BORDER, color: MUTED, fontFamily: MONO }}
                >
                  waiting for extraction…
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex h-8 rounded overflow-hidden">
                    {palette.map((c) => (
                      <span key={c} className="flex-1" style={{ background: c }} />
                    ))}
                  </div>
                  <div className="grid grid-cols-5 gap-2 text-[10.5px]" style={{ fontFamily: MONO, color: SUB }}>
                    {palette.map((c) => (
                      <span key={c}>{c.toUpperCase()}</span>
                    ))}
                  </div>
                </div>
              )}
              <div
                className="mt-6 grid grid-cols-2 gap-4 text-[12px]"
                style={{ color: SUB }}
              >
                <Field label="source" value={host || "—"} />
                <Field label="coverage" value={status === "done" ? "94%" : "—"} accent={status === "done" ? LIME : undefined} />
                <Field label="tokens" value={status === "done" ? "1,124" : "—"} />
                <Field label="components" value={status === "done" ? "38" : "—"} />
              </div>
              {status === "done" ? (
                <Link
                  href="/library"
                  className="mt-6 inline-flex items-center gap-2 h-9 rounded-full px-4 text-[12px] font-medium"
                  style={{ background: INK, color: INK_ON_LIGHT }}
                >
                  Save to library
                  <span style={{ fontFamily: MONO, color: MUTED }}>⏎</span>
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        {status === "done" ? (
          <div className="mx-auto max-w-6xl px-6 lg:px-8 pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CodePanel
                title={`${host}/design.md`}
                language="yaml"
                source={presetSpec(host, palette)}
                rightMeta={
                  <span className="inline-flex items-center gap-1.5" style={{ color: INK }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: PEACH }} />
                    draft · review before shipping
                  </span>
                }
              />
              <CodePanel
                title={`${host}/companion.md`}
                language="md"
                source={presetPrompt(host)}
                rightMeta={
                  <span className="inline-flex items-center gap-1.5" style={{ color: INK }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: VIOLET }} />
                    calibrated
                  </span>
                }
              />
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}

function Field({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: MUTED }}>
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-[14px]" style={{ color: INK, fontFamily: MONO }}>
          {value}
        </span>
        {accent ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} /> : null}
      </div>
    </div>
  );
}

function generatePalette(seed: string): string[] {
  // Cheap deterministic palette from string
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const accent = `hsl(${hue}, 78%, 60%)`;
  const surface = `hsl(${hue}, 18%, 8%)`;
  const muted = `hsl(${hue}, 14%, 45%)`;
  const text = `hsl(${hue}, 20%, 96%)`;
  const warm = `hsl(${(hue + 32) % 360}, 70%, 65%)`;
  return [accent, surface, muted, text, warm].map(hslToHex);
}

function hslToHex(hsl: string): string {
  const m = hsl.match(/hsl\((\d+),\s*(\d+)%?,\s*(\d+)%?\)/);
  if (!m) return hsl;
  let h = +m[1],
    s = +m[2] / 100,
    l = +m[3] / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m2 = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) => {
    const n = Math.round((v + m2) * 255);
    return n.toString(16).padStart(2, "0");
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}
