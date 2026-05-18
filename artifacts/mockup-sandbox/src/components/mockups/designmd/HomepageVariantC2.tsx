import { ArrowUpRight, Check, Command, GitCommit } from "lucide-react";

const BG = "#0A0A0B";
const SURFACE = "#101012";
const SURFACE_2 = "#15151A";
const BORDER = "#1F1F23";
const BORDER_SOFT = "#17171A";
const INK = "#F2F1EE";
const SUB = "#8E8E94";
const MUTED = "#5F5F66";
const VIOLET = "#8B7BFF";
const LIME = "#C5E96A";

const SANS = `"Inter", system-ui, sans-serif`;
const MONO = `"JetBrains Mono", ui-monospace, monospace`;

function StatusBar() {
  return (
    <div
      className="w-full text-[11px]"
      style={{ background: "#070708", borderBottom: `1px solid ${BORDER_SOFT}`, color: MUTED, fontFamily: MONO }}
    >
      <div className="mx-auto flex h-7 max-w-6xl items-center justify-between px-8">
        <div className="flex items-center gap-5">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIME, boxShadow: `0 0 6px ${LIME}88` }} />
            <span style={{ color: INK }}>operational</span>
          </span>
          <span>240 systems · 4,812 specs</span>
          <span className="hidden md:inline">edge · iad1 / fra1 / sin1</span>
        </div>
        <div className="flex items-center gap-5">
          <span className="inline-flex items-center gap-1.5">
            <GitCommit className="h-3 w-3" />
            <span>build 8a9b2c · v0.42.1</span>
          </span>
          <span className="hidden md:inline">may 18 · 18:21 UTC</span>
        </div>
      </div>
    </div>
  );
}

