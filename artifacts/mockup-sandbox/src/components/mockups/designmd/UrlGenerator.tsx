import { CheckCircle2, Circle, Loader2, Sparkles } from "lucide-react";
import { Header, PaletteStrip, CoverageBar } from "./_Shared";
import "./_group.css";

export function UrlGenerator() {
  return (
    <div className="designmd-root bg-[#FDFCF8]">
      <Header />
      
      <main className="flex-1 flex flex-col items-center max-w-5xl mx-auto px-6 py-20 w-full">
        <div className="w-full text-center mb-12">
          <h1 className="designmd-serif text-4xl font-bold text-[#111110] mb-4">Extract any brand's design system</h1>
          <p className="text-[#6B6A66] text-lg max-w-2xl mx-auto">Paste a URL. We'll scrape it, extract the tokens, generate a companion prompt, and score the coverage in about 12 seconds.</p>
        </div>

        {/* Input Area */}
        <div className="w-full max-w-3xl relative mb-16">
          <input
            type="url"
            value="https://nytimes.com"
            readOnly
            className="w-full h-16 rounded-xl border-2 border-[#111110] bg-white pl-6 pr-32 text-lg text-[#111110] shadow-sm outline-none font-mono"
          />
          <button className="absolute right-2 top-2 bottom-2 rounded-lg bg-[#2563EB] px-6 text-sm font-medium text-white transition-colors hover:bg-[#2563EB]/90 flex items-center gap-2 disabled:opacity-50">
            <Loader2 className="h-4 w-4 animate-spin" />
            Extracting
          </button>
        </div>

        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Progress Tracker */}
          <div className="space-y-8 bg-white rounded-xl border border-[#E8E6DF] p-8 shadow-sm">
            <h3 className="font-semibold text-[#111110] mb-6">Extraction Pipeline</h3>
            
            <div className="relative space-y-6 before:absolute before:inset-0 before:ml-3 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-[#E8E6DF]">
              <div className="relative flex items-center gap-4">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600 ring-4 ring-white z-10">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-[#111110]">Scraping via Firecrawl</h4>
                  <p className="text-xs text-[#6B6A66]">Fetched 14 pages • 2.4s</p>
                </div>
              </div>
              
              <div className="relative flex items-center gap-4">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600 ring-4 ring-white z-10">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-[#111110]">Extracting tokens (Gemini Flash)</h4>
                  <p className="text-xs text-[#6B6A66]">Found 12 colors, 3 fonts • 3.1s</p>
                </div>
              </div>

              <div className="relative flex items-center gap-4">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 ring-4 ring-white z-10 animate-pulse">
                  <Sparkles className="h-3 w-3" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-[#111110]">Writing companion prompt (Claude Sonnet)</h4>
                  <p className="text-xs text-[#2563EB]">Calibrating constraints... • 4.2s</p>
                </div>
              </div>

              <div className="relative flex items-center gap-4 opacity-40">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E8E6DF] ring-4 ring-white z-10">
                  <Circle className="h-3 w-3 text-[#6B6A66]" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-[#111110]">Scoring coverage</h4>
                  <p className="text-xs text-[#6B6A66]">Pending</p>
                </div>
              </div>

              <div className="relative flex items-center gap-4 opacity-40">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E8E6DF] ring-4 ring-white z-10">
                  <Circle className="h-3 w-3 text-[#6B6A66]" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-[#111110]">Bundle ready</h4>
                  <p className="text-xs text-[#6B6A66]">Pending</p>
                </div>
              </div>
            </div>
          </div>

          {/* Early Preview */}
          <div className="bg-white rounded-xl border border-[#E8E6DF] overflow-hidden shadow-sm flex flex-col">
            <div className="bg-[#111110] text-white px-6 py-3 text-sm font-medium flex justify-between items-center">
              <span>Early Preview</span>
              <span className="text-xs text-white/50 designmd-mono">nytimes.com</span>
            </div>
            
            <div className="p-6 flex-1 flex flex-col gap-6">
              <div>
                <h4 className="text-xs font-semibold text-[#6B6A66] uppercase tracking-wider mb-2">Detected Palette</h4>
                <div className="h-12 w-full rounded overflow-hidden flex shadow-inner">
                  <div className="flex-1 bg-[#000000]"></div>
                  <div className="flex-1 bg-[#333333]"></div>
                  <div className="flex-1 bg-[#E2E2E2]"></div>
                  <div className="flex-1 bg-[#F4F4F4]"></div>
                  <div className="flex-1 bg-[#FFFFFF]"></div>
                </div>
              </div>
              
              <div>
                <h4 className="text-xs font-semibold text-[#6B6A66] uppercase tracking-wider mb-2">Detected Typography</h4>
                <div className="space-y-3">
                  <div className="p-3 rounded bg-[#FDFCF8] border border-[#E8E6DF]">
                    <span className="font-serif text-lg text-[#111110] block mb-1">Cheltenham</span>
                    <span className="text-xs text-[#6B6A66] designmd-mono">Primary Serif / Headlines</span>
                  </div>
                  <div className="p-3 rounded bg-[#FDFCF8] border border-[#E8E6DF]">
                    <span className="font-sans text-lg text-[#111110] block mb-1">NYT Franklin</span>
                    <span className="text-xs text-[#6B6A66] designmd-mono">Primary Sans / UI</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-auto pt-4 border-t border-[#E8E6DF] opacity-30">
                <CoverageBar label="Estimated Coverage" score={85} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}