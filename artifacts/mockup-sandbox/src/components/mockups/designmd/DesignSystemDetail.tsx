import { ArrowUpRight, CheckCircle2, Copy, Download, ExternalLink, GitBranch, Sparkles, Star } from "lucide-react";
import { Header, PaletteStrip, CoverageBar } from "./_Shared";
import "./_group.css";

const carbonPalette = ["#0F62FE", "#161616", "#393939", "#525252", "#8D8D8D", "#C6C6C6", "#E0E0E0", "#F4F4F4"];

const components = [
  { name: "Button", variants: 6, status: "Stable" },
  { name: "Data table", variants: 4, status: "Stable" },
  { name: "Form input", variants: 8, status: "Stable" },
  { name: "Modal", variants: 3, status: "Stable" },
  { name: "Notification", variants: 5, status: "Stable" },
  { name: "Tabs", variants: 3, status: "Stable" },
  { name: "Dropdown", variants: 4, status: "Stable" },
  { name: "Tag", variants: 7, status: "Stable" },
  { name: "Tile", variants: 4, status: "Beta" },
  { name: "Tooltip", variants: 2, status: "Stable" },
  { name: "Pagination", variants: 2, status: "Stable" },
  { name: "Breadcrumb", variants: 1, status: "Stable" },
];

const bundles = [
  { name: "Carbon · Productivity", desc: "Dense enterprise dashboards", tokens: 1842, coverage: 96 },
  { name: "Carbon · Public sector", desc: "Government & gov-tech sites", tokens: 1456, coverage: 92 },
  { name: "Carbon · AI surfaces", desc: "Watsonx + assistant patterns", tokens: 1120, coverage: 88 },
];

const changelog = [
  { version: "v11.42.0", date: "May 14, 2026", note: "Adds AI assistant surface tokens and updated focus rings." },
  { version: "v11.41.0", date: "Apr 28, 2026", note: "New data table density variant; tightened spacing scale." },
  { version: "v11.40.0", date: "Apr 09, 2026", note: "Color tokens for accessible dark mode pairings." },
];

