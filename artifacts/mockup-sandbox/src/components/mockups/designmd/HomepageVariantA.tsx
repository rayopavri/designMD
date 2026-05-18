import { ArrowRight, ArrowUpRight, Check, Copy, Search } from "lucide-react";

const ACCENT = "#1F7A4E";
const BORDER = "#E8E8E8";
const INK = "#0A0A0A";
const SUB = "#6B7280";
const SURFACE = "#FAFAFA";

function HeaderA() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white" style={{ borderColor: BORDER }}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-8">
        <div className="flex items-center gap-10">
          <a href="#" className="font-semibold tracking-tight text-[15px]" style={{ color: INK }}>
            UIUXofAi
          </a>
          <nav className="hidden md:flex items-center gap-7 text-[13px]" style={{ color: SUB }}>
            <a href="#" className="font-medium" style={{ color: ACCENT }}>Library</a>
            <a href="#" className="hover:text-black">Design systems</a>
            <a href="#" className="hover:text-black">Generate</a>
            <a href="#" className="hover:text-black">Docs</a>
            <a href="#" className="hover:text-black">Vote queue</a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden lg:block">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5" style={{ color: SUB }} />
            <input
              type="text"
              placeholder="Search 240+ bundles"
              className="h-8 w-60 rounded-full border bg-white pl-8 pr-3 text-[12.5px] outline-none placeholder:text-gray-400"
              style={{ borderColor: BORDER }}
            />
          </div>
          <button className="h-8 rounded-full px-4 text-[12.5px] font-medium text-white" style={{ background: ACCENT }}>
            Get the spec
          </button>
        </div>
      </div>
    </header>
  );
}

function DottedRule() {
  return (
    <div className="mx-auto max-w-6xl px-8">
      <div className="h-px w-full" style={{ backgroundImage: `radial-gradient(${BORDER} 1px, transparent 1px)`, backgroundSize: "6px 1px" }} />
    </div>
  );
}

