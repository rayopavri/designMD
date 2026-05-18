import { ArrowUpRight } from "lucide-react";

const BG = "#FBF7F2";
const INK = "#1A1714";
const SUB = "#7A6E63";
const BORDER = "#E7DFD3";
const LAVENDER = "#B7A6FF";
const LIME = "#C5E96A";

const SERIF = `"Fraunces", "PP Editorial New", "Spectral", Georgia, serif`;
const SANS = `"Inter", system-ui, sans-serif`;
const MONO = `"JetBrains Mono", ui-monospace, monospace`;

function HeaderB() {
  return (
    <header className="w-full" style={{ background: BG }}>
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-10">
        <a href="#" className="text-[22px] font-semibold tracking-tight" style={{ fontFamily: SERIF, color: INK }}>
          UIUXofAi
        </a>
        <nav className="hidden md:flex items-center gap-8 text-[13px]" style={{ fontFamily: SANS, color: INK }}>
          <a href="#">Library</a>
          <a href="#">Design systems</a>
          <a href="#">Generate</a>
          <a href="#">Journal</a>
          <a href="#">Vote</a>
        </nav>
        <div className="flex items-center gap-3" style={{ fontFamily: SANS }}>
          <a href="#" className="text-[13px]" style={{ color: INK }}>Sign in</a>
          <button className="h-9 rounded-full px-4 text-[13px] font-medium text-white" style={{ background: INK }}>
            Get the collection
          </button>
        </div>
      </div>
    </header>
  );
}

