import { ArrowUpRight, Command, Quote } from "lucide-react";

const BG = "#0A0A0B";
const SURFACE = "#101012";
const SURFACE_2 = "#15151A";
const BORDER = "#1F1F23";
const BORDER_SOFT = "#17171A";
const INK = "#F2F1EE";
const SUB = "#8E8E94";
const MUTED = "#5F5F66";
const VIOLET = "#A697FF";
const LIME = "#C5E96A";

const SANS = `"Inter", system-ui, sans-serif`;
const MONO = `"JetBrains Mono", ui-monospace, monospace`;

function HeaderC3() {
  return (
    <header
      className="sticky top-0 z-50 w-full border-b backdrop-blur-md"
      style={{ background: "rgba(10,10,11,0.78)", borderColor: BORDER }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-10">
        <div className="flex items-baseline gap-3">
          <a href="#" className="text-[15px] font-medium tracking-tight" style={{ color: INK }}>
            UIUXofAi
          </a>
          <span className="text-[10.5px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: MUTED }}>
            edition no. 042
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-[12.5px]" style={{ color: SUB }}>
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
              className="relative"
              style={{ color: active ? INK : SUB }}
            >
              {n}
              {active ? (
                <span
                  className="absolute -bottom-[22px] left-0 right-0 h-[2px]"
                  style={{ background: VIOLET }}
                />
              ) : null}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3" style={{ fontFamily: SANS }}>
          <div className="hidden lg:flex h-8 items-center gap-2 rounded-md border px-2.5 text-[11.5px]" style={{ borderColor: BORDER, color: MUTED, background: SURFACE }}>
            <Command className="h-3 w-3" />
            <span>K</span>
          </div>
          <button className="h-8 rounded-full px-4 text-[12px] font-medium" style={{ background: INK, color: "#0A0A0B" }}>
            Sign in
          </button>
        </div>
      </div>
    </header>
  );
}

function CodeBlock({ title, lang, lines, tokens, status }: { title: string; lang: string; lines: { ln: number; text: React.ReactNode }[]; tokens: string; status: string }) {
  return (
    <div className="rounded-xl border overflow-hidden h-full flex flex-col" style={{ borderColor: BORDER, background: SURFACE }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: BORDER, background: "#0C0C0E" }}>
        <div className="flex items-center gap-3">
          <span className="text-[11px] uppercase tracking-[0.18em]" style={{ fontFamily: MONO, color: SUB }}>
            {title}
          </span>
          <span className="text-[9.5px] px-1.5 py-0.5 rounded uppercase tracking-[0.18em]" style={{ fontFamily: MONO, color: VIOLET, border: `1px solid ${VIOLET}55` }}>
            {lang}
          </span>
        </div>
        <span className="text-[10.5px]" style={{ fontFamily: MONO, color: MUTED }}>{tokens}</span>
      </div>
      <div className="flex-1 grid grid-cols-[32px_1fr] font-mono">
        <div className="text-right text-[11px] leading-[1.85] py-4 pr-2 border-r select-none" style={{ borderColor: BORDER, color: "#37373C", background: "#0D0D10" }}>
          {lines.map((l) => <div key={l.ln}>{l.ln}</div>)}
        </div>
        <pre className="py-4 px-4 text-[12px] leading-[1.85] overflow-hidden" style={{ color: INK, fontFamily: MONO }}>
          {lines.map((l) => <div key={l.ln}>{l.text}</div>)}
        </pre>
      </div>
      <div className="px-4 py-2 border-t text-[10.5px]" style={{ borderColor: BORDER, background: "#0C0C0E", fontFamily: MONO, color: SUB }}>
        {status}
      </div>
    </div>
  );
}

