import { CheckCircle2, ChevronRight, Copy, Download, Terminal, ThumbsDown, ThumbsUp } from "lucide-react";
import { Header, PaletteStrip, CoverageBar } from "./_Shared";
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
- surface: #F6F9FC
- primary: #635BFF
- text_main: #0A2540
- text_muted: #425466

## Spacing
- base_unit: 4px
- container_padding: 24px
`;

  return (
    <div className="designmd-root">
      <Header />
      
      {/* Breadcrumb */}
      <div className="border-b border-[#E8E6DF] bg-white">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center text-sm text-[#6B6A66]">
          <a href="#" className="hover:text-[#111110]">Library</a>
          <ChevronRight className="h-4 w-4 mx-2" />
          <a href="#" className="hover:text-[#111110]">Finance</a>
          <ChevronRight className="h-4 w-4 mx-2" />
          <span className="text-[#111110] font-medium">Stripe</span>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-12 flex flex-col lg:flex-row gap-12 w-full">
        {/* Left Col: Info & Coverage */}
        <div className="lg:w-1/3 space-y-10">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-xl border border-[#E8E6DF] bg-white shadow-sm">
              <PaletteStrip colors={["#635BFF", "#0A2540", "#00D4FF", "#FFB320", "#FFFFFF"]} />
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h1 className="designmd-serif text-3xl font-bold text-[#111110]">Stripe</h1>
                  <div className="flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-sm font-medium text-green-700 border border-green-200">
                    <CheckCircle2 className="h-4 w-4" />
                    98%
                  </div>
                </div>
                <p className="text-[#6B6A66] mb-6">Vibrant, angled, modern finance UI. Excellent for SaaS dashboards and high-conversion payment flows.</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-md bg-[#111110] text-white px-2 py-1">Claude</span>
                  <span className="rounded-md bg-[#F4F3EE] text-[#111110] border border-[#E8E6DF] px-2 py-1">Cursor</span>
                  <span className="rounded-md bg-[#F4F3EE] text-[#111110] border border-[#E8E6DF] px-2 py-1">Lovable</span>
                </div>
                <div className="mt-6 text-xs text-[#6B6A66]">
                  Updated 5 hours ago • 1,240 votes
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-[#111110] mb-4">Coverage Breakdown</h3>
              <div className="space-y-4 rounded-xl border border-[#E8E6DF] bg-white p-6">
                <CoverageBar label="Colors" score={98} />
                <CoverageBar label="Typography" score={92} />
                <CoverageBar label="Layout/Spacing" score={87} />
                <CoverageBar label="Elevation" score={64} />
                <CoverageBar label="Shapes" score={71} />
                <CoverageBar label="Components" score={89} />
                <CoverageBar label="Dos & Don'ts" score={45} />
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Preview & Actions */}
        <div className="lg:w-2/3 space-y-6">
          <div className="rounded-xl border border-[#E8E6DF] bg-white overflow-hidden shadow-sm flex flex-col h-[500px]">
            <div className="flex border-b border-[#E8E6DF] bg-[#FDFCF8] px-4">
              <button className="px-4 py-3 text-sm font-medium border-b-2 border-[#111110] text-[#111110]">
                Companion prompt
              </button>
              <button className="px-4 py-3 text-sm font-medium text-[#6B6A66] hover:text-[#111110]">
                design.md
              </button>
            </div>
            <div className="p-6 bg-[#FAFAFA] flex-1 overflow-auto designmd-scrollbar">
              <pre className="designmd-mono text-sm text-[#111110]">
                {codeSnippet}
              </pre>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="flex flex-col items-center justify-center gap-2 rounded-xl bg-[#111110] p-4 text-white shadow transition-hover hover:bg-[#111110]/90">
              <Copy className="h-5 w-5" />
              <span className="font-medium text-sm">Copy Bundle</span>
              <span className="text-xs text-white/70">Prompt + MD (1,847 tokens)</span>
            </button>
            <button className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[#E8E6DF] bg-white p-4 text-[#111110] shadow-sm transition-hover hover:bg-[#F4F3EE]">
              <Download className="h-5 w-5" />
              <span className="font-medium text-sm">Download</span>
              <span className="text-xs text-[#6B6A66]">.zip archive</span>
            </button>
            <button className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[#E8E6DF] bg-white p-4 text-[#111110] shadow-sm transition-hover hover:bg-[#F4F3EE]">
              <Terminal className="h-5 w-5" />
              <span className="font-medium text-sm">CLI Install</span>
              <span className="text-xs text-[#6B6A66]">npx uiuxofai add stripe</span>
            </button>
          </div>

          {/* Feedback section */}
          <div className="mt-12 rounded-xl border border-[#E8E6DF] bg-[#FDFCF8] p-6">
            <h4 className="font-semibold text-[#111110] mb-4">Recent community feedback</h4>
            <div className="space-y-4">
              <div className="flex gap-4">
                <ThumbsUp className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm text-[#111110]">"Nailed the container shadows and font weights. Claude produced perfect Stripe cards on first try."</p>
                  <span className="text-xs text-[#6B6A66]">2 hours ago via Claude Project</span>
                </div>
              </div>
              <div className="flex gap-4">
                <ThumbsDown className="h-5 w-5 text-red-500 shrink-0" />
                <div>
                  <p className="text-sm text-[#111110]">"The primary button color was slightly off."</p>
                  <div className="mt-1 flex gap-2">
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">Colors off</span>
                  </div>
                  <span className="text-xs text-[#6B6A66] mt-1 block">1 day ago via Lovable</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}