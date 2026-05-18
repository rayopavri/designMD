import { ArrowUpRight, Command } from "lucide-react";

const BG = "#0A0A0B";
const SURFACE = "#121214";
const BORDER = "#1F1F22";
const BORDER_SOFT = "#17171A";
const INK = "#EDEDED";
const SUB = "#8A8A90";
const MUTED = "#6B6B70";
const VIOLET = "#8B7BFF";

const SANS = `"Inter", system-ui, sans-serif`;
const MONO = `"JetBrains Mono", ui-monospace, monospace`;

function HeaderC() {
  return (
    <header className="sticky top-0 z-50 w-full border-b backdrop-blur-md" style={{ background: "rgba(10,10,11,0.7)", borderColor: BORDER }}>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-8">
        <div className="flex items-center gap-9">
          <a href="#" className="text-[14px] font-medium tracking-tight" style={{ color: INK }}>
            UIUXofAi
          </a>
          <nav className="hidden md:flex items-center gap-6 text-[12.5px]" style={{ color: SUB }}>
            <a href="#" className="relative pb-3 -mb-3" style={{ color: INK, borderBottom: `1px solid ${VIOLET}` }}>Library</a>
            <a href="#" className="hover:text-white">Systems</a>
            <a href="#" className="hover:text-white">Generate</a>
            <a href="#" className="hover:text-white">Changelog</a>
            <a href="#" className="hover:text-white">Docs</a>
          </nav>
        </div>
        <div className="flex items-center gap-3" style={{ fontFamily: SANS }}>
          <div className="hidden lg:flex h-7 items-center gap-2 rounded-md border px-2 text-[11.5px]" style={{ borderColor: BORDER, color: MUTED }}>
            <Command className="h-3 w-3" />
            <span>K</span>
            <span className="ml-1">Search bundles</span>
          </div>
          <button className="h-7 rounded-full px-3 text-[12px] font-medium" style={{ background: INK, color: "#0A0A0B" }}>
            Sign in
          </button>
        </div>
      </div>
    </header>
  );
}