export function DesignSystemDetail() {
  return (
    <div className="designmd-root bg-[#FDFCF8]">
      <Header />

      <main className="flex-1">
        {/* Breadcrumb */}
        <div className="mx-auto max-w-7xl px-6 pt-8">
          <nav className="designmd-mono text-[11px] uppercase tracking-[0.14em] text-[#6B6A66]">
            <a href="#" className="hover:text-[#111110]">Design systems</a>
            <span className="mx-2">/</span>
            <a href="#" className="hover:text-[#111110]">Enterprise</a>
            <span className="mx-2">/</span>
            <span className="text-[#111110]">IBM Carbon</span>
          </nav>
        </div>

        {/* Hero */}
        <section className="border-b border-[#E8E6DF]">
          <div className="mx-auto max-w-7xl px-6 py-12">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-12 items-start">
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#0F62FE] text-white designmd-serif text-xl font-bold">
                    C
                  </div>
                  <div className="designmd-mono text-[11px] uppercase tracking-[0.14em] text-[#6B6A66]">
                    Maintained by IBM · MIT license · v11.42.0
                  </div>
                </div>

                <h1 className="designmd-serif text-5xl font-bold text-[#111110] tracking-tight mb-4">
                  IBM Carbon
                </h1>
                <p className="text-[#3F3E3A] text-lg leading-relaxed max-w-2xl mb-6">
                  Carbon is IBM&rsquo;s open-source design system for products and digital experiences.
                  It pairs a dense, accessibility-first grid with the IBM Plex type family and a precise
                  industrial palette &mdash; the reference for enterprise software.
                </p>

                <div className="flex flex-wrap gap-2 mb-8">
                  {["Enterprise", "Dashboards", "Accessibility AA", "Dense", "Open source"].map((t) => (
                    <span
                      key={t}
                      className="px-3 py-1 rounded-full border border-[#E8E6DF] bg-white text-xs font-medium text-[#3F3E3A]"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button className="inline-flex h-11 items-center gap-2 rounded-md bg-[#111110] px-5 text-sm font-medium text-white hover:bg-[#111110]/90">
                    <Copy className="h-4 w-4" />
                    Copy design.md
                  </button>
                  <button className="inline-flex h-11 items-center gap-2 rounded-md border border-[#E8E6DF] bg-white px-5 text-sm font-medium text-[#111110] hover:bg-[#F4F3EE]">
                    <Download className="h-4 w-4" />
                    Download bundle
                  </button>
                  <a
                    href="#"
                    className="inline-flex h-11 items-center gap-2 px-2 text-sm font-medium text-[#111110] hover:underline"
                  >
                    carbondesignsystem.com
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              {/* Side stats */}
              <aside className="rounded-xl border border-[#E8E6DF] bg-white p-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="designmd-mono text-[11px] uppercase tracking-[0.14em] text-[#6B6A66] mb-1">
                      Coverage
                    </div>
                    <div className="designmd-serif text-3xl font-bold text-[#111110]">96%</div>
                  </div>
                  <div>
                    <div className="designmd-mono text-[11px] uppercase tracking-[0.14em] text-[#6B6A66] mb-1">
                      Tokens
                    </div>
                    <div className="designmd-serif text-3xl font-bold text-[#111110]">1,842</div>
                  </div>
                  <div>
                    <div className="designmd-mono text-[11px] uppercase tracking-[0.14em] text-[#6B6A66] mb-1">
                      Components
                    </div>
                    <div className="designmd-serif text-3xl font-bold text-[#111110]">62</div>
                  </div>
                  <div>
                    <div className="designmd-mono text-[11px] uppercase tracking-[0.14em] text-[#6B6A66] mb-1">
                      Last verified
                    </div>
                    <div className="designmd-serif text-3xl font-bold text-[#111110]">4d</div>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-[#E8E6DF] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-[#3F3E3A]">
                    <Star className="h-4 w-4 text-amber-500" fill="currentColor" />
                    <span className="font-medium text-[#111110]">94%</span>
                    <span className="text-[#6B6A66]">community vote</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[#6B6A66]">
                    <GitBranch className="h-3.5 w-3.5" />
                    312 forks
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* Body */}
        <section className="mx-auto max-w-7xl px-6 py-16 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-16">
          <div className="space-y-16">
            {/* Coverage breakdown */}
            <div>
              <h2 className="designmd-serif text-2xl font-medium text-[#111110] mb-2">Coverage breakdown</h2>
              <p className="text-sm text-[#6B6A66] mb-8">
                Scored against the designmd extraction rubric &mdash; what each surface area provides out of the box.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                <CoverageBar label="Color tokens" score={98} />
                <CoverageBar label="Typography scale" score={96} />
                <CoverageBar label="Spacing & grid" score={100} />
                <CoverageBar label="Elevation" score={92} />
                <CoverageBar label="Motion & easing" score={84} />
                <CoverageBar label="Iconography" score={95} />
                <CoverageBar label="Components" score={97} />
                <CoverageBar label="Accessibility" score={99} />
              </div>
            </div>

            {/* Palette */}
            <div>
              <h2 className="designmd-serif text-2xl font-medium text-[#111110] mb-2">Core palette</h2>
              <p className="text-sm text-[#6B6A66] mb-6">
                Eight foundation tokens. Full ramp ships with 110 steps across functional roles.
              </p>
              <div className="rounded-xl border border-[#E8E6DF] bg-white overflow-hidden">
                <PaletteStrip colors={carbonPalette} />
                <div className="grid grid-cols-4 md:grid-cols-8 divide-x divide-[#E8E6DF] border-t border-[#E8E6DF]">
                  {carbonPalette.map((c) => (
                    <div key={c} className="p-3 text-center">
                      <div className="designmd-mono text-[10px] uppercase tracking-[0.12em] text-[#6B6A66] mb-1">
                        {c}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Components grid */}
            <div>
              <div className="flex items-end justify-between mb-6">
                <div>
                  <h2 className="designmd-serif text-2xl font-medium text-[#111110] mb-2">Components</h2>
                  <p className="text-sm text-[#6B6A66]">62 total &mdash; showing the 12 most-used in extracted bundles.</p>
                </div>
                <a href="#" className="text-sm font-medium text-[#111110] hover:underline flex items-center gap-1">
                  View all <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {components.map((c) => (
                  <div
                    key={c.name}
                    className="rounded-lg border border-[#E8E6DF] bg-white p-4 flex items-center justify-between hover:border-[#111110] transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium text-[#111110]">{c.name}</div>
                      <div className="designmd-mono text-[10px] uppercase tracking-[0.12em] text-[#6B6A66] mt-0.5">
                        {c.variants} variants
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                        c.status === "Stable"
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Curated bundles */}
            <div>
              <h2 className="designmd-serif text-2xl font-medium text-[#111110] mb-2">Curated bundles</h2>
              <p className="text-sm text-[#6B6A66] mb-6">
                Pre-packaged design.md slices tuned for specific surfaces. Copy one directly into Claude or Cursor.
              </p>
              <div className="space-y-3">
                {bundles.map((b) => (
                  <div
                    key={b.name}
                    className="rounded-lg border border-[#E8E6DF] bg-white p-5 flex items-center justify-between hover:border-[#111110] transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-[#111110]">{b.name}</div>
                      <div className="text-sm text-[#6B6A66] mt-0.5">{b.desc}</div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="designmd-mono text-[11px] uppercase tracking-[0.14em] text-[#6B6A66]">
                          Tokens
                        </div>
                        <div className="text-sm font-medium text-[#111110]">{b.tokens.toLocaleString()}</div>
                      </div>
                      <div className="flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700 border border-green-200">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {b.coverage}%
                      </div>
                      <button className="inline-flex h-9 items-center gap-2 rounded-md bg-[#111110] px-3 text-xs font-medium text-white hover:bg-[#111110]/90">
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right rail */}
          <aside className="space-y-8">
            <div className="rounded-xl border border-[#E8E6DF] bg-white p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-[#2563EB]" />
                <h3 className="text-sm font-semibold text-[#111110]">Companion prompt</h3>
              </div>
              <p className="text-sm text-[#6B6A66] mb-4">
                Pairs with the design.md to keep Claude on-brand across long sessions.
              </p>
              <pre className="rounded-md bg-[#FAFAFA] border border-[#E8E6DF] p-3 text-[11px] designmd-mono text-[#3F3E3A] overflow-hidden whitespace-pre-wrap">
{`You are designing inside the IBM Carbon
system. Use the 8pt grid, Plex Sans for UI,
Plex Mono for code, and the IBM blue (#0F62FE)
as the only accent. Prefer density over
whitespace. Never invent components &mdash; reuse
what design.md declares.`}
              </pre>
              <button className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-md border border-[#E8E6DF] bg-white py-2 text-xs font-medium text-[#111110] hover:bg-[#F4F3EE]">
                <Copy className="h-3.5 w-3.5" />
                Copy prompt
              </button>
            </div>

            <div className="rounded-xl border border-[#E8E6DF] bg-white p-5">
              <h3 className="text-sm font-semibold text-[#111110] mb-4">Changelog</h3>
              <ol className="space-y-4">
                {changelog.map((c) => (
                  <li key={c.version} className="border-l-2 border-[#E8E6DF] pl-3">
                    <div className="flex items-baseline justify-between">
                      <span className="designmd-mono text-xs font-medium text-[#111110]">{c.version}</span>
                      <span className="designmd-mono text-[10px] uppercase tracking-[0.12em] text-[#6B6A66]">
                        {c.date}
                      </span>
                    </div>
                    <p className="text-xs text-[#3F3E3A] mt-1 leading-relaxed">{c.note}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-xl border border-[#E8E6DF] bg-[#FDFCF8] p-5">
              <h3 className="text-sm font-semibold text-[#111110] mb-3">Editorial notes</h3>
              <p className="text-xs text-[#3F3E3A] leading-relaxed">
                Verified May 14 by the designmd editorial team. Carbon scores highest of any enterprise
                system on accessibility and component completeness. Watch for slight drift in motion
                tokens when paired with the IBM AI patterns kit.
              </p>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
