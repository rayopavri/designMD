import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Header, SectionLabel, PaletteStrip, ChipLime, BG, INK, SUB, BORDER, SERIF, MONO } from "./_Shared";
import "./_group.css";

export function GuidedDiscovery() {
  const [selectedType, setSelectedType] = useState<string>("Dashboard");
  const [selectedFeel, setSelectedFeel] = useState<string>("Editorial");
  const [selectedTool, setSelectedTool] = useState<string>("Claude");

  const types = ["Dashboard", "Landing page", "Mobile app", "Marketing site", "Internal tool", "Docs site"];
  const feels = ["Minimal", "Editorial", "Bold", "Playful", "Brutalist", "Corporate", "Warm"];
  const tools = ["Claude", "Cursor", "Lovable", "Figma Make", "All"];

  const typeWeight: Record<string, number> = {
    Dashboard: 96, "Landing page": 134, "Mobile app": 71, "Marketing site": 118, "Internal tool": 58, "Docs site": 42,
  };
  const feelWeight: Record<string, number> = {
    Minimal: 1.4, Editorial: 0.9, Bold: 1.1, Playful: 0.6, Brutalist: 0.4, Corporate: 1.0, Warm: 0.7,
  };
  const toolWeight: Record<string, number> = {
    Claude: 0.95, Cursor: 0.78, Lovable: 0.62, "Figma Make": 0.55, All: 1.0,
  };
  const matchCount = Math.max(
    3,
    Math.round((typeWeight[selectedType] ?? 80) * (feelWeight[selectedFeel] ?? 1) * (toolWeight[selectedTool] ?? 1)),
  );

  function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
      <button
        onClick={onClick}
        className="h-9 rounded-full px-4 text-[13px] transition-colors"
        style={
          active
            ? { background: INK, color: "white", border: `1px solid ${INK}` }
            : { background: "white", color: INK, border: `1px solid ${BORDER}` }
        }
      >
        {children}
      </button>
    );
  }

  return (
    <div className="designmd-root">
      <Header active="Generate" />

      <main className="flex-1 mx-auto max-w-4xl px-10 py-20 w-full" style={{ background: BG }}>
        <div className="text-center mb-16">
          <SectionLabel n="Index 01" t="Find your starting point" />
          <h1 className="mt-5 text-[64px] leading-[1.02] font-normal" style={{ fontFamily: SERIF, color: INK }}>
            What are you<br />
            <em className="font-normal" style={{ fontStyle: "italic" }}>setting in type?</em>
          </h1>
          <p className="mt-6 mx-auto max-w-[36rem] text-[15.5px] leading-[1.6]" style={{ color: SUB }}>
            Three questions, then we'll point you at the plate that's most likely to land the
            piece on first paste.
          </p>
        </div>

        <div className="space-y-12">
          {[
            { num: "Index 02", question: "What are you designing?", options: types, sel: selectedType, set: setSelectedType },
            { num: "Index 03", question: "What feel are you after?", options: feels, sel: selectedFeel, set: setSelectedFeel },
            { num: "Index 04", question: "Which model are you using?", options: tools, sel: selectedTool, set: setSelectedTool },
          ].map((q) => (
            <div key={q.num} className="space-y-5">
              <SectionLabel n={q.num} t={q.question} />
              <div className="flex flex-wrap gap-2.5">
                {q.options.map((opt) => (
                  <Pill key={opt} active={q.sel === opt} onClick={() => q.set(opt)}>
                    {opt}
                  </Pill>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Results */}
        <div className="mt-20 pt-12 border-t" style={{ borderColor: BORDER }}>
          <div className="flex items-end justify-between mb-10">
            <div>
              <SectionLabel n="Index 05" t="Plates for you" />
              <h2 className="mt-4 text-[40px] leading-[1.05] font-normal" style={{ fontFamily: SERIF, color: INK }}>
                <span>{matchCount}</span> plates,{" "}
                <em className="font-normal" style={{ fontStyle: "italic" }}>hand-picked.</em>
              </h2>
            </div>
            <a href="#" className="text-[13px] inline-flex items-center gap-1" style={{ color: INK }}>
              See all results <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: "Vercel", num: "037", desc: "Monochrome · high contrast · clean", colors: ["#000000", "#333333", "#666666", "#EAEAEA", "#FFFFFF"], cov: 94 },
              { name: "Linear", num: "042", desc: "Dark mode native · precise · violet accents", colors: ["#5E6AD2", "#1A1A1A", "#2C2C2C", "#8A8F98", "#F4F4F5"], cov: 98 },
              { name: "Stripe", num: "041", desc: "Vibrant · angled · modern finance", colors: ["#635BFF", "#0A2540", "#00D4FF", "#FFB320", "#FFFFFF"], cov: 96 },
            ].map((b) => (
              <a key={b.name} href="#" className="block rounded-xl border bg-white overflow-hidden hover:bg-[#FDFAF6] transition-colors" style={{ borderColor: BORDER }}>
                <PaletteStrip colors={b.colors} />
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase tracking-[0.18em]" style={{ fontFamily: MONO, color: SUB }}>
                      № {b.num}
                    </span>
                    <ChipLime>{b.cov}% coverage</ChipLime>
                  </div>
                  <div className="text-[22px] mb-1" style={{ fontFamily: SERIF, color: INK }}>{b.name}</div>
                  <p className="text-[13px] leading-[1.55]" style={{ color: SUB }}>{b.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