function HeaderC2() {
  return (
    <header
      className="sticky top-0 z-50 w-full border-b backdrop-blur-md"
      style={{ background: "rgba(10,10,11,0.78)", borderColor: BORDER }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-8">
        <div className="flex items-center gap-9">
          <a href="#" className="flex items-baseline gap-2 text-[14px] font-medium tracking-tight" style={{ color: INK }}>
            UIUXofAi
            <span className="text-[10px]" style={{ fontFamily: MONO, color: MUTED }}>/ 042</span>
          </a>
          <nav className="hidden md:flex items-center gap-7 text-[12.5px]" style={{ color: SUB }}>
            {[
              ["Library", true],
              ["Systems", false],
              ["Generate", false],
              ["Changelog", false],
              ["Docs", false],
            ].map(([n, active]) => (
              <a
                key={n as string}
                href="#"
                className="relative inline-flex items-center gap-1.5"
                style={{ color: active ? INK : SUB }}
              >
                {active ? <span className="h-1 w-1 rounded-full" style={{ background: VIOLET }} /> : null}
                {n}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3" style={{ fontFamily: SANS }}>
          <div
            className="hidden lg:flex h-7 items-center gap-2 rounded-md border px-2 text-[11.5px]"
            style={{ borderColor: BORDER, color: MUTED, background: SURFACE }}
          >
            <Command className="h-3 w-3" />
            <span style={{ color: SUB }}>K</span>
            <span className="ml-1">Search 240 bundles</span>
          </div>
          <button className="h-7 rounded-full px-3 text-[12px] font-medium" style={{ background: INK, color: "#0A0A0B" }}>
            Sign in
          </button>
        </div>
      </div>
    </header>
  );
}

const codeLines: { ln: number; tag?: "add" | "mod"; text: React.ReactNode }[] = [
  { ln: 1, text: <span style={{ color: MUTED }}># Linear · v0.42 · MIT</span> },
  { ln: 2, text: <><span style={{ color: INK }}>typography</span>:</> },
  { ln: 3, text: <>  family: <span style={{ color: VIOLET }}>"Inter"</span></> },
  { ln: 4, text: <>  scale: [12, 13, 14, 17, 22, 32]</> },
  { ln: 5, tag: "mod", text: <>  weight: {`{ body: 400, heading: 510 }`}</> },
  { ln: 6, text: <><span style={{ color: INK }}>color</span>:</> },
  { ln: 7, text: <>  surface: {`{ 0: `}<span style={{ color: VIOLET }}>"#0D0E10"</span>{`, 1: `}<span style={{ color: VIOLET }}>"#141518"</span>{` }`}</> },
  { ln: 8, tag: "add", text: <>  accent:  {`{ brand: `}<span style={{ color: VIOLET }}>"#5E6AD2"</span>{`, success: `}<span style={{ color: VIOLET }}>"#4CB782"</span>{` }`}</> },
  { ln: 9, text: <><span style={{ color: INK }}>radius</span>: [4, 6, 8, 12]</> },
  { ln: 10, text: <><span style={{ color: INK }}>elevation</span>:</> },
  { ln: 11, text: <>  card: <span style={{ color: VIOLET }}>"0 1px 0 #1F2024 inset, 0 8px 24px -12px #000"</span></> },
  { ln: 12, text: <><span style={{ color: INK }}>motion</span>:</> },
  { ln: 13, text: <>  base: <span style={{ color: VIOLET }}>150ms cubic-bezier(.2,.7,.1,1)</span></> },
  { ln: 14, text: <>  emphasized: <span style={{ color: VIOLET }}>220ms cubic-bezier(.2,.7,.1,1)</span></> },
];

function CodePanel() {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: BORDER, background: SURFACE }}>
      {/* Window chrome */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: BORDER, background: "#0C0C0E" }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#2A2A2E" }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#2A2A2E" }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#2A2A2E" }} />
          </div>
          <span className="text-[11px] uppercase tracking-[0.18em]" style={{ fontFamily: MONO, color: SUB }}>
            linear / design.md
          </span>
          <span
            className="text-[9.5px] px-1.5 py-0.5 rounded uppercase tracking-[0.18em]"
            style={{ fontFamily: MONO, color: VIOLET, border: `1px solid ${VIOLET}55` }}
          >
            yaml
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px]" style={{ fontFamily: MONO, color: SUB }}>
          <span>342 tokens</span>
          <span className="inline-flex items-center gap-1.5" style={{ color: INK }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIME }} />
            98% coverage
          </span>
        </div>
      </div>
      <div className="grid grid-cols-[44px_1fr] font-mono">
        <div className="text-right text-[11.5px] leading-[1.85] py-5 pr-3 border-r select-none" style={{ borderColor: BORDER, color: "#37373C", background: "#0D0D10" }}>
          {codeLines.map((l) => (
            <div key={l.ln} className="px-1.5" style={{ background: l.tag === "add" ? "#15201A" : l.tag === "mod" ? "#1F1A14" : undefined, color: l.tag ? INK : undefined }}>
              {l.ln}
            </div>
          ))}
        </div>
        <pre className="py-5 px-5 text-[12.5px] leading-[1.85] overflow-hidden" style={{ color: INK, fontFamily: MONO }}>
{codeLines.map((l) => (
  <div key={l.ln} className="flex items-start gap-2" style={{ background: l.tag === "add" ? "#0E1812" : l.tag === "mod" ? "#181308" : undefined, marginLeft: -20, paddingLeft: 20 }}>
    <span className="w-3 inline-block" style={{ color: l.tag === "add" ? LIME : l.tag === "mod" ? "#E0B868" : "transparent" }}>
      {l.tag === "add" ? "+" : l.tag === "mod" ? "~" : " "}
    </span>
    <span>{l.text}</span>
  </div>
))}
        </pre>
      </div>
      {/* Status footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t text-[10.5px]" style={{ borderColor: BORDER, background: "#0C0C0E", fontFamily: MONO, color: MUTED }}>
        <div className="flex items-center gap-4">
          <span>UTF-8</span>
          <span>LF</span>
          <span>YAML</span>
          <span style={{ color: SUB }}>last verified · 4h ago</span>
        </div>
        <div className="flex items-center gap-3">
          <span>copy</span>
          <span style={{ color: SUB }}>·</span>
          <span>open in claude</span>
        </div>
      </div>
    </div>
  );
}

export function HomepageVariantC2() {
  return (
    <div className="min-h-screen antialiased" style={{ background: BG, color: INK, fontFamily: SANS }}>
      <StatusBar />
      <HeaderC2 />

      {/* Hero */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-3xl px-8 pt-24 pb-16 text-center">
          <div className="inline-flex items-center gap-2.5 mb-7 text-[10.5px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: MUTED }}>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: VIOLET, boxShadow: `0 0 8px ${VIOLET}88` }} />
              <span style={{ color: SUB }}>v0.42</span>
            </span>
            <span className="h-px w-6" style={{ background: "#26262A" }} />
            <span>public beta</span>
          </div>
          <h1 className="text-[60px] leading-[1.02] font-medium tracking-[-0.022em]" style={{ color: INK }}>
            Design systems,<br />
            <span style={{ color: SUB }}>written for the</span>{" "}
            <span style={{ color: INK }}>model.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-[36rem] text-[15.5px] leading-[1.65]" style={{ color: SUB }}>
            A curated library that packages real brand systems into a
            <span className="px-1.5 py-0.5 mx-1 rounded" style={{ fontFamily: MONO, color: INK, background: SURFACE_2, border: `1px solid ${BORDER}` }}>design.md</span>
            spec and a calibrated companion prompt. Built for designers shipping with AI.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <button
              className="h-10 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center gap-2"
              style={{ background: INK, color: "#0A0A0B", boxShadow: `0 0 0 1px ${VIOLET}66, 0 10px 36px -10px ${VIOLET}88` }}
            >
              Open the library
              <span style={{ fontFamily: MONO, color: MUTED }}>⏎</span>
            </button>
            <button
              className="h-10 rounded-full border px-5 text-[12.5px] font-medium"
              style={{ borderColor: BORDER, color: INK, background: SURFACE }}
            >
              Generate from URL
            </button>
          </div>
          <div className="mt-5 text-[11px]" style={{ fontFamily: MONO, color: MUTED }}>
            no install · paste into any model · free during public beta
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-8 pb-24">
          <CodePanel />
        </div>
      </section>

      {/* What you get */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-8 py-20">
          <div className="grid grid-cols-12 gap-10">
            <div className="col-span-12 md:col-span-4">
              <div className="text-[10.5px] uppercase tracking-[0.22em] mb-3 inline-flex items-center gap-2" style={{ fontFamily: MONO, color: MUTED }}>
                <span style={{ color: VIOLET }}>§01</span>
                <span className="h-px w-5" style={{ background: BORDER }} />
                The pair
              </div>
              <h2 className="text-[32px] leading-[1.08] font-medium tracking-[-0.018em]">
                One spec.<br />
                <span style={{ color: SUB }}>One companion prompt.</span>
              </h2>
              <p className="mt-5 text-[13.5px] leading-[1.6] max-w-[18rem]" style={{ color: SUB }}>
                Two flat files, version-controlled, that teach any model to treat your brand
                as the source of truth.
              </p>
            </div>
            <div className="col-span-12 md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-px rounded-lg overflow-hidden" style={{ background: BORDER }}>
              {[
                { n: "01", t: "design.md", k: "spec", d: "Flat, model-readable. Type, color, radii, motion, component anatomy. Versioned and diffable.", icon: "▢" },
                { n: "02", t: "Companion prompt", k: "calibrated", d: "Teaches Claude or GPT to treat the spec as truth — not as a hint.", icon: "◇" },
                { n: "03", t: "Coverage scoring", k: "transparent", d: "A score so you know exactly which parts of the system are captured.", icon: "◆" },
                { n: "04", t: "Drop-in workflow", k: "no install", d: "Paste into Claude Projects, Cursor, Lovable. No SDK, no runtime.", icon: "◐" },
              ].map(({ n, t, k, d, icon }) => (
                <div key={t} className="p-7 group hover:bg-[#101013] transition-colors" style={{ background: BG }}>
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[10.5px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: MUTED }}>
                      {n}
                    </span>
                    <span className="text-[14px]" style={{ color: VIOLET, opacity: 0.8 }}>{icon}</span>
                  </div>
                  <div className="text-[15px] font-medium mb-1.5">{t}</div>
                  <div className="text-[10.5px] uppercase tracking-[0.18em] mb-3" style={{ fontFamily: MONO, color: VIOLET, opacity: 0.85 }}>{k}</div>
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
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.22em] mb-3 inline-flex items-center gap-2" style={{ fontFamily: MONO, color: MUTED }}>
                <span style={{ color: VIOLET }}>§02</span>
                <span className="h-px w-5" style={{ background: BORDER }} />
                The library
              </div>
              <h2 className="text-[32px] leading-[1.08] font-medium tracking-[-0.018em]">
                240 systems,{" "}
                <span style={{ color: SUB }}>ready for the model.</span>
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                ["All", "240"],
                ["Dark", "62"],
                ["Editorial", "31"],
                ["Devtools", "44"],
                ["Enterprise", "53"],
              ].map(([t, c], i) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 text-[11.5px] px-3 h-7 rounded-full border"
                  style={{
                    borderColor: i === 0 ? "#2C2C32" : BORDER,
                    color: i === 0 ? INK : SUB,
                    background: i === 0 ? SURFACE : "transparent",
                  }}
                >
                  {t}
                  <span style={{ fontFamily: MONO, color: MUTED }}>{c}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-lg overflow-hidden" style={{ background: BORDER }}>
            {[
              { n: "Linear", c: "Dark · geometric", num: "042", cov: 98, palette: ["#5E6AD2", "#0D0E10", "#8A8F98", "#F4F4F5"] },
              { n: "Stripe", c: "Gradient · marketing", num: "041", cov: 96, palette: ["#635BFF", "#0A2540", "#00D4FF", "#FFB320"] },
              { n: "Notion", c: "Serif · calm", num: "040", cov: 94, palette: ["#000000", "#37352F", "#787774", "#FFFFFF"] },
              { n: "IBM Carbon", c: "Dense · enterprise", num: "039", cov: 96, palette: ["#0F62FE", "#161616", "#525252", "#F4F4F4"] },
              { n: "Arc Browser", c: "Playful · warm", num: "038", cov: 89, palette: ["#FF6E4A", "#1A1A1A", "#FFE5C2", "#FFFFFF"] },
              { n: "Vercel", c: "Mono · devtools", num: "037", cov: 95, palette: ["#000000", "#333333", "#666666", "#EAEAEA"] },
              { n: "Ramp", c: "Fintech · ochre", num: "036", cov: 92, palette: ["#FBD867", "#1B1B1B", "#7A7975", "#F5F4F0"] },
              { n: "Atlassian", c: "Blue · enterprise", num: "035", cov: 88, palette: ["#0052CC", "#172B4D", "#5E6C84", "#FAFBFC"] },
            ].map((b) => (
              <a
                key={b.n}
                href="#"
                className="p-5 group transition-colors hover:bg-[#101013] block"
                style={{ background: BG }}
              >
                <div className="flex items-center justify-between mb-5">
                  <span className="text-[10px] uppercase tracking-[0.2em]" style={{ fontFamily: MONO, color: MUTED }}>
                    № {b.num}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: SUB }} />
                </div>
                <div className="text-[15px] font-medium mb-1" style={{ color: INK }}>
                  {b.n}
                </div>
                <div className="text-[11.5px] mb-4" style={{ color: SUB }}>
                  {b.c}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex h-1.5">
                    {b.palette.map((c) => (
                      <span key={c} className="w-5 first:rounded-l-sm last:rounded-r-sm" style={{ background: c }} />
                    ))}
                  </div>
                  <span className="text-[10.5px] inline-flex items-center gap-1" style={{ fontFamily: MONO, color: SUB }}>
                    <Check className="h-2.5 w-2.5" style={{ color: LIME }} />
                    {b.cov}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Logos */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-8 py-14">
          <div className="text-[10.5px] uppercase tracking-[0.22em] mb-6 text-center" style={{ fontFamily: MONO, color: MUTED }}>
            in use at teams shipping with AI
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {["Linear", "Vercel", "Ramp", "Arc", "Raycast", "Cursor", "Lovable"].map((n, i, arr) => (
              <span key={n} className="inline-flex items-center gap-3 text-[16px] tracking-tight" style={{ color: SUB }}>
                <span style={{ color: INK, opacity: 0.78 }}>{n}</span>
                {i < arr.length - 1 ? <span style={{ fontFamily: MONO, color: MUTED, opacity: 0.5 }}>/</span> : null}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="mx-auto max-w-3xl px-8 py-24 text-center">
          <div className="text-[10.5px] uppercase tracking-[0.22em] mb-5 inline-flex items-center gap-2" style={{ fontFamily: MONO, color: MUTED }}>
            <span style={{ color: VIOLET }}>§04</span>
            <span className="h-px w-5" style={{ background: BORDER }} />
            Get started
          </div>
          <h2 className="text-[46px] leading-[1.02] font-medium tracking-[-0.022em]">
            Stop fighting the<br />
            <span style={{ color: SUB }}>model's defaults.</span>
          </h2>
          <p className="mt-6 text-[15.5px] leading-[1.65] max-w-[34rem] mx-auto" style={{ color: SUB }}>
            Pick a bundle, paste the spec, ship UI that actually looks like your brand. Free
            while in public beta.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <button
              className="h-10 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center gap-2"
              style={{ background: INK, color: "#0A0A0B", boxShadow: `0 0 0 1px ${VIOLET}66, 0 10px 36px -10px ${VIOLET}88` }}
            >
              Open the library
              <span style={{ fontFamily: MONO, color: MUTED }}>⏎</span>
            </button>
            <button className="h-10 rounded-full border px-5 text-[12.5px] font-medium" style={{ borderColor: BORDER, color: INK, background: SURFACE }}>
              Submit a system
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t" style={{ borderColor: BORDER }}>
        <div className="mx-auto max-w-6xl px-8 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-[12px]" style={{ color: MUTED, fontFamily: MONO }}>
          <div className="flex items-center gap-4">
            <span style={{ color: INK, fontFamily: SANS }}>UIUXofAi</span>
            <span>v0.42 · 2026 · uiuxskills.com</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIME }} />
              <span style={{ color: SUB }}>all systems operational</span>
            </span>
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
