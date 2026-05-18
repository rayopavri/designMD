import { ArrowRight, CheckCircle2, Copy, Layout, Sparkles } from "lucide-react";
import { Header } from "./_Shared";
import "./_group.css";

export function Homepage() {
  return (
    <div className="designmd-root">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="border-b border-[#E8E6DF]">
          <div className="mx-auto max-w-7xl px-6 py-24 lg:py-32">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 items-center">
              <div className="flex flex-col justify-center space-y-8">
                <div className="space-y-4">
                  <div className="inline-flex items-center rounded-full border border-[#E8E6DF] bg-white px-3 py-1 text-xs font-medium text-[#6B6A66]">
                    <Sparkles className="mr-2 h-3.5 w-3.5" />
                    Now supporting Claude Projects & Lovable
                  </div>
                  <h1 className="designmd-serif text-5xl font-medium leading-[1.1] text-[#111110] sm:text-6xl md:text-7xl">
                    Give AI your design system.
                  </h1>
                  <p className="max-w-[42rem] leading-relaxed text-[#6B6A66] sm:text-xl sm:leading-8">
                    UIUXofAi packages brand design systems into a structured <code className="designmd-mono text-sm bg-[#E8E6DF]/50 px-1.5 py-0.5 rounded text-[#111110]">design.md</code> spec and a calibrated companion prompt. Stop fighting hallucinations and start generating on-brand UI.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button className="inline-flex h-11 items-center justify-center rounded-md bg-[#111110] px-8 text-sm font-medium text-white shadow transition-colors hover:bg-[#111110]/90">
                    Explore the Library
                  </button>
                  <button className="inline-flex h-11 items-center justify-center rounded-md border border-[#E8E6DF] bg-white px-8 text-sm font-medium text-[#111110] shadow-sm transition-colors hover:bg-[#F4F3EE]">
                    Generate from URL
                  </button>
                </div>
              </div>
              
              {/* Extraction of the Week */}
              <div className="relative mx-auto w-full max-w-[500px] lg:max-w-none">
                <div className="flex items-center justify-between mb-3">
                  <span className="designmd-mono text-[11px] uppercase tracking-[0.14em] text-[#6B6A66]">
                    Extraction of the Week
                  </span>
                  <a href="#" className="designmd-mono text-[11px] uppercase tracking-[0.14em] text-[#111110] hover:underline">
                    View archive
                  </a>
                </div>
                <div className="rounded-xl border border-[#E8E6DF] bg-white shadow-xl shadow-black/5 overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-[#E8E6DF] bg-[#FDFCF8] px-4 py-3">
                    <div className="flex gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-red-400"></div>
                      <div className="h-3 w-3 rounded-full bg-amber-400"></div>
                      <div className="h-3 w-3 rounded-full bg-green-400"></div>
                    </div>
                    <div className="ml-4 flex h-6 flex-1 items-center justify-center rounded bg-white border border-[#E8E6DF] text-xs text-[#6B6A66] designmd-mono">
                      https://linear.app
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="font-semibold text-[#111110]">Linear</h3>
                        <p className="text-sm text-[#6B6A66]">Extracted 2 hours ago</p>
                      </div>
                      <div className="flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700 border border-green-200">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        98% Coverage
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-medium text-[#6B6A66]">
                          <span>Typography</span>
                          <span className="designmd-mono text-[#111110]">Inter</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-[#E8E6DF] overflow-hidden">
                          <div className="h-full bg-[#111110] w-[95%]"></div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-medium text-[#6B6A66]">
                          <span>Colors</span>
                          <div className="flex gap-1">
                            <div className="h-4 w-4 rounded-sm bg-[#5E6AD2]"></div>
                            <div className="h-4 w-4 rounded-sm bg-[#1A1A1A]"></div>
                            <div className="h-4 w-4 rounded-sm bg-[#F4F4F5]"></div>
                          </div>
                        </div>
                        <div className="h-2 w-full rounded-full bg-[#E8E6DF] overflow-hidden">
                          <div className="h-full bg-[#111110] w-[100%]"></div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-medium text-[#6B6A66]">
                          <span>Layout & Elevation</span>
                          <span className="designmd-mono text-[#111110]">8pt / Soft shadow</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-[#E8E6DF] overflow-hidden">
                          <div className="h-full bg-[#111110] w-[88%]"></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-8 rounded-lg bg-[#FDFCF8] p-4 border border-[#E8E6DF]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-[#111110]">Bundle Ready</span>
                        <span className="text-xs text-[#6B6A66] designmd-mono">342 tokens</span>
                      </div>
                      <button className="w-full flex items-center justify-center gap-2 rounded-md bg-[#111110] py-2 text-sm font-medium text-white transition-colors hover:bg-[#111110]/90">
                        <Copy className="h-4 w-4" />
                        Copy for Claude
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Categories Section */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex items-center justify-between mb-10">
              <h2 className="designmd-serif text-3xl font-medium text-[#111110]">Browse by Aesthetic</h2>
              <a href="#" className="text-sm font-medium text-[#111110] flex items-center hover:underline">
                View all categories <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: "Enterprise", desc: "High density, clear hierarchy", color: "bg-blue-600" },
                { name: "Editorial", desc: "Serif pairing, generous spacing", color: "bg-stone-800" },
                { name: "Marketing SaaS", desc: "Vibrant, rounded, playful", color: "bg-violet-500" },
                { name: "Mobile-first", desc: "Large touch targets, tight", color: "bg-emerald-500" },
                { name: "Brutalist", desc: "Hard borders, strong contrast", color: "bg-red-600" },
                { name: "Minimal", desc: "Monochrome, high negative space", color: "bg-gray-300" },
                { name: "Developer Tools", desc: "Dark mode native, dense", color: "bg-slate-900" },
                { name: "Accessible", desc: "WCAG AAA, clear focus states", color: "bg-amber-500" },
              ].map((cat, i) => (
                <a key={i} href="#" className="group relative overflow-hidden rounded-xl border border-[#E8E6DF] bg-white p-6 transition-all hover:shadow-md hover:border-[#111110]">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-[#E8E6DF] bg-[#FDFCF8]">
                    <div className={`h-4 w-4 rounded-sm ${cat.color}`}></div>
                  </div>
                  <h3 className="font-semibold text-[#111110] mb-1">{cat.name}</h3>
                  <p className="text-xs text-[#6B6A66]">{cat.desc}</p>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>
      
      <footer className="border-t border-[#E8E6DF] bg-white py-12">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="designmd-serif text-xl font-bold text-[#111110]">UIUXofAi</span>
            <span className="text-sm text-[#6B6A66]">© 2024</span>
          </div>
          <div className="flex gap-6 text-sm text-[#6B6A66]">
            <a href="#" className="hover:text-[#111110]">Twitter</a>
            <a href="#" className="hover:text-[#111110]">GitHub</a>
            <a href="#" className="hover:text-[#111110]">uiuxskills.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