export function HomepageVariantC() {
  return (
    <div className="min-h-screen antialiased" style={{ background: BG, color: INK, fontFamily: SANS }}>
      <HeaderC />

      {/* Hero */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-3xl px-8 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 mb-7 text-[10.5px] uppercase tracking-[0.2em]" style={{ fontFamily: MONO, color: MUTED }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: VIOLET, boxShadow: `0 0 12px ${VIOLET}` }} />
            v0.42 · Public beta
          </div>
          <h1 className="text-[56px] leading-[1.04] font-medium tracking-[-0.02em]" style={{ color: INK }}>
            Design systems,<br />written for the model.
          </h1>
          <p className="mx-auto mt-6 max-w-[34rem] text-[15.5px] leading-[1.65]" style={{ color: SUB }}>
            A curated library that packages real brand systems into a
            <span style={{ fontFamily: MONO, color: INK }}> design.md </span>
            spec and a calibrated companion prompt. Built for designers who ship with AI.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <button
              className="h-10 rounded-full px-5 text-[12.5px] font-medium"
              style={{ background: INK, color: "#0A0A0B", boxShadow: `0 0 0 1px ${VIOLET}55, 0 8px 32px -8px ${VIOLET}77` }}
            >
              Open the library
            </button>
            <button className="h-10 rounded-full border px-5 text-[12.5px] font-medium" style={{ borderColor: BORDER, color: INK }}>
              Generate from URL
            </button>
          </div>
        </div>

        {/* design.md panel */}
        <div className="mx-auto max-w-4xl px-8 pb-24">
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: BORDER, background: SURFACE }}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-3">
                <span className="text-[11px] uppercase tracking-[0.18em]" style={{ fontFamily: MONO, color: MUTED }}>linear / design.md</span>
              </div>
              <div className="flex items-center gap-3 text-[11px]" style={{ fontFamily: MONO, color: MUTED }}>
                <span>342 tokens</span>
                <span style={{ color: VIOLET }}>98% coverage</span>
              </div>
            </div>
            <div className="grid grid-cols-12 gap-0" style={{ fontFamily: MONO }}>
              <div className="col-span-1 py-5 text-right text-[11.5px] leading-[1.7] pr-3 border-r select-none" style={{ borderColor: BORDER, color: "#3A3A3F" }}>
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <pre className="col-span-11 py-5 px-5 text-[12.5px] leading-[1.7] overflow-hidden" style={{ color: INK }}>
<span style={{ color: MUTED }}># Linear · v0.42</span>{"\n"}
<span style={{ color: VIOLET }}>typography</span>:{"\n"}
  family: Inter{"\n"}
  scale: [12, 13, 14, 17, 22, 32]{"\n"}
  weight: {"{ body: 400, heading: 510 }"}{"\n"}
<span style={{ color: VIOLET }}>color</span>:{"\n"}
  surface: {"{ 0: \"#0D0E10\", 1: \"#141518\", 2: \"#1B1C1F\" }"}{"\n"}
  accent:  {"{ brand: \"#5E6AD2\", success: \"#4CB782\" }"}{"\n"}
<span style={{ color: VIOLET }}>radius</span>: [4, 6, 8, 12]{"\n"}
<span style={{ color: VIOLET }}>elevation</span>:{"\n"}
  card: <span style={{ color: "#9CDFA0" }}>"0 1px 0 #1F2024 inset, 0 8px 24px -12px #000"</span>{"\n"}
<span style={{ color: VIOLET }}>motion</span>:{"\n"}
  base: 150ms cubic-bezier(.2,.7,.1,1){"\n"}
  emphasized: 220ms cubic-bezier(.2,.7,.1,1){"\n"}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-8 py-20">
          <div className="grid grid-cols-12 gap-10">
            <div className="col-span-4">
              <div className="text-[10.5px] uppercase tracking-[0.2em] mb-3" style={{ fontFamily: MONO, color: MUTED }}>01 · The pair</div>
              <h2 className="text-[30px] leading-[1.1] font-medium tracking-[-0.015em]">
                One spec.<br />One companion prompt.
              </h2>
            </div>
            <div className="col-span-8 grid grid-cols-2 gap-px" style={{ background: BORDER }}>
              {[
                { t: "design.md", d: "Flat, model-readable. Type, color, radii, motion, component anatomy. Versioned and diffable." },
                { t: "Companion prompt", d: "Calibrated to teach Claude or GPT to treat the spec as truth — not as a hint." },
                { t: "Coverage scoring", d: "Transparent score so you know exactly which parts of the system are captured." },
                { t: "Drop-in workflow", d: "Paste into Claude Projects, Cursor, Lovable. No SDK, no runtime, no install." },
              ].map(({ t, d }) => (
                <div key={t} className="p-7" style={{ background: BG }}>
                  <div className="text-[14px] font-medium mb-2">{t}</div>
                  <p className="text-[13px] leading-[1.6]" style={{ color: SUB }}>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Library */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-8 py-20">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.2em] mb-3" style={{ fontFamily: MONO, color: MUTED }}>02 · The library</div>
              <h2 className="text-[30px] leading-[1.1] font-medium tracking-[-0.015em]">240 systems, ready for the model.</h2>
            </div>
            <div className="flex items-center gap-2">
              {["All", "Dark", "Editorial", "Devtools", "Enterprise"].map((t, i) => (
                <span key={t} className="text-[11.5px] px-3 h-7 inline-flex items-center rounded-full border" style={{ borderColor: BORDER, color: i === 0 ? INK : SUB, background: i === 0 ? SURFACE : "transparent" }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-px" style={{ background: BORDER }}>
            {[
              { n: "Linear", c: "Dark · geometric", num: "042" },
              { n: "Stripe", c: "Gradient · marketing", num: "041" },
              { n: "Notion", c: "Serif · calm", num: "040" },
              { n: "IBM Carbon", c: "Dense · enterprise", num: "039" },
              { n: "Arc Browser", c: "Playful · warm", num: "038" },
              { n: "Vercel", c: "Mono · devtools", num: "037" },
              { n: "Ramp", c: "Fintech · ochre", num: "036" },
              { n: "Atlassian", c: "Blue · enterprise", num: "035" },
            ].map((b) => (
              <a key={b.n} href="#" className="p-5 hover:bg-[#121214] transition-colors" style={{ background: BG }}>
                <div className="flex items-center justify-between mb-5">
                  <span className="text-[10px] uppercase tracking-[0.18em]" style={{ fontFamily: MONO, color: MUTED }}>№ {b.num}</span>
                  <ArrowUpRight className="h-3.5 w-3.5" style={{ color: MUTED }} />
                </div>
                <div className="text-[14px] font-medium mb-1" style={{ color: INK }}>{b.n}</div>
                <div className="text-[11.5px]" style={{ color: SUB }}>{b.c}</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Logos / quiet credibility */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-8 py-14">
          <div className="text-[10.5px] uppercase tracking-[0.2em] mb-6 text-center" style={{ fontFamily: MONO, color: MUTED }}>
            In use at teams shipping with AI
          </div>
          <div className="flex items-center justify-between flex-wrap gap-y-6">
            {["Linear", "Vercel", "Ramp", "Arc", "Raycast", "Cursor", "Lovable"].map((n) => (
              <span key={n} className="text-[18px] font-medium tracking-tight" style={{ color: MUTED }}>{n}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="mx-auto max-w-3xl px-8 py-24 text-center">
          <h2 className="text-[44px] leading-[1.04] font-medium tracking-[-0.02em]">
            Stop fighting the model's defaults.
          </h2>
          <p className="mt-5 text-[15.5px] leading-[1.65] max-w-[32rem] mx-auto" style={{ color: SUB }}>
            Pick a bundle, paste the spec, ship UI that actually looks like your brand. Free
            while in public beta.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <button
              className="h-10 rounded-full px-5 text-[12.5px] font-medium"
              style={{ background: INK, color: "#0A0A0B", boxShadow: `0 0 0 1px ${VIOLET}55, 0 8px 32px -8px ${VIOLET}77` }}
            >
              Open the library
            </button>
            <button className="h-10 rounded-full border px-5 text-[12.5px] font-medium" style={{ borderColor: BORDER, color: INK }}>
              Submit a system
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t" style={{ borderColor: BORDER }}>
        <div className="mx-auto max-w-6xl px-8 py-10 flex items-center justify-between text-[12px]" style={{ color: MUTED, fontFamily: MONO }}>
          <div className="flex items-center gap-4">
            <span style={{ color: INK, fontFamily: SANS }}>UIUXofAi</span>
            <span>v0.42 · 2026 · uiuxskills.com</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#">library</a>
            <a href="#">generate</a>
            <a href="#">docs</a>
            <a href="#">changelog</a>
            <a href="#">github</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
