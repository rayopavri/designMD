import { ArrowUpRight, Check, Copy, Quote } from "lucide-react";

const BG = "#FBF7F2";
const INK = "#1A1714";
const SUB = "#7A6E63";
const FAINT = "#A89C8E";
const BORDER = "#E7DFD3";
const BORDER_SOFT = "#EFE9DE";
const LAVENDER = "#B7A6FF";
const LIME = "#C5E96A";
const PEACH = "#FFC8AF";

const SERIF = `"Fraunces", "PP Editorial New", "Spectral", Georgia, serif`;
const SANS = `"Inter", system-ui, sans-serif`;
const MONO = `"JetBrains Mono", ui-monospace, monospace`;

function HeaderB2() {
  return (
    <header className="w-full" style={{ background: BG }}>
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-10">
        <div className="flex items-baseline gap-3">
          <a href="#" className="text-[22px] font-semibold tracking-tight" style={{ fontFamily: SERIF, color: INK }}>
            UIUXofAi
          </a>
          <span className="text-[10.5px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: FAINT }}>
            № 042
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-[13px]" style={{ fontFamily: SANS, color: INK }}>
          <a href="#">Collection</a>
          <a href="#">Plates</a>
          <a href="#">Generate</a>
          <a href="#">Journal</a>
          <a href="#">Vote</a>
        </nav>
        <div className="flex items-center gap-3" style={{ fontFamily: SANS }}>
          <a href="#" className="text-[13px]" style={{ color: INK }}>Sign in</a>
          <button className="h-9 rounded-full px-4 text-[13px] font-medium text-white" style={{ background: INK }}>
            Open collection
          </button>
        </div>
      </div>
    </header>
  );
}

function SectionLabel({ n, t }: { n: string; t: string }) {
  return (
    <div className="flex items-center gap-3 text-[10.5px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: SUB }}>
      <span style={{ color: INK }}>{n}</span>
      <span className="h-px w-6" style={{ background: BORDER }} />
      <span>{t}</span>
    </div>
  );
}