const specLines = [
  { ln: 1, text: <span style={{ color: MUTED }}># Linear · v0.42</span> },
  { ln: 2, text: <><span style={{ color: INK }}>typography</span>:</> },
  { ln: 3, text: <>  family: <span style={{ color: VIOLET }}>"Inter"</span></> },
  { ln: 4, text: <>  scale: [12, 13, 14, 17, 22, 32]</> },
  { ln: 5, text: <>  weight: {`{ body: 400, heading: 510 }`}</> },
  { ln: 6, text: <><span style={{ color: INK }}>color</span>:</> },
  { ln: 7, text: <>  surface: {`{ 0: `}<span style={{ color: VIOLET }}>"#0D0E10"</span>{`, 1: `}<span style={{ color: VIOLET }}>"#141518"</span>{` }`}</> },
  { ln: 8, text: <>  accent:  {`{ brand: `}<span style={{ color: VIOLET }}>"#5E6AD2"</span>{` }`}</> },
  { ln: 9, text: <><span style={{ color: INK }}>radius</span>: [4, 6, 8, 12]</> },
  { ln: 10, text: <><span style={{ color: INK }}>motion.base</span>: <span style={{ color: VIOLET }}>150ms</span></> },
];

const promptLines = [
  { ln: 1, text: <span style={{ color: MUTED }}>// companion · linear</span> },
  { ln: 2, text: <>You are designing inside the</> },
  { ln: 3, text: <>Linear system. Treat <span style={{ color: VIOLET }}>design.md</span></> },
  { ln: 4, text: <>as truth, not a hint.</> },
  { ln: 5, text: <> </> },
  { ln: 6, text: <><span style={{ color: VIOLET }}>RULES</span></> },
  { ln: 7, text: <>- Inter only. Never substitute.</> },
  { ln: 8, text: <>- Surface ramp is fixed: 0,1,2.</> },
  { ln: 9, text: <>- Brand <span style={{ color: VIOLET }}>#5E6AD2</span> · accent only.</> },
  { ln: 10, text: <>- Reuse — never invent — radii.</> },
];

export function HomepageVariantC3() {
  return (
    <div className="min-h-screen antialiased" style={{ background: BG, color: INK, fontFamily: SANS }}>
      <HeaderC3 />

      {/* Hero */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-10 pt-20 pb-16">
          <div className="grid grid-cols-12 gap-10 items-end">
            <div className="col-span-12 lg:col-span-7">
              <div className="inline-flex items-center gap-3 mb-6 text-[10.5px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: MUTED }}>
                <span style={{ color: VIOLET }}>§ Issue 042</span>
                <span className="h-px w-6" style={{ background: BORDER }} />
                <span>spring 2026 · public beta</span>
              </div>
              <h1 className="text-[72px] leading-[0.98] font-medium tracking-[-0.025em]" style={{ color: INK }}>
                Design systems,<br />
                written for the<br />
                <span style={{ color: VIOLET }}>model.</span>
              </h1>
              <p className="mt-7 max-w-[34rem] text-[16px] leading-[1.65]" style={{ color: SUB }}>
                A curated library that packages real brand systems into a flat
                <span className="px-1.5 py-0.5 mx-1 rounded" style={{ fontFamily: MONO, color: INK, background: SURFACE_2, border: `1px solid ${BORDER}` }}>design.md</span>
                spec — paired with a companion prompt that teaches Claude or GPT to treat the
                spec as truth. Built for designers shipping with AI.
              </p>
              <div className="mt-8 flex items-center gap-3">
                <button
                  className="h-11 rounded-full px-6 text-[13px] font-medium inline-flex items-center gap-2"
                  style={{ background: INK, color: "#0A0A0B", boxShadow: `0 0 0 1px ${VIOLET}55, 0 12px 40px -12px ${VIOLET}99` }}
                >
                  Open the library
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
                <button className="h-11 rounded-full border px-5 text-[13px] font-medium" style={{ borderColor: BORDER, color: INK, background: SURFACE }}>
                  Generate from URL
                </button>
              </div>
            </div>

            {/* Dual code panels */}
            <div className="col-span-12 lg:col-span-5">
              <div className="grid grid-cols-1 gap-3">
                <CodeBlock
                  title="linear / design.md"
                  lang="yaml"
                  lines={specLines}
                  tokens="342 tokens"
                  status="last verified · 4h ago"
                />
                <CodeBlock
                  title="linear / companion"
                  lang="prompt"
                  lines={promptLines}
                  tokens="186 tokens"
                  status="calibrated · claude 3.7 · gpt-4o"
                />
              </div>
            </div>
          </div>

          {/* Coverage meter */}
          <div className="mt-14 rounded-xl border p-5" style={{ borderColor: BORDER, background: SURFACE }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10.5px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: MUTED }}>
                coverage · linear v0.42
              </span>
              <span className="text-[11px]" style={{ fontFamily: MONO, color: INK }}>
                98% <span style={{ color: SUB }}>/ 100</span>
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {[
                ["Color", 100], ["Type", 98], ["Spacing", 96], ["Radii", 100], ["Elevation", 92], ["Motion", 94], ["Components", 96],
              ].map(([label, val]) => (
                <div key={label as string} className="space-y-1.5">
                  <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: SURFACE_2 }}>
                    <div className="h-full rounded-full" style={{ width: `${val}%`, background: VIOLET }} />
                  </div>
                  <div className="flex items-baseline justify-between text-[10.5px]" style={{ fontFamily: MONO }}>
                    <span style={{ color: SUB }}>{label}</span>
                    <span style={{ color: INK }}>{val}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pair */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-10 py-20">
          <div className="grid grid-cols-12 gap-10">
            <div className="col-span-12 md:col-span-4">
              <div className="text-[10.5px] uppercase tracking-[0.22em] mb-3 inline-flex items-center gap-2" style={{ fontFamily: MONO, color: MUTED }}>
                <span style={{ color: VIOLET }}>§ 01</span>
                <span className="h-px w-5" style={{ background: BORDER }} />
                The pair
              </div>
              <h2 className="text-[36px] leading-[1.06] font-medium tracking-[-0.02em]">
                One spec.<br />
                <span style={{ color: SUB }}>One companion prompt.</span>
              </h2>
              <p className="mt-5 text-[14px] leading-[1.65] max-w-[20rem]" style={{ color: SUB }}>
                Two flat files, version-controlled, that teach any model to ship pixels that
                match your brand on first paste.
              </p>
            </div>

            <div className="col-span-12 md:col-span-8 space-y-px rounded-lg overflow-hidden" style={{ background: BORDER }}>
              {[
                { n: "01", t: "design.md", k: "spec · yaml", d: "Flat, model-readable. Type, color, radii, motion, component anatomy. Versioned and diffable like code." },
                { n: "02", t: "Companion prompt", k: "calibrated", d: "Teaches Claude, GPT-4o, and Sonnet to treat the spec as truth — not as a vibe." },
                { n: "03", t: "Coverage scoring", k: "transparent", d: "A 7-axis score so you know exactly which parts of the system are captured." },
                { n: "04", t: "Drop-in workflow", k: "no install", d: "Paste into Claude Projects, Cursor, Lovable. No SDK, no runtime, no migration." },
              ].map(({ n, t, k, d }) => (
                <div key={t} className="grid grid-cols-12 gap-6 p-7 group hover:bg-[#101013] transition-colors" style={{ background: BG }}>
                  <div className="col-span-2 text-[11px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: MUTED }}>
                    {n}
                  </div>
                  <div className="col-span-3">
                    <div className="text-[16px] font-medium">{t}</div>
                    <div className="text-[10.5px] uppercase tracking-[0.18em] mt-1" style={{ fontFamily: MONO, color: VIOLET }}>{k}</div>
                  </div>
                  <p className="col-span-7 text-[13.5px] leading-[1.65]" style={{ color: SUB }}>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Library — typographic table */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-10 py-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.22em] mb-3 inline-flex items-center gap-2" style={{ fontFamily: MONO, color: MUTED }}>
                <span style={{ color: VIOLET }}>§ 02</span>
                <span className="h-px w-5" style={{ background: BORDER }} />
                The library
              </div>
              <h2 className="text-[36px] leading-[1.06] font-medium tracking-[-0.02em]">
                240 systems,{" "}
                <span style={{ color: SUB }}>ready for the model.</span>
              </h2>
            </div>
            <a href="#" className="text-[12.5px] inline-flex items-center gap-1.5" style={{ color: INK }}>
              Browse the full index
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="rounded-xl border overflow-hidden" style={{ borderColor: BORDER, background: SURFACE }}>
            <div className="grid grid-cols-[60px_1fr_1.4fr_140px_60px_28px] px-6 py-3 text-[10.5px] uppercase tracking-[0.22em] border-b" style={{ borderColor: BORDER, fontFamily: MONO, color: MUTED, background: "#0C0C0E" }}>
              <div>№</div>
              <div>System</div>
              <div>Character</div>
              <div>Palette</div>
              <div className="text-right">Cov</div>
              <div />
            </div>
            {[
              { num: "042", n: "Linear", c: "Dark · geometric · violet accent", cov: 98, palette: ["#5E6AD2", "#0D0E10", "#141518", "#8A8F98", "#F4F4F5"] },
              { num: "041", n: "Stripe", c: "Gradient · marketing · vibrant", cov: 96, palette: ["#635BFF", "#0A2540", "#00D4FF", "#FFB320", "#FFFFFF"] },
              { num: "040", n: "Notion", c: "Serif · calm · block-based", cov: 94, palette: ["#000000", "#37352F", "#787774", "#EAEAEA", "#FFFFFF"] },
              { num: "039", n: "IBM Carbon", c: "Dense · enterprise · accessible", cov: 96, palette: ["#0F62FE", "#161616", "#393939", "#8D8D8D", "#F4F4F4"] },
              { num: "038", n: "Arc Browser", c: "Playful · warm · gradient-led", cov: 89, palette: ["#FF6E4A", "#1A1A1A", "#FFE5C2", "#FFFFFF", "#A6A6A6"] },
              { num: "037", n: "Vercel", c: "Mono · devtools · monochrome", cov: 95, palette: ["#000000", "#333333", "#666666", "#EAEAEA", "#FFFFFF"] },
              { num: "036", n: "Ramp", c: "Fintech · ochre · editorial", cov: 92, palette: ["#FBD867", "#1B1B1B", "#7A7975", "#F5F4F0", "#FFFFFF"] },
            ].map((b, i, arr) => (
              <a
                key={b.n}
                href="#"
                className="grid grid-cols-[60px_1fr_1.4fr_140px_60px_28px] items-center px-6 py-4 transition-colors hover:bg-[#101013]"
                style={{ borderBottom: i < arr.length - 1 ? `1px solid ${BORDER_SOFT}` : undefined }}
              >
                <span className="text-[11px]" style={{ fontFamily: MONO, color: MUTED }}>№ {b.num}</span>
                <span className="text-[15px] font-medium" style={{ color: INK }}>{b.n}</span>
                <span className="text-[13px]" style={{ color: SUB }}>{b.c}</span>
                <div className="flex h-2">
                  {b.palette.map((c) => (
                    <span key={c} className="w-6 first:rounded-l-sm last:rounded-r-sm" style={{ background: c }} />
                  ))}
                </div>
                <span className="text-[12px] text-right" style={{ fontFamily: MONO, color: INK }}>{b.cov}</span>
                <ArrowUpRight className="h-3.5 w-3.5 justify-self-end" style={{ color: MUTED }} />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Quote — editorial */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-4xl px-10 py-20">
          <Quote className="h-5 w-5 mb-6" style={{ color: VIOLET }} />
          <blockquote className="text-[34px] leading-[1.18] font-medium tracking-[-0.015em]" style={{ color: INK }}>
            "We dropped the Linear bundle into Claude Projects and the first paste came back
            on-brand. <span style={{ color: SUB }}>Saved us a week of fighting defaults.</span>"
          </blockquote>
          <div className="mt-7 flex items-center gap-3 text-[12px]" style={{ fontFamily: MONO, color: SUB }}>
            <span style={{ color: INK }}>Maya Chen</span>
            <span style={{ color: MUTED }}>/</span>
            <span>Design lead · Ramp</span>
          </div>
        </div>
      </section>

      {/* Logos */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-10 py-12">
          <div className="text-[10.5px] uppercase tracking-[0.22em] mb-6 text-center" style={{ fontFamily: MONO, color: MUTED }}>
            in use at teams shipping with AI
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {["Linear", "Vercel", "Ramp", "Arc", "Raycast", "Cursor", "Lovable"].map((n, i, arr) => (
              <span key={n} className="inline-flex items-center gap-3 text-[16px] tracking-tight" style={{ color: SUB }}>
                <span style={{ color: INK, opacity: 0.8 }}>{n}</span>
                {i < arr.length - 1 ? <span style={{ fontFamily: MONO, color: MUTED, opacity: 0.5 }}>/</span> : null}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="mx-auto max-w-3xl px-10 py-24 text-center">
          <div className="text-[10.5px] uppercase tracking-[0.22em] mb-5 inline-flex items-center gap-2" style={{ fontFamily: MONO, color: MUTED }}>
            <span style={{ color: VIOLET }}>§ 03</span>
            <span className="h-px w-5" style={{ background: BORDER }} />
            Get started
          </div>
          <h2 className="text-[52px] leading-[1.02] font-medium tracking-[-0.025em]">
            Stop fighting the<br />
            <span style={{ color: VIOLET }}>model's defaults.</span>
          </h2>
          <p className="mt-6 text-[15.5px] leading-[1.65] max-w-[32rem] mx-auto" style={{ color: SUB }}>
            Pick a bundle, paste the spec, ship UI that looks like your brand. Free while in
            public beta.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <button
              className="h-11 rounded-full px-6 text-[13px] font-medium inline-flex items-center gap-2"
              style={{ background: INK, color: "#0A0A0B", boxShadow: `0 0 0 1px ${VIOLET}66, 0 12px 40px -12px ${VIOLET}99` }}
            >
              Open the library
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
            <button className="h-11 rounded-full border px-5 text-[13px] font-medium" style={{ borderColor: BORDER, color: INK, background: SURFACE }}>
              Submit a system
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t" style={{ borderColor: BORDER }}>
        <div className="mx-auto max-w-6xl px-10 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-[12px]" style={{ color: MUTED, fontFamily: MONO }}>
          <div className="flex items-center gap-4">
            <span style={{ color: INK, fontFamily: SANS }}>UIUXofAi</span>
            <span>edition 042 · spring 2026</span>
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
