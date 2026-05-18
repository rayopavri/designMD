import { ChevronDown, Clock, Filter, X } from "lucide-react";
import { Header, SectionLabel, PaletteStrip, ChipLime, BG, INK, SUB, FAINT, BORDER, SERIF, MONO } from "./_Shared";
import "./_group.css";

const bundles = [
  { name: "IBM Carbon", num: "039", desc: "Blue/black enterprise density", colors: ["#0F62FE", "#161616", "#393939", "#8D8D8D", "#F4F4F4"], vote: 96, updated: "2d ago", tools: ["Claude", "Cursor"] },
  { name: "Material 3", num: "036", desc: "Expressive, rounded, playful", colors: ["#6750A4", "#1C1B1F", "#49454F", "#CAC4D0", "#FEF7FF"], vote: 92, updated: "1w ago", tools: ["Claude", "Lovable"] },
  { name: "Stripe", num: "041", desc: "Vibrant modern finance", colors: ["#635BFF", "#0A2540", "#00D4FF", "#FFB320", "#FFFFFF"], vote: 98, updated: "5h ago", tools: ["Claude", "Cursor", "Lovable"] },
  { name: "Linear", num: "042", desc: "Precise · dark-mode native", colors: ["#5E6AD2", "#1A1A1A", "#2C2C2C", "#8A8F98", "#F4F4F5"], vote: 99, updated: "1d ago", tools: ["Claude"] },
  { name: "Vercel", num: "037", desc: "Monochrome minimal", colors: ["#000000", "#333333", "#666666", "#EAEAEA", "#FFFFFF"], vote: 95, updated: "3d ago", tools: ["Claude", "Cursor", "Make"] },
  { name: "Shopify Polaris", num: "034", desc: "Accessible e-commerce utility", colors: ["#008060", "#202223", "#6D7175", "#E4E5E7", "#F4F6F8"], vote: 91, updated: "2w ago", tools: ["Claude", "Lovable"] },
  { name: "Atlassian", num: "035", desc: "Collaborative · warm enterprise", colors: ["#0052CC", "#172B4D", "#5E6C84", "#DFE1E6", "#FAFBFC"], vote: 88, updated: "1m ago", tools: ["Claude"] },
  { name: "Notion", num: "040", desc: "Clean · block-based · calm", colors: ["#000000", "#37352F", "#787774", "#EAEAEA", "#FFFFFF"], vote: 94, updated: "4d ago", tools: ["Claude", "Cursor"] },
  { name: "Tailwind UI", num: "033", desc: "Utility-first standard", colors: ["#4F46E5", "#111827", "#4B5563", "#E5E7EB", "#F9FAFB"], vote: 97, updated: "12h ago", tools: ["All"] },
];

export function LibraryResults() {
  return (
    <div className="designmd-root">
      <Header active="Plates" />

      <div className="flex flex-1 max-w-7xl w-full mx-auto px-10 py-12 gap-12" style={{ background: BG }}>
        {/* Sidebar */}
        <aside className="w-64 shrink-0 space-y-10 hidden md:block">
          <div>
            <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] mb-4" style={{ fontFamily: MONO, color: SUB }}>
              <Filter className="h-3 w-3" />
              Active filters
            </div>
            <div className="flex flex-wrap gap-2">
              {["Dashboard", "Claude"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px]" style={{ border: `1px solid ${BORDER}`, background: "#101012", color: INK }}>
                  {t}
                  <X className="h-3 w-3 cursor-pointer" style={{ color: SUB }} />
                </span>
              ))}
            </div>
          </div>

          {[
            { label: "Coverage score", options: ["90%+ coverage", "80%+ coverage"] },
            { label: "Vote rate", options: ["90%+ working", "80%+ working"] },
            { label: "Model", options: ["Claude", "Cursor", "Lovable", "Figma Make"] },
          ].map((f) => (
            <div key={f.label}>
              <div className="text-[10.5px] uppercase tracking-[0.22em] mb-4" style={{ fontFamily: MONO, color: SUB }}>
                {f.label}
              </div>
              <div className="space-y-2.5">
                {f.options.map((opt) => (
                  <label key={opt} className="flex items-center gap-2.5 text-[13px]" style={{ color: INK }}>
                    <input type="checkbox" className="h-3.5 w-3.5 accent-[#1A1714]" />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </aside>

        <main className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <SectionLabel n="Index 02" t="Spring 2026" />
              <h1 className="mt-3 text-[44px] leading-[1.05] font-medium" style={{ fontFamily: SERIF, color: INK }}>
                <span>142</span>{" "}
                <span style={{ color: "#8E8E94" }}>plates in stock.</span>
              </h1>
            </div>
            <div className="relative">
              <select className="h-9 appearance-none rounded-full bg-[#101012] pl-4 pr-9 text-[13px] outline-none" style={{ border: `1px solid ${BORDER}`, color: INK }}>
                <option>Most popular</option>
                <option>Highest rated</option>
                <option>Recently updated</option>
              </select>
              <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 pointer-events-none" style={{ color: SUB }} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {bundles.map((b) => (
              <a key={b.name} href="#" className="group block rounded-xl border bg-[#101012] overflow-hidden hover:bg-[#15151A] transition-colors" style={{ borderColor: BORDER }}>
                <PaletteStrip colors={b.colors} />
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase tracking-[0.18em]" style={{ fontFamily: MONO, color: SUB }}>
                      № {b.num}
                    </span>
                    <ChipLime>{b.vote}% working</ChipLime>
                  </div>
                  <div className="text-[20px] mb-1" style={{ fontFamily: SERIF, color: INK }}>{b.name}</div>
                  <p className="text-[13px] leading-[1.55]" style={{ color: SUB }}>{b.desc}</p>

                  <div className="mt-5 pt-4 border-t flex items-center justify-between text-[11.5px]" style={{ borderColor: BORDER, fontFamily: MONO, color: SUB }}>
                    <div className="flex gap-1">
                      {b.tools.map((t) => (
                        <span key={t} className="px-1.5 py-0.5 rounded" style={{ background: "#15151A", color: INK }}>
                          {t.toLowerCase()}
                        </span>
                      ))}
                    </div>
                    <span className="inline-flex items-center gap-1" style={{ color: FAINT }}>
                      <Clock className="h-3 w-3" />
                      {b.updated}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