export function HomepageVariantB2() {
  return (
    <div className="min-h-screen antialiased" style={{ background: BG, color: INK, fontFamily: SANS }}>
      <HeaderB2 />

      {/* Hero — tightened */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 80% at 50% 18%, rgba(255, 200, 175, 0.55) 0%, rgba(245, 220, 230, 0.32) 35%, rgba(251, 247, 242, 0) 70%)",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-10 pt-24 pb-14 text-center">
          <div className="mb-8 inline-flex items-center gap-3 text-[10.5px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: SUB }}>
            <span>Issue 042</span>
            <span className="h-1 w-1 rounded-full" style={{ background: FAINT }} />
            <span>May 2026</span>
            <span className="h-1 w-1 rounded-full" style={{ background: FAINT }} />
            <span style={{ color: INK }}>Linear, dark · geometric</span>
          </div>
          <h1
            className="text-[92px] leading-[0.96] tracking-[-0.028em] font-normal"
            style={{ fontFamily: SERIF, color: INK }}
          >
            Design systems,<br />
            <em className="font-normal" style={{ fontStyle: "italic" }}>written for the model.</em>
          </h1>
          <p className="mx-auto mt-7 max-w-[34rem] text-[16.5px] leading-[1.6]" style={{ color: SUB }}>
            One issue, one brand system — packaged as a
            <span style={{ fontFamily: MONO, color: INK }}> design.md </span> spec and a
            companion prompt. Claude and GPT stop guessing. Your work starts looking like yours.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <button className="h-11 rounded-full px-6 text-[13.5px] font-medium text-white" style={{ background: INK }}>
              Open issue 042
            </button>
            <button className="h-11 rounded-full border bg-white/70 px-6 text-[13.5px] font-medium" style={{ borderColor: BORDER, color: INK }}>
              Generate from a URL
            </button>
          </div>
          <div className="mt-7 inline-flex items-center gap-2 text-[12px]" style={{ fontFamily: MONO, color: SUB }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIME }} />
            240 plates · free during public beta
          </div>
        </div>

        {/* Upgraded framed visual — spec on the left, RENDERED preview on the right */}
        <div className="relative mx-auto max-w-5xl px-10 pb-24">
          <div
            className="rounded-2xl border bg-white overflow-hidden"
            style={{ borderColor: BORDER, boxShadow: "0 30px 80px -30px rgba(40, 25, 15, 0.18), 0 8px 24px -12px rgba(40, 25, 15, 0.08)" }}
          >
            <div className="flex items-center justify-between px-6 py-3.5 border-b" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-3">
                <span className="text-[11px] uppercase tracking-[0.18em]" style={{ fontFamily: MONO, color: SUB }}>
                  Plate 042 · Linear
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] inline-flex items-center px-2 py-0.5 rounded-full" style={{ background: LIME, color: INK, fontFamily: MONO }}>
                  98% coverage
                </span>
                <span className="text-[11px] inline-flex items-center px-2 py-0.5 rounded-full" style={{ background: PEACH, color: INK, fontFamily: MONO }}>
                  342 tokens
                </span>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-0">
              {/* Spec column */}
              <div className="col-span-6 p-8 border-r" style={{ borderColor: BORDER }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[10.5px] uppercase tracking-[0.2em]" style={{ fontFamily: MONO, color: SUB }}>
                    Input · design.md
                  </div>
                  <button className="inline-flex items-center gap-1.5 text-[11px] px-2 h-6 rounded-full border" style={{ borderColor: BORDER, color: INK, fontFamily: MONO }}>
                    <Copy className="h-3 w-3" /> copy
                  </button>
                </div>
                <pre className="text-[12px] leading-[1.7] whitespace-pre-wrap" style={{ fontFamily: MONO, color: INK }}>
{`# Linear
typography:
  family: Inter
  scale: [12, 13, 14, 17, 22, 32]
  weight: { body: 400, heading: 510 }
color:
  surface: { 0: "#0D0E10", 1: "#141518" }
  accent:  { brand: "#5E6AD2" }
radius: [4, 6, 8, 12]
elevation:
  card: "0 1px 0 #1F2024 inset,
         0 8px 24px -12px #000"
motion:
  base: 150ms cubic-bezier(.2,.7,.1,1)`}
                </pre>
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {["dark-native", "high-density", "geometric-mono"].map((t) => (
                    <span key={t} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: LAVENDER, color: INK, fontFamily: MONO }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Rendered preview column — the actual payoff */}
              <div className="col-span-6 p-8" style={{ background: "#FDFAF6" }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[10.5px] uppercase tracking-[0.2em]" style={{ fontFamily: MONO, color: SUB }}>
                    Output · generated with Claude
                  </div>
                  <div className="inline-flex items-center gap-1 text-[11px]" style={{ fontFamily: MONO, color: INK }}>
                    <Check className="h-3 w-3" />
                    on-brand
                  </div>
                </div>

                {/* Faux rendered Linear-style UI card, using the spec's own tokens */}
                <div
                  className="rounded-[8px] overflow-hidden"
                  style={{
                    background: "#0D0E10",
                    boxShadow: "0 1px 0 #1F2024 inset, 0 8px 24px -12px #000",
                  }}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#1B1C1F" }}>
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#5E6AD2" }} />
                      <span className="text-[12px]" style={{ color: "#EDEDED", fontFamily: SANS }}>ENG-2041</span>
                    </div>
                    <span className="text-[11px]" style={{ color: "#8A8A90", fontFamily: SANS }}>In Progress</span>
                  </div>
                  <div className="px-4 py-4" style={{ background: "#141518" }}>
                    <div className="text-[14px] font-medium mb-1" style={{ color: "#EDEDED", fontFamily: SANS, fontWeight: 510 }}>
                      Calibrate companion prompt against new spec
                    </div>
                    <div className="text-[12px] leading-[1.55]" style={{ color: "#8A8A90", fontFamily: SANS }}>
                      Reduce hallucination on radii and elevation tokens. Add regression
                      cases for surface 1 vs surface 2 preference.
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-[11px]" style={{ fontFamily: MONO, color: "#8A8A90" }}>
                      <span className="px-1.5 py-0.5 rounded" style={{ background: "#1B1C1F", color: "#EDEDED" }}>spec</span>
                      <span className="px-1.5 py-0.5 rounded" style={{ background: "#1B1C1F", color: "#EDEDED" }}>p1</span>
                      <span className="ml-auto">3d</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-[11px]" style={{ fontFamily: MONO, color: SUB }}>
                  <span>0 hallucinated tokens · 0 invented radii</span>
                  <a href="#" className="inline-flex items-center gap-1" style={{ color: INK }}>
                    open preview <ArrowUpRight className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works — new */}
      <section className="border-t" style={{ borderColor: BORDER }}>
        <div className="mx-auto max-w-6xl px-10 py-24">
          <div className="grid grid-cols-12 gap-10 items-start">
            <div className="col-span-4">
              <SectionLabel n="Index 01" t="How it works" />
              <h2 className="mt-4 text-[44px] leading-[1.05] font-normal" style={{ fontFamily: SERIF, color: INK }}>
                Three steps,<br />
                <em className="font-normal" style={{ fontStyle: "italic" }}>no SDK.</em>
              </h2>
              <p className="mt-5 text-[14px] leading-[1.6]" style={{ color: SUB }}>
                Designed to slot into the tools you already use — Claude Projects,
                Cursor, Lovable, v0. Nothing to install.
              </p>
            </div>

            <ol className="col-span-8 grid grid-cols-3 gap-px" style={{ background: BORDER }}>
              {[
                {
                  n: "01",
                  t: "Pick a plate",
                  d: "Browse 240 systems, from Linear to IBM Carbon. Each one ships with a transparent coverage score.",
                },
                {
                  n: "02",
                  t: "Paste the bundle",
                  d: "Copy the design.md and companion prompt into Claude Projects or your tool of choice. One file each.",
                },
                {
                  n: "03",
                  t: "Ship on-brand UI",
                  d: "The model treats the spec as truth — no invented tokens, no random radii, no Tailwind-default look.",
                },
              ].map((s) => (
                <li key={s.n} className="p-7 relative" style={{ background: BG }}>
                  <div className="text-[10.5px] uppercase tracking-[0.22em] mb-5" style={{ fontFamily: MONO, color: SUB }}>
                    Step {s.n}
                  </div>
                  <div className="text-[20px] mb-2" style={{ fontFamily: SERIF, color: INK }}>{s.t}</div>
                  <p className="text-[13.5px] leading-[1.6]" style={{ color: SUB }}>{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* What's in an issue — kept, lightly refined */}
      <section className="border-t" style={{ borderColor: BORDER }}>
        <div className="mx-auto max-w-6xl px-10 py-24">
          <div className="grid grid-cols-12 gap-10">
            <div className="col-span-4">
              <SectionLabel n="Index 02" t="The pair" />
              <h2 className="mt-4 text-[44px] leading-[1.05] font-normal" style={{ fontFamily: SERIF, color: INK }}>
                What's in<br />an issue
              </h2>
            </div>
            <div className="col-span-8 grid grid-cols-2 gap-px" style={{ background: BORDER }}>
              {[
                { t: "The spec", d: "A flat design.md covering type, color, radii, motion, and component anatomy. 4–6 KB, diffable, plain text." },
                { t: "The prompt", d: "A calibrated system prompt teaching the model to read the spec as ground truth — not as a hint to remix." },
                { t: "The score", d: "A transparent coverage score so you know which parts of the system are actually captured before you ship." },
                { t: "The diff", d: "Every plate is versioned. When a brand evolves, you can pull the patch — your prompts come along." },
              ].map(({ t, d }) => (
                <div key={t} className="p-7" style={{ background: BG }}>
                  <div className="text-[20px] mb-2" style={{ fontFamily: SERIF }}>{t}</div>
                  <p className="text-[13.5px] leading-[1.6]" style={{ color: SUB }}>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* This season's plates */}
      <section className="border-t" style={{ borderColor: BORDER }}>
        <div className="mx-auto max-w-6xl px-10 py-24">
          <div className="flex items-end justify-between mb-10">
            <div>
              <SectionLabel n="Index 03" t="Spring 2026" />
              <h2 className="mt-4 text-[44px] leading-[1.05] font-normal" style={{ fontFamily: SERIF }}>
                This season's plates
              </h2>
            </div>
            <a href="#" className="text-[13px] inline-flex items-center gap-1" style={{ color: INK }}>
              See all 240 <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {[
              { n: "Linear", c: "Dark · Geometric", num: "042", swatches: ["#5E6AD2", "#0D0E10", "#F4F4F5"] },
              { n: "Stripe", c: "Gradient · Editorial", num: "041", swatches: ["#635BFF", "#0A2540", "#F6F9FC"] },
              { n: "Notion", c: "Serif · Calm", num: "040", swatches: ["#37352F", "#FBFBFA", "#9B9A97"] },
              { n: "IBM Carbon", c: "Dense · Enterprise", num: "039", swatches: ["#0F62FE", "#161616", "#F4F4F4"] },
              { n: "Arc Browser", c: "Playful · Warm", num: "038", swatches: ["#FA4F22", "#1F1F1F", "#F0EAE2"] },
              { n: "Vercel", c: "Mono · Devtools", num: "037", swatches: ["#000000", "#FAFAFA", "#666666"] },
            ].map((b) => (
              <a key={b.n} href="#" className="block">
                <div
                  className="aspect-[4/3] rounded-xl border mb-4 overflow-hidden relative"
                  style={{ borderColor: BORDER, background: "white" }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[64px] font-normal" style={{ fontFamily: SERIF, color: INK }}>
                      {b.n[0]}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3 text-[10px] uppercase tracking-[0.18em]" style={{ fontFamily: MONO, color: SUB }}>
                    № {b.num}
                  </div>
                  <div className="absolute bottom-3 left-3 flex gap-1">
                    {b.swatches.map((s) => (
                      <span key={s} className="h-3 w-3 rounded-sm border" style={{ background: s, borderColor: BORDER }} />
                    ))}
                  </div>
                </div>
                <div className="flex items-baseline justify-between">
                  <div className="text-[17px]" style={{ fontFamily: SERIF }}>{b.n}</div>
                  <div className="text-[12px]" style={{ color: SUB }}>{b.c}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials — new */}
      <section className="border-t" style={{ borderColor: BORDER }}>
        <div className="mx-auto max-w-6xl px-10 py-24">
          <div className="mb-12 text-center">
            <SectionLabel n="Index 04" t="From the field" />
            <h2 className="mt-4 text-[44px] leading-[1.05] font-normal" style={{ fontFamily: SERIF }}>
              <em className="font-normal" style={{ fontStyle: "italic" }}>
                Designers shipping with it.
              </em>
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-px" style={{ background: BORDER }}>
            {[
              {
                q: "I stopped writing 'don't use gradients' in every prompt. The spec just handles it.",
                a: "Mira Okafor",
                r: "Design lead · Plinth",
              },
              {
                q: "First tool that made Claude actually look like the brand we use internally, not a Tailwind starter.",
                a: "Jonas Lindqvist",
                r: "Staff designer · Cassia",
              },
              {
                q: "The companion prompt is the part nobody else gets right. It's the difference between a draft and a deliverable.",
                a: "Yui Tanaka",
                r: "Founder · Lower-deck Studio",
              },
            ].map((t) => (
              <figure key={t.a} className="p-8 flex flex-col" style={{ background: BG }}>
                <Quote className="h-4 w-4 mb-5" style={{ color: FAINT }} />
                <blockquote className="text-[17.5px] leading-[1.45] flex-1" style={{ fontFamily: SERIF, color: INK }}>
                  {t.q}
                </blockquote>
                <figcaption className="mt-6 pt-5 border-t text-[12.5px]" style={{ borderColor: BORDER_SOFT, color: SUB }}>
                  <div style={{ color: INK }}>{t.a}</div>
                  <div className="mt-0.5" style={{ fontFamily: MONO, fontSize: 11, color: FAINT }}>
                    {t.r}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Subscribe — kept */}
      <section className="border-t" style={{ borderColor: BORDER }}>
        <div className="mx-auto max-w-4xl px-10 py-24 text-center">
          <SectionLabel n="Index 05" t="Subscribe" />
          <h2 className="mt-4 text-[52px] leading-[1.05] font-normal" style={{ fontFamily: SERIF }}>
            One new plate,<br />
            <em className="font-normal" style={{ fontStyle: "italic" }}>every Sunday.</em>
          </h2>
          <p className="mt-5 text-[15.5px] leading-[1.6] max-w-[30rem] mx-auto" style={{ color: SUB }}>
            A new design system, an essay on what makes it work, and the spec to drop into
            your model. Plain text, no tracking.
          </p>
          <form className="mt-8 mx-auto flex max-w-md items-center gap-2">
            <input
              type="email"
              placeholder="you@studio.com"
              className="h-11 flex-1 rounded-full border bg-white px-5 text-[13.5px] outline-none"
              style={{ borderColor: BORDER, color: INK }}
            />
            <button type="button" className="h-11 rounded-full px-6 text-[13.5px] font-medium text-white" style={{ background: INK }}>
              Subscribe
            </button>
          </form>
          <div className="mt-5 text-[11.5px]" style={{ fontFamily: MONO, color: FAINT }}>
            4,820 designers and engineers · unsubscribe in one click
          </div>
        </div>
      </section>

      <footer className="border-t" style={{ borderColor: BORDER }}>
        <div className="mx-auto max-w-6xl px-10 py-10 flex items-center justify-between text-[12.5px]" style={{ color: SUB }}>
          <div className="flex items-baseline gap-3">
            <span className="text-[18px]" style={{ fontFamily: SERIF, color: INK }}>UIUXofAi</span>
            <span>№ 042 · May 2026 · uiuxskills.com</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#">Collection</a>
            <a href="#">Journal</a>
            <a href="#">Generate</a>
            <a href="#">Colophon</a>
            <a href="#">RSS</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
