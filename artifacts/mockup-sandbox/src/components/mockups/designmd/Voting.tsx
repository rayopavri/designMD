import { Check, Info, X } from "lucide-react";
import { Header, PaletteStrip } from "./Shared";
import "./_group.css";

export function Voting() {
  return (
    <div className="designmd-root bg-[#FDFCF8]">
      <Header />
      
      <main className="flex-1 flex justify-center max-w-5xl mx-auto px-6 py-12 w-full gap-12">
        <div className="max-w-xl w-full">
          {/* Bundle Context */}
          <div className="mb-8 rounded-xl border border-[#E8E6DF] bg-white overflow-hidden shadow-sm">
            <PaletteStrip colors={["#FF4F00", "#1A1A1A", "#F4F4F4"]} />
            <div className="px-6 py-4 flex justify-between items-center bg-[#FAFAFA]">
              <span className="font-bold text-[#111110]">Y Combinator</span>
              <span className="text-xs text-[#6B6A66] designmd-mono">ID: 8a9b2c</span>
            </div>
          </div>

          <div className="text-center mb-10">
            <h1 className="designmd-serif text-3xl font-bold text-[#111110] mb-2">Did this bundle produce correct output?</h1>
            <p className="text-[#6B6A66]">Your vote calibrates the companion prompt for everyone.</p>
          </div>

          {/* Voting Buttons */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <button className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[#E8E6DF] bg-white p-6 transition-colors hover:border-green-500 hover:bg-green-50">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <span className="font-medium text-[#111110]">Yes, it worked</span>
            </button>
            
            <button className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-red-500 bg-red-50 p-6 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <X className="h-6 w-6 text-red-600" />
              </div>
              <span className="font-medium text-red-900">No, something was off</span>
            </button>
          </div>

          {/* Expanded Negative Feedback State */}
          <div className="rounded-xl border border-[#E8E6DF] bg-white p-8 shadow-sm">
            <h3 className="font-semibold text-[#111110] mb-4">What went wrong?</h3>
            <div className="flex flex-wrap gap-2 mb-6">
              {[
                "Colors were off", 
                "Typography ignored", 
                "Spacing wrong", 
                "Too generic", 
                "Components missing", 
                "Other"
              ].map((tag, i) => (
                <button 
                  key={tag} 
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    i === 0 ? "bg-red-100 text-red-800 border-red-200" : "bg-[#FDFCF8] text-[#6B6A66] border-[#E8E6DF] hover:border-[#111110]"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-[#111110] mb-2">Context (optional)</label>
              <textarea 
                className="w-full rounded-md border border-[#E8E6DF] p-3 text-sm outline-none focus:border-[#111110] focus:ring-1 focus:ring-[#111110] resize-none h-24" 
                placeholder="E.g. It used #FF0000 instead of the official #FF4F00 for the primary button."
                defaultValue="It used #FF0000 instead of the official #FF4F00 for the primary button."
              ></textarea>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-medium text-[#111110] mb-2">Which AI tool did you use?</label>
              <select className="w-full rounded-md border border-[#E8E6DF] p-3 text-sm outline-none focus:border-[#111110] focus:ring-1 focus:ring-[#111110] bg-white">
                <option>Claude Projects</option>
                <option>Cursor</option>
                <option>Lovable</option>
                <option>Figma Make</option>
              </select>
            </div>

            <button className="w-full rounded-md bg-[#111110] py-3 text-sm font-medium text-white transition-colors hover:bg-[#111110]/90">
              Submit Feedback
            </button>
          </div>
        </div>

        {/* Context Panel */}
        <div className="hidden lg:block w-72 space-y-6">
          <div className="rounded-xl border border-[#E8E6DF] bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3 mb-4">
              <Info className="h-5 w-5 text-[#2563EB] shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-[#111110] text-sm">Editorial Queue</h4>
                <p className="text-xs text-[#6B6A66] mt-1 leading-relaxed">Your vote feeds the editorial queue. Bundles below 60% are auto-flagged for review by our curation team.</p>
              </div>
            </div>
            
            <div className="mt-6 border-t border-[#E8E6DF] pt-6">
              <h4 className="text-xs font-semibold text-[#111110] uppercase tracking-wider mb-4">Recent Feedback</h4>
              <div className="space-y-4">
                <div className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <X className="h-3 w-3 text-red-500" />
                    <span className="font-medium text-[#111110]">Typography ignored</span>
                  </div>
                  <span className="text-xs text-[#6B6A66]">10 mins ago • Cursor</span>
                </div>
                <div className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Check className="h-3 w-3 text-green-500" />
                    <span className="font-medium text-[#111110]">Worked perfectly</span>
                  </div>
                  <span className="text-xs text-[#6B6A66]">1 hour ago • Claude</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}