export function HomepageVariantA() {
  return (
    <div className="min-h-screen bg-white antialiased" style={{ fontFamily: "Inter, system-ui, sans-serif", color: INK }}>
      <HeaderA />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-8 pt-20 pb-24">
        <div className="grid grid-cols-12 gap-10 items-start">
          <div className="col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11.5px]" style={{ borderColor: BORDER, color: SUB }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: INK }} />
              v0.42 · Now supporting Claude Projects & Lovable
            </div>
            <h1 className="mt-6 text-[64px] leading-[1.04] font-semibold tracking-[-0.025em]">
              A curated library of<br />design systems, ready<br />for the model context.
            </h1>
            <p className="mt-6 max-w-[34rem] text-[16px] leading-[1.6]" style={{ color: SUB }}>
              UIUXofAi packages real brand systems — Linear, Stripe, IBM Carbon, Vercel — into a
              structured <code className="font-mono text-[14px] px-1.5 py-0.5 rounded" style={{ background: SURFACE, color: INK }}>design.md</code> spec
              and a calibrated companion prompt. Drop one file in, get on-brand UI out.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <button className="h-10 rounded-full px-5 text-[13px] font-medium text-white" style={{ background: ACCENT }}>
                Explore the library
              </button>
              <button className="h-10 rounded-full border bg-white px-5 text-[13px] font-medium" style={{ borderColor: BORDER, color: INK }}>
                Generate from URL
              </button>
              <a href="#" className="ml-2 inline-flex items-center gap-1 text-[13px] font-medium" style={{ color: INK }}>
                Read the manifesto <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="mt-10 flex items-center gap-6 text-[12px]" style={{ color: SUB }}>
              <span>Trusted by teams shipping with AI at</span>
              <span className="font-medium" style={{ color: INK }}>Linear</span>
              <span className="font-medium" style={{ color: INK }}>Vercel</span>
              <span className="font-medium" style={{ color: INK }}>Ramp</span>
              <span className="font-medium" style={{ color: INK }}>Arc</span>
            </div>
          </div>

          {/* Right: extracted bundle card with browser chrome */}
          <div className="col-span-5">
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.16em]" style={{ color: SUB }}>
                Extraction · this week
              </span>
              <a href="#" className="font-mono text-[10.5px] uppercase tracking-[0.16em]" style={{ color: INK }}>
                Archive →
              </a>
            </div>
            <div className="rounded-lg border bg-white overflow-hidden" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: BORDER, background: SURFACE }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#D7D7D7" }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#D7D7D7" }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#D7D7D7" }} />
                <div className="ml-3 flex h-6 flex-1 items-center px-2.5 rounded border bg-white text-[11px] font-mono" style={{ borderColor: BORDER, color: SUB }}>
                  linear.app
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-[15px] font-semibold">Linear</div>
                    <div className="text-[12px]" style={{ color: SUB }}>Extracted 2 hours ago · 342 tokens</div>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ color: INK, border: `1px solid ${BORDER}` }}>
                    <Check className="h-3 w-3" />
                    98% coverage
                  </div>
                </div>
                <dl className="space-y-3.5 text-[12.5px]">
                  {[
                    ["Typography", "Inter · 6 sizes"],
                    ["Color", "5 surfaces · 3 accents"],
                    ["Radii", "4 · 6 · 8"],
                    ["Elevation", "Soft, single layer"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b pb-2" style={{ borderColor: BORDER }}>
                      <dt style={{ color: SUB }}>{k}</dt>
                      <dd className="font-mono" style={{ color: INK }}>{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-5 flex gap-2">
                  <button className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded text-[12.5px] font-medium text-white" style={{ background: INK }}>
                    <Copy className="h-3.5 w-3.5" />
                    Copy design.md
                  </button>
                  <button className="h-9 px-3 rounded border text-[12.5px] font-medium" style={{ borderColor: BORDER }}>
                    Open
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <DottedRule />

      {/* What it is */}
      <section className="mx-auto max-w-6xl px-8 py-20">
        <div className="grid grid-cols-12 gap-10">
          <div className="col-span-4">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] mb-3" style={{ color: SUB }}>01 — The pair</div>
            <h2 className="text-[34px] leading-[1.1] font-semibold tracking-[-0.02em]">
              One spec file.<br />One companion prompt.
            </h2>
          </div>
          <div className="col-span-8 grid grid-cols-2 gap-5">
            {[
              { t: "design.md", d: "A flat, model-readable spec covering type, color, radii, elevation, motion, and component anatomy. Versioned, diffable, 4–6 KB." },
              { t: "Companion prompt", d: "A calibrated system prompt that teaches Claude or GPT how to read the spec and resist hallucinating its own defaults." },
              { t: "Coverage scoring", d: "Each bundle ships with a transparent score so you know exactly which parts of the system are captured." },
              { t: "Drop-in workflow", d: "Paste into Claude Projects, Lovable, Cursor, or any agent. No SDK, no install, no runtime." },
            ].map(({ t, d }) => (
              <div key={t} className="rounded-md border p-5" style={{ borderColor: BORDER }}>
                <div className="text-[14px] font-semibold mb-1.5">{t}</div>
                <p className="text-[13px] leading-[1.55]" style={{ color: SUB }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <DottedRule />

      {/* Library preview */}
      <section className="mx-auto max-w-6xl px-8 py-20">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] mb-3" style={{ color: SUB }}>02 — The library</div>
            <h2 className="text-[34px] leading-[1.1] font-semibold tracking-[-0.02em]">240 systems and counting.</h2>
          </div>
          <a href="#" className="text-[13px] font-medium inline-flex items-center gap-1">
            Browse all <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="grid grid-cols-4 gap-px rounded-lg border overflow-hidden" style={{ borderColor: BORDER, background: BORDER }}>
          {[
            { n: "Linear", c: "Product · dark", swatches: ["#5E6AD2", "#0D0E10", "#F4F4F5"] },
            { n: "Stripe", c: "Marketing · gradient", swatches: ["#635BFF", "#0A2540", "#F6F9FC"] },
            { n: "IBM Carbon", c: "Enterprise · dense", swatches: ["#0F62FE", "#161616", "#F4F4F4"] },
            { n: "Vercel", c: "Devtools · mono", swatches: ["#000000", "#FAFAFA", "#666666"] },
            { n: "Atlassian", c: "Enterprise · blue", swatches: ["#0052CC", "#172B4D", "#F4F5F7"] },
            { n: "Notion", c: "Editorial · serif", swatches: ["#37352F", "#FBFBFA", "#9B9A97"] },
            { n: "Arc", c: "Browser · playful", swatches: ["#FA4F22", "#1F1F1F", "#F0EAE2"] },
            { n: "Ramp", c: "Fintech · ochre", swatches: ["#E8B440", "#0A0A0A", "#FAF7F2"] },
          ].map((b) => (
            <a key={b.n} href="#" className="group bg-white p-5 hover:bg-[#FAFAFA]">
              <div className="flex items-center gap-1.5 mb-4">
                {b.swatches.map((s) => (
                  <span key={s} className="h-3.5 w-3.5 rounded-sm border" style={{ background: s, borderColor: BORDER }} />
                ))}
              </div>
              <div className="text-[14px] font-semibold mb-0.5">{b.n}</div>
              <div className="text-[11.5px]" style={{ color: SUB }}>{b.c}</div>
            </a>
          ))}
        </div>
      </section>

      <DottedRule />

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-8 py-24">
        <div className="grid grid-cols-12 gap-10 items-center">
          <div className="col-span-7">
            <h2 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.02em]">
              Stop fighting the model's defaults.
            </h2>
            <p className="mt-4 text-[15.5px] leading-[1.6] max-w-[34rem]" style={{ color: SUB }}>
              Pick a bundle, paste the spec, ship UI that actually looks like your brand. Free
              while in public beta.
            </p>
          </div>
          <div className="col-span-5 flex md:justify-end gap-3">
            <button className="h-10 rounded-full px-5 text-[13px] font-medium text-white" style={{ background: ACCENT }}>
              Browse the library
            </button>
            <button className="h-10 rounded-full border bg-white px-5 text-[13px] font-medium" style={{ borderColor: BORDER }}>
              Submit a system
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t" style={{ borderColor: BORDER }}>
        <div className="mx-auto max-w-6xl px-8 py-10 flex items-center justify-between text-[12.5px]" style={{ color: SUB }}>
          <div className="flex items-center gap-3">
            <span className="font-semibold" style={{ color: INK }}>UIUXofAi</span>
            <span>© 2026 · uiuxskills.com</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#">Library</a>
            <a href="#">Generate</a>
            <a href="#">Docs</a>
            <a href="#">Changelog</a>
            <a href="#">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
