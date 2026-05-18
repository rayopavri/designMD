import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Header, PaletteStrip } from "./_Shared";
import "./_group.css";

export function GuidedDiscovery() {
  const [selectedType, setSelectedType] = useState<string>("Dashboard");
  const [selectedFeel, setSelectedFeel] = useState<string>("Minimal");
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

  return (
    <div className="designmd-root">
      <Header />
      
      <main className="flex-1 mx-auto max-w-4xl px-6 py-16 w-full">
        <div className="text-center mb-16">
          <h1 className="designmd-serif text-4xl font-medium text-[#111110] mb-4">Find your starting point</h1>
          <p className="text-[#6B6A66] text-lg">Tell us what you're building, and we'll find the right design system.</p>
        </div>

        <div className="space-y-12">
          {/* Question 1 */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[#111110] uppercase tracking-wider">What are you designing?</h2>
            <div className="flex flex-wrap gap-3">
              {types.map(type => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-5 py-2.5 rounded-full text-sm font-medium border transition-colors ${
                    selectedType === type
                      ? "bg-[#111110] text-white border-[#111110]"
                      : "bg-white text-[#6B6A66] border-[#E8E6DF] hover:border-[#111110] hover:text-[#111110]"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Question 2 */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[#111110] uppercase tracking-wider">What feel are you going for?</h2>
            <div className="flex flex-wrap gap-3">
              {feels.map(feel => (
                <button
                  key={feel}
                  onClick={() => setSelectedFeel(feel)}
                  className={`px-5 py-2.5 rounded-full text-sm font-medium border transition-colors ${
                    selectedFeel === feel
                      ? "bg-[#111110] text-white border-[#111110]"
                      : "bg-white text-[#6B6A66] border-[#E8E6DF] hover:border-[#111110] hover:text-[#111110]"
                  }`}
                >
                  {feel}
                </button>
              ))}
            </div>
          </div>

          {/* Question 3 */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[#111110] uppercase tracking-wider">Which AI tool?</h2>
            <div className="flex flex-wrap gap-3">
              {tools.map(tool => (
                <button
                  key={tool}
                  onClick={() => setSelectedTool(tool)}
                  className={`px-5 py-2.5 rounded-full text-sm font-medium border transition-colors ${
                    selectedTool === tool
                      ? "bg-[#111110] text-white border-[#111110]"
                      : "bg-white text-[#6B6A66] border-[#E8E6DF] hover:border-[#111110] hover:text-[#111110]"
                  }`}
                >
                  {tool}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="mt-20 pt-12 border-t border-[#E8E6DF]">
          <div className="flex items-center justify-between mb-8">
            <h3 className="designmd-serif text-2xl font-medium text-[#111110]">
              <span className="text-[#2563EB]">{matchCount}</span> bundles match
            </h3>
            <button className="text-sm font-medium text-[#111110] hover:underline">View all results →</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: "Vercel", desc: "Monochrome, high contrast, clean", colors: ["#000000", "#333333", "#666666", "#EAEAEA", "#FFFFFF"] },
              { name: "Linear", desc: "Dark mode native, precise, violet accents", colors: ["#5E6AD2", "#1A1A1A", "#2C2C2C", "#8A8F98", "#F4F4F5"] },
              { name: "Stripe", desc: "Vibrant, angled, modern finance", colors: ["#635BFF", "#0A2540", "#00D4FF", "#FFB320", "#FFFFFF"] }
            ].map((bundle, i) => (
              <div key={i} className="group overflow-hidden rounded-xl border border-[#E8E6DF] bg-white transition-all hover:shadow-md hover:border-[#111110]">
                <PaletteStrip colors={bundle.colors} />
                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-[#111110]">{bundle.name}</h4>
                    <div className="flex items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700 border border-green-200">
                      <CheckCircle2 className="h-3 w-3" />
                      94%
                    </div>
                  </div>
                  <p className="text-sm text-[#6B6A66] mb-4 line-clamp-2">{bundle.desc}</p>
                  <button className="w-full rounded-md border border-[#E8E6DF] py-2 text-xs font-medium text-[#111110] transition-colors group-hover:bg-[#111110] group-hover:text-white">
                    View Bundle
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}