export function HomepageVariantB() {
  return (
    <div className="min-h-screen antialiased" style={{ background: BG, color: INK, fontFamily: SANS }}>
      <HeaderB />

      {/* Hero with atmospheric wash */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 80% at 50% 20%, rgba(255, 200, 175, 0.55) 0%, rgba(245, 220, 230, 0.35) 35%, rgba(251, 247, 242, 0) 70%)",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-10 pt-24 pb-16 text-center">
          <div className="mb-8 inline-flex items-center gap-3 text-[10.5px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: SUB }}>
            <span>The Collection</span>
            <span style={{ color: INK }}>№ 042</span>
            <span>May 2026</span>
          </div>
          <h1
            className="text-[88px] leading-[0.98] tracking-[-0.025em] font-normal"
            style={{ fontFamily: SERIF, color: INK }}
          >
            A curated journal of<br />
            <em className="font-normal" style={{ fontStyle: "italic" }}>design systems</em>,<br />
            written for the model.
          </h1>
          <p className="mx-auto mt-8 max-w-[36rem] text-[16.5px] leading-[1.65]" style={{ color: SUB }}>
            Each issue packages a real brand system — Linear, Stripe, IBM Carbon, Notion — into a
            <span style={{ fontFamily: MONO, color: INK }}> design.md </span> spec and a
            companion prompt. So the model stops guessing, and your work starts looking
            like yours again.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <button className="h-11 rounded-full px-6 text-[13.5px] font-medium text-white" style={{ background: INK }}>
              Open the collection
            </button>
            <button className="h-11 rounded-full border bg-white/70 px-6 text-[13.5px] font-medium" style={{ borderColor: BORDER, color: INK }}>
              Generate from a URL
            </button>
          </div>
        </div>

        {/* Framed display piece */}
        <div className="relative mx-auto max-w-5xl px-10 pb-24">
          <div
            className="rounded-2xl border bg-white overflow-hidden"
            style={{ borderColor: BORDER, boxShadow: "0 30px 80px -30px rgba(40, 25, 15, 0.18), 0 8px 24px -12px rgba(40, 25, 15, 0.08)" }}
          >
            <div className="flex items-center justify-between px-6 py-3.5 border-b" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#E7DFD3" }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#E7DFD3" }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#E7DFD3" }} />
              </div>
              <div className="text-[11px] uppercase tracking-[0.18em]" style={{ fontFamily: MONO, color: SUB }}>
                Plate 042 · Linear
              </div>
              <span className="text-[11px] inline-flex items-center px-2 py-0.5 rounded-full" style={{ background: LIME, color: INK, fontFamily: MONO }}>
                98% coverage
              </span>
            </div>
            <div className="grid grid-cols-12 gap-0">
              <div className="col-span-7 p-10 border-r" style={{ borderColor: BORDER }}>
                <div className="text-[10.5px] uppercase tracking-[0.2em] mb-4" style={{ fontFamily: MONO, color: SUB }}>design.md · excerpt</div>
                <pre className="text-[12.5px] leading-[1.7] whitespace-pre-wrap" style={{ fontFamily: MONO, color: INK }}>
{`# Linear
typography:
  family: Inter
  scale: [12, 13, 14, 17, 22, 32]
  weight: { body: 400, heading: 510 }
color:
  surface: { 0: "#0D0E10", 1: "#141518", 2: "#1B1C1F" }
  accent:  { brand: "#5E6AD2", success: "#4CB782" }
radius: [4, 6, 8, 12]
elevation:
  card: "0 1px 0 #1F2024 inset, 0 8px 24px -12px #000"
motion:
  base: 150ms cubic-bezier(.2,.7,.1,1)
  emphasized: 220ms cubic-bezier(.2,.7,.1,1)`}
                </pre>
              </div>
              <div className="col-span-5 p-10" style={{ background: "#FDFAF6" }}>
                <div className="text-[10.5px] uppercase tracking-[0.2em] mb-4" style={{ fontFamily: MONO, color: SUB }}>Companion prompt</div>
                <p className="text-[13px] leading-[1.65]" style={{ color: INK }}>
                  You are designing inside Linear's system. Read <span style={{ fontFamily: MONO }}>design.md</span> as
                  truth. Do not introduce gradients, shadows, or radii not declared. Prefer
                  body weight 400, heading weight 510. Reach for surface 1 before surface 2.
                </p>
                <div className="mt-6 flex flex-wrap gap-1.5">
                  {["dark-native", "high-density", "geometric-mono", "low-chrome"].map((t) => (
                    <span key={t} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: LAVENDER, color: INK, fontFamily: MONO }}>
                      {t}
                    </span>
                  ))}
                </div>
                <button className="mt-8 w-full h-10 rounded-full text-[13px] font-medium text-white" style={{ background: INK }}>
                  Copy bundle for Claude
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Index / three columns */}
      <section className="mx-auto max-w-6xl px-10 py-24 border-t" style={{ borderColor: BORDER }}>
        <div className="grid grid-cols-12 gap-10">
          <div className="col-span-4">
            <div className="text-[10.5px] uppercase tracking-[0.22em] mb-4" style={{ fontFamily: MONO, color: SUB }}>Index 01</div>
            <h2 className="text-[44px] leading-[1.05] font-normal" style={{ fontFamily: SERIF, color: INK }}>
              What's in an issue
            </h2>
          </div>
          <div className="col-span-8 grid grid-cols-3 gap-px" style={{ background: BORDER }}>
            {[
              { n: "01", t: "The spec", d: "A flat design.md covering type, color, radii, motion, and component anatomy. 4–6 KB, diffable." },
              { n: "02", t: "The prompt", d: "A calibrated system prompt teaching the model to read the spec as ground truth, not as a hint." },
              { n: "03", t: "The score", d: "A transparent coverage score so you know which parts of the system are actually captured." },
            ].map(({ n, t, d }) => (
              <div key={n} className="p-7" style={{ background: BG }}>
                <div className="text-[10.5px] uppercase tracking-[0.22em] mb-5" style={{ fontFamily: MONO, color: SUB }}>{n}</div>
                <div className="text-[20px] mb-2" style={{ fontFamily: SERIF }}>{t}</div>
                <p className="text-[13.5px] leading-[1.6]" style={{ color: SUB }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* This season's plates */}
      <section className="mx-auto max-w-6xl px-10 py-24 border-t" style={{ borderColor: BORDER }}>
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.22em] mb-3" style={{ fontFamily: MONO, color: SUB }}>Index 02 — Spring 2026</div>
            <h2 className="text-[44px] leading-[1.05] font-normal" style={{ fontFamily: SERIF }}>
              This season's plates
            </h2>
          </div>
          <a href="#" className="text-[13px] inline-flex items-center gap-1" style={{ color: INK }}>
            See all 240 <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="grid grid-cols-3 gap-6">
          {[
            { n: "Linear", c: "Dark · Geometric", num: "042" },
            { n: "Stripe", c: "Gradient · Editorial", num: "041" },
            { n: "Notion", c: "Serif · Calm", num: "040" },
            { n: "IBM Carbon", c: "Dense · Enterprise", num: "039" },
            { n: "Arc Browser", c: "Playful · Warm", num: "038" },
            { n: "Vercel", c: "Mono · Devtools", num: "037" },
          ].map((b) => (
            <a key={b.n} href="#" className="block">
              <div
                className="aspect-[4/3] rounded-xl border mb-4 overflow-hidden relative"
                style={{ borderColor: BORDER, background: "white" }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[56px] font-normal" style={{ fontFamily: SERIF, color: INK }}>
                    {b.n[0]}
                  </span>
                </div>
                <div className="absolute top-3 right-3 text-[10px] uppercase tracking-[0.18em]" style={{ fontFamily: MONO, color: SUB }}>
                  № {b.num}
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-[17px]" style={{ fontFamily: SERIF }}>{b.n}</div>
                <div className="text-[12px]" style={{ color: SUB }}>{b.c}</div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Subscribe */}
      <section className="mx-auto max-w-4xl px-10 py-24 text-center border-t" style={{ borderColor: BORDER }}>
        <div className="text-[10.5px] uppercase tracking-[0.22em] mb-4" style={{ fontFamily: MONO, color: SUB }}>Index 03</div>
        <h2 className="text-[52px] leading-[1.05] font-normal" style={{ fontFamily: SERIF }}>
          One new plate, every Sunday.
        </h2>
        <p className="mt-5 text-[15.5px] leading-[1.6] max-w-[30rem] mx-auto" style={{ color: SUB }}>
          A new design system, an essay on what makes it work, and the spec to take into your
          model. No tracking, plain text.
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
