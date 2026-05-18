import { ChevronRight, Copy, Download, Quote, Terminal, ThumbsDown, ThumbsUp } from "lucide-react";
import { Header, SectionLabel, PaletteStrip, CoverageBar, ChipLime, ChipPeach, ChipLavender, BG, BG_SOFT, INK, SUB, FAINT, BORDER, BORDER_SOFT, SERIF, MONO } from "./_Shared";
import "./_group.css";

export function BundleDetail() {
  const codeSnippet = `---
brand: Stripe
version: 1.0.0
---

# ABSOLUTE CONSTRAINTS
1. Never use pure black (#000000); use #0A2540 for deepest text.
2. Primary accent is #635BFF; use for primary buttons and active states.
3. Typography must be Inter, tight letter-spacing (-0.01em).

# TOKEN VALUES
## Colors
- background: #FFFFFF
- surface:    #F6F9FC
- primary:    #635BFF
- text_main:  #0A2540
- text_muted: #425466

## Spacing
- base_unit:         4px
- container_padding: 24px
`;

  return (
    <div className="designmd-root">
      <Header active="Plates" />

      {/* Breadcrumb */}
      <div style={{ background: BG, borderBottom: `1px solid ${BORDER_SOFT}` }}>
        <div className="mx-auto max-w-7xl px-10 py-4 flex items-center text-[11.5px]" style={{ fontFamily: MONO, color: SUB }}>
          <a href="#">Collection</a>
          <ChevronRight className="h-3 w-3 mx-2" style={{ color: FAINT }} />
          <a href="#">Finance</a>
          <ChevronRight className="h-3 w-3 mx-2" style={{ color: FAINT }} />
          <span style={{ color: INK }}>Stripe · № 041</span>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-10 py-14 flex flex-col lg:flex-row gap-14 w-full" style={{ background: BG }}>
        {/* Left rail */}
        <div className="lg:w-1/3 space-y-10">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: SUB }}>
              Plate 041 · Finance
            </div>
            <h1 className="mt-4 text-[56px] leading-[1.02] font-normal" style={{ fontFamily: SERIF, color: INK }}>
              <em className="font-normal" style={{ fontStyle: "italic" }}>Stripe.</em>
            </h1>
            <p className="mt-5 text-[15px] leading-[1.6]" style={{ color: SUB }}>
              Vibrant, angled, modern finance UI. Excellent for SaaS dashboards and
              high-conversion payment flows.
            </p>

            <div className="mt-6 flex flex-wrap gap-1.5">
              <ChipLime>98% coverage</ChipLime>
              <ChipPeach>1,847 tokens</ChipPeach>
              <ChipLavender>gradient-first</ChipLavender>
            </div>

            <div className="mt-6 rounded-xl border bg-white overflow-hidden" style={{ borderColor: BORDER }}>
              <PaletteStrip colors={["#635BFF", "#0A2540", "#00D4FF", "#FFB320", "#FFFFFF"]} />
              <div className="p-5 text-[11.5px]" style={{ fontFamily: MONO, color: SUB }}>
                <div className="flex justify-between">
                  <span>updated</span>
                  <span style={{ color: INK }}>5h ago · 1,240 votes</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <SectionLabel n="Index 01" t="Coverage breakdown" />
            <div className="mt-5 space-y-4 rounded-xl border bg-white p-6" style={{ borderColor: BORDER }}>
              {[
                ["Colors", 98],
                ["Typography", 92],
                ["Layout & spacing", 87],
                ["Elevation", 64],
                ["Shapes", 71],
                ["Components", 89],
                ["Dos & don'ts", 45],
              ].map(([l, s]) => (
                <CoverageBar key={l as string} label={l as string} score={s as number} />
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="lg:w-2/3 space-y-8">
          <div>
            <SectionLabel n="Index 02" t="The bundle" />
            <div className="mt-5 rounded-xl border bg-white overflow-hidden h-[500px] flex flex-col" style={{ borderColor: BORDER }}>
              <div className="flex border-b" style={{ borderColor: BORDER, background: BG_SOFT }}>
                <button className="px-5 py-3 text-[12.5px]" style={{ color: INK, borderBottom: `2px solid ${INK}`, fontFamily: MONO }}>
                  companion prompt
                </button>
                <button className="px-5 py-3 text-[12.5px]" style={{ color: SUB, fontFamily: MONO }}>
                  design.md
                </button>
                <div className="ml-auto flex items-center pr-5 text-[11px]" style={{ fontFamily: MONO, color: SUB }}>
                  342 lines
                </div>
              </div>
              <div className="p-6 flex-1 overflow-auto designmd-scrollbar" style={{ background: BG_SOFT }}>
                <pre className="text-[12.5px] leading-[1.7]" style={{ fontFamily: MONO, color: INK }}>
                  {codeSnippet}
                </pre>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button className="flex flex-col items-start gap-2 rounded-xl p-5 text-left text-white" style={{ background: INK }}>
              <Copy className="h-4 w-4" />
              <span className="text-[14px] font-medium">Copy bundle</span>
              <span className="text-[11.5px] opacity-70" style={{ fontFamily: MONO }}>prompt + md · 1,847 tokens</span>
            </button>
            <button className="flex flex-col items-start gap-2 rounded-xl bg-white p-5 text-left" style={{ border: `1px solid ${BORDER}`, color: INK }}>
              <Download className="h-4 w-4" />
              <span className="text-[14px] font-medium">Download</span>
              <span className="text-[11.5px]" style={{ fontFamily: MONO, color: SUB }}>.zip archive</span>
            </button>
            <button className="flex flex-col items-start gap-2 rounded-xl bg-white p-5 text-left" style={{ border: `1px solid ${BORDER}`, color: INK }}>
              <Terminal className="h-4 w-4" />
              <span className="text-[14px] font-medium">CLI install</span>
              <span className="text-[11.5px]" style={{ fontFamily: MONO, color: SUB }}>npx uiuxofai add stripe</span>
            </button>
          </div>

          <div>
            <SectionLabel n="Index 03" t="From the field" />
            <div className="mt-5 rounded-xl border p-6 space-y-5" style={{ borderColor: BORDER, background: BG_SOFT }}>
              <figure>
                <Quote className="h-3.5 w-3.5 mb-3" style={{ color: FAINT }} />
                <blockquote className="text-[16px] leading-[1.5]" style={{ fontFamily: SERIF, color: INK }}>
                  Nailed the container shadows and font weights. Claude produced perfect
                  Stripe cards on the first try.
                </blockquote>
                <figcaption className="mt-3 flex items-center gap-2 text-[11.5px]" style={{ fontFamily: MONO, color: SUB }}>
                  <ThumbsUp className="h-3 w-3" style={{ color: INK }} />
                  2 hours ago · Claude Project
                </figcaption>
              </figure>
              <div className="h-px" style={{ background: BORDER }} />
              <figure>
                <Quote className="h-3.5 w-3.5 mb-3" style={{ color: FAINT }} />
                <blockquote className="text-[16px] leading-[1.5]" style={{ fontFamily: SERIF, color: INK }}>
                  The primary button colour came back slightly off — closer to #6F66FF than
                  the spec's #635BFF.
                </blockquote>
                <figcaption className="mt-3 flex items-center gap-3 text-[11.5px]" style={{ fontFamily: MONO, color: SUB }}>
                  <ThumbsDown className="h-3 w-3" style={{ color: INK }} />
                  1 day ago · Lovable
                  <ChipPeach>colour drift</ChipPeach>
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
