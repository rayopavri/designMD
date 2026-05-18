import { CheckCircle2, ChevronDown, Clock, Filter, X } from "lucide-react";
import { Header, PaletteStrip } from "./Shared";
import "./_group.css";

const bundles = [
  { name: "IBM Carbon", desc: "Blue/black enterprise density", colors: ["#0F62FE", "#161616", "#393939", "#8D8D8D", "#F4F4F4"], vote: 96, updated: "2d ago", tools: ["Claude", "Cursor"] },
  { name: "Material 3", desc: "Expressive, rounded, playful", colors: ["#6750A4", "#1C1B1F", "#49454F", "#CAC4D0", "#FEF7FF"], vote: 92, updated: "1w ago", tools: ["Claude", "Lovable"] },
  { name: "Stripe", desc: "Vibrant modern finance", colors: ["#635BFF", "#0A2540", "#00D4FF", "#FFB320", "#FFFFFF"], vote: 98, updated: "5h ago", tools: ["Claude", "Cursor", "Lovable"] },
  { name: "Linear", desc: "Precise, dark mode native", colors: ["#5E6AD2", "#1A1A1A", "#2C2C2C", "#8A8F98", "#F4F4F5"], vote: 99, updated: "1d ago", tools: ["Claude"] },
  { name: "Vercel", desc: "Monochrome minimal", colors: ["#000000", "#333333", "#666666", "#EAEAEA", "#FFFFFF"], vote: 95, updated: "3d ago", tools: ["Claude", "Cursor", "Make"] },
  { name: "Shopify Polaris", desc: "Accessible e-commerce utility", colors: ["#008060", "#202223", "#6D7175", "#E4E5E7", "#F4F6F8"], vote: 91, updated: "2w ago", tools: ["Claude", "Lovable"] },
  { name: "Atlassian Design", desc: "Collaborative, warm enterprise", colors: ["#0052CC", "#172B4D", "#5E6C84", "#DFE1E6", "#FAFBFC"], vote: 88, updated: "1m ago", tools: ["Claude"] },
  { name: "Notion", desc: "Clean, block-based, minimal", colors: ["#000000", "#37352F", "#787774", "#EAEAEA", "#FFFFFF"], vote: 94, updated: "4d ago", tools: ["Claude", "Cursor"] },
  { name: "Tailwind UI", desc: "Utility-first standard", colors: ["#4F46E5", "#111827", "#4B5563", "#E5E7EB", "#F9FAFB"], vote: 97, updated: "12h ago", tools: ["All"] },
];

export function LibraryResults() {
  return (
    <div className="designmd-root">
      <Header />
      
      <div className="flex flex-1 max-w-7xl w-full mx-auto px-6 py-8 gap-8">
        {/* Sidebar Filters */}
        <aside className="w-64 shrink-0 space-y-8 hidden md:block">
          <div>
            <h3 className="text-sm font-semibold text-[#111110] mb-4 flex items-center gap-2">
              <Filter className="h-4 w-4" /> Active Filters
            </h3>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#E8E6DF] px-3 py-1 text-xs font-medium text-[#111110]">
                Dashboard <X className="h-3 w-3 cursor-pointer hover:text-red-500" />
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#E8E6DF] px-3 py-1 text-xs font-medium text-[#111110]">
                Claude <X className="h-3 w-3 cursor-pointer hover:text-red-500" />
              </span>
            </div>
          </div>
          
          <div className="space-y-6">
            <div>
              <h4 className="text-xs font-semibold text-[#111110] uppercase tracking-wider mb-3">Coverage Score</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-[#6B6A66]"><input type="checkbox" className="rounded border-[#E8E6DF]" /> 90%+ Coverage</label>
                <label className="flex items-center gap-2 text-sm text-[#6B6A66]"><input type="checkbox" className="rounded border-[#E8E6DF]" /> 80%+ Coverage</label>
              </div>
            </div>
            
            <div>
              <h4 className="text-xs font-semibold text-[#111110] uppercase tracking-wider mb-3">Vote Rate</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-[#6B6A66]"><input type="checkbox" defaultChecked className="rounded border-[#E8E6DF]" /> 90%+ Working</label>
                <label className="flex items-center gap-2 text-sm text-[#6B6A66]"><input type="checkbox" className="rounded border-[#E8E6DF]" /> 80%+ Working</label>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-[#111110] uppercase tracking-wider mb-3">AI Tool</h4>
              <div className="space-y-2">
                {["Claude", "Cursor", "Lovable", "Figma Make"].map(t => (
                  <label key={t} className="flex items-center gap-2 text-sm text-[#6B6A66]">
                    <input type="checkbox" className="rounded border-[#E8E6DF]" /> {t}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-semibold text-[#111110]">142 bundles</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <select className="h-9 appearance-none rounded-md border border-[#E8E6DF] bg-white pl-4 pr-8 text-sm text-[#111110] outline-none hover:border-[#111110]">
                  <option>Most popular</option>
                  <option>Highest rated</option>
                  <option>Recently updated</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-[#6B6A66] pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {bundles.map((bundle, i) => (
              <div key={i} className="group overflow-hidden rounded-xl border border-[#E8E6DF] bg-white transition-all hover:shadow-md hover:border-[#111110]">
                <PaletteStrip colors={bundle.colors} />
                <div className="p-5 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-[#111110] text-lg">{bundle.name}</h3>
                    <div className="flex items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700 border border-green-200" title={`${bundle.vote}% of users reported success`}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {bundle.vote}%
                    </div>
                  </div>
                  <p className="text-sm text-[#6B6A66] mb-5 flex-1">{bundle.desc}</p>
                  
                  <div className="flex flex-col gap-3 mt-auto pt-4 border-t border-[#E8E6DF]">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex gap-1.5">
                        {bundle.tools.map(t => (
                          <span key={t} className="rounded bg-[#F4F3EE] px-1.5 py-0.5 text-[#6B6A66]">{t}</span>
                        ))}
                      </div>
                      <span className="flex items-center text-[#6B6A66]"><Clock className="mr-1 h-3 w-3" /> {bundle.updated}</span>
                    </div>
                    
                    <div className="h-1.5 w-full rounded-full bg-[#E8E6DF] overflow-hidden" title="89% average section coverage">
                      <div className="h-full bg-[#111110] w-[89%]"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}