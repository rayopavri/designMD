import { ArrowUpRight, ChevronRight, Copy, Download, ExternalLink, GitBranch, Quote, Star } from "lucide-react";
import { Header, SectionLabel, PaletteStrip, CoverageBar, ChipLime, ChipPeach, ChipLavender, BG, BG_SOFT, INK, SUB, FAINT, BORDER, BORDER_SOFT, SERIF, MONO } from "./_Shared";
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
    <div className="designmd-root">
      <Header active="Plates" />

      <main className="flex-1" style={{ background: BG }}>
        {/* Breadcrumb */}
        <div style={{ borderBottom: `1px solid ${BORDER_SOFT}` }}>
          <div className="mx-auto max-w-7xl px-10 py-4 flex items-center text-[11.5px]" style={{ fontFamily: MONO, color: SUB }}>
            <a href="#">Design systems</a>
            <ChevronRight className="h-3 w-3 mx-2" style={{ color: FAINT }} />
            <a href="#">Enterprise</a>
            <ChevronRight className="h-3 w-3 mx-2" style={{ color: FAINT }} />
            <span style={{ color: INK }}>IBM Carbon · plate 039</span>
          </div>
        </div>

        {/* Hero */}
        <section style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div className="mx-auto max-w-7xl px-10 py-14">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-12 items-start">
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: SUB }}>
                  Plate 039 · Maintained by IBM · MIT · v11.42.0
                </div>
                <h1 className="mt-5 text-[88px] leading-[0.96] font-medium" style={{ fontFamily: SERIF, color: INK }}>
                  <span style={{ color: "#8E8E94" }}>IBM Carbon.</span>
                </h1>
                <p className="mt-6 max-w-2xl text-[16px] leading-[1.6]" style={{ color: SUB }}>
                  Carbon is IBM's open-source design system for products and digital
                  experiences. It pairs a dense, accessibility-first grid with the IBM Plex
                  type family and a precise industrial palette — the reference for enterprise
                  software.
                </p>

                <div className="mt-7 flex flex-wrap gap-1.5">
                  <ChipLavender>Enterprise</ChipLavender>
                  <ChipLavender>Dashboards</ChipLavender>
                  <ChipLime>WCAG AA</ChipLime>
                  <ChipPeach>High-density</ChipPeach>
                  <ChipLavender>Open source</ChipLavender>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <button className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-[13px] font-medium text-[#0A0A0B]" style={{ background: INK }}>
                    <Copy className="h-3.5 w-3.5" />
                    Copy design.md
                  </button>
                  <button className="inline-flex h-11 items-center gap-2 rounded-full bg-[#101012] px-5 text-[13px] font-medium" style={{ border: `1px solid ${BORDER}`, color: INK }}>
                    <Download className="h-3.5 w-3.5" />
                    Download bundle
                  </button>
                  <a href="#" className="inline-flex items-center gap-1 text-[13px]" style={{ color: INK }}>
                    carbondesignsystem.com <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              <aside className="rounded-2xl border bg-[#101012] p-7" style={{ borderColor: BORDER }}>
                <div className="grid grid-cols-2 gap-6">
                  {[
                    ["Coverage", "96%"],
                    ["Tokens", "1,842"],
                    ["Components", "62"],
                    ["Last verified", "4d"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div className="text-[10.5px] uppercase tracking-[0.22em] mb-2" style={{ fontFamily: MONO, color: SUB }}>{k}</div>
                      <div className="text-[34px] leading-[1]" style={{ fontFamily: SERIF, color: INK }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-7 pt-5 border-t flex items-center justify-between" style={{ borderColor: BORDER_SOFT }}>
                  <div className="flex items-center gap-2 text-[13px]" style={{ color: INK }}>
                    <Star className="h-3.5 w-3.5" fill={INK} stroke="none" />
                    <span>94%</span>
                    <span style={{ color: SUB }}>community vote</span>
                  </div>
                  <div className="inline-flex items-center gap-1 text-[11.5px]" style={{ fontFamily: MONO, color: SUB }}>
                    <GitBranch className="h-3 w-3" />
                    312 forks
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* Body */}
        <section className="mx-auto max-w-7xl px-10 py-16 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-16">
          <div className="space-y-16">
            {/* Coverage */}
            <div>
              <SectionLabel n="Index 01" t="Coverage breakdown" />
              <h2 className="mt-4 mb-3 text-[36px] leading-[1.05] font-medium" style={{ fontFamily: SERIF, color: INK }}>
                What it ships,<br />
                <span style={{ color: "#8E8E94" }}>and what it doesn't.</span>
              </h2>
              <p className="mb-8 text-[14px] leading-[1.6]" style={{ color: SUB }}>
                Scored against the UIUXofAi extraction rubric — what each surface area provides
                out of the box.
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
              <SectionLabel n="Index 02" t="Core palette" />
              <h2 className="mt-4 mb-3 text-[36px] leading-[1.05] font-medium" style={{ fontFamily: SERIF, color: INK }}>
                Eight foundation tokens.
              </h2>
              <p className="mb-6 text-[14px] leading-[1.6]" style={{ color: SUB }}>
                The full ramp ships with 110 steps across functional roles.
              </p>
              <div className="rounded-2xl border bg-[#101012] overflow-hidden" style={{ borderColor: BORDER }}>
                <PaletteStrip colors={carbonPalette} />
                <div className="grid grid-cols-4 md:grid-cols-8 divide-x" style={{ borderTop: `1px solid ${BORDER}` }}>
                  {carbonPalette.map((c) => (
                    <div key={c} className="p-4 text-center" style={{ borderRightColor: BORDER }}>
                      <div className="h-10 w-full rounded mb-2" style={{ background: c, border: `1px solid ${BORDER_SOFT}` }} />
                      <div className="text-[10px] uppercase tracking-[0.18em]" style={{ fontFamily: MONO, color: SUB }}>
                        {c}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Components */}
            <div>
              <div className="flex items-end justify-between mb-6">
                <div>
                  <SectionLabel n="Index 03" t="Components" />
                  <h2 className="mt-4 text-[36px] leading-[1.05] font-medium" style={{ fontFamily: SERIF, color: INK }}>
                    62 total — showing twelve.
                  </h2>
                </div>
                <a href="#" className="text-[13px] inline-flex items-center gap-1" style={{ color: INK }}>
                  View all <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-px" style={{ background: BORDER }}>
                {components.map((c) => (
                  <div key={c.name} className="p-4 flex items-center justify-between" style={{ background: "#101012" }}>
                    <div>
                      <div className="text-[14px]" style={{ color: INK }}>{c.name}</div>
                      <div className="text-[10.5px] uppercase tracking-[0.18em] mt-0.5" style={{ fontFamily: MONO, color: SUB }}>
                        {c.variants} variants
                      </div>
                    </div>
                    {c.status === "Stable" ? <ChipLime>stable</ChipLime> : <ChipPeach>beta</ChipPeach>}
                  </div>
                ))}
              </div>
            </div>

            {/* Bundles */}
            <div>
              <SectionLabel n="Index 04" t="Curated bundles" />
              <h2 className="mt-4 mb-6 text-[36px] leading-[1.05] font-medium" style={{ fontFamily: SERIF, color: INK }}>
                <span style={{ color: "#8E8E94" }}>Pre-packaged slices.</span>
              </h2>
              <div className="space-y-3">
                {bundles.map((b) => (
                  <div key={b.name} className="rounded-xl border bg-[#101012] p-5 flex items-center justify-between" style={{ borderColor: BORDER }}>
                    <div>
                      <div className="text-[17px]" style={{ fontFamily: SERIF, color: INK }}>{b.name}</div>
                      <div className="text-[13px] mt-0.5" style={{ color: SUB }}>{b.desc}</div>
                    </div>
                    <div className="flex items-center gap-5">
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-[0.18em]" style={{ fontFamily: MONO, color: SUB }}>
                          Tokens
                        </div>
                        <div className="text-[14px]" style={{ fontFamily: MONO, color: INK }}>{b.tokens.toLocaleString()}</div>
                      </div>
                      <ChipLime>{b.coverage}%</ChipLime>
                      <button className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-[12px] font-medium text-[#0A0A0B]" style={{ background: INK }}>
                        <Copy className="h-3 w-3" />
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
            <div className="rounded-2xl border p-6" style={{ borderColor: BORDER, background: BG_SOFT }}>
              <SectionLabel n="Index 05" t="Companion prompt" />
              <p className="mt-3 text-[13px] leading-[1.6]" style={{ color: SUB }}>
                Pairs with the design.md to keep Claude on-brand across long sessions.
              </p>
              <pre className="mt-4 rounded-md bg-[#101012] p-3 text-[11.5px] leading-[1.6] overflow-hidden whitespace-pre-wrap" style={{ border: `1px solid ${BORDER}`, fontFamily: MONO, color: INK }}>
{`You are designing inside the IBM Carbon
system. Use the 8pt grid, Plex Sans for UI,
Plex Mono for code, and IBM blue (#0F62FE)
as the only accent. Prefer density over
whitespace. Never invent components — reuse
what design.md declares.`}
              </pre>
              <button className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#101012] py-2.5 text-[12px]" style={{ border: `1px solid ${BORDER}`, color: INK, fontFamily: MONO }}>
                <Copy className="h-3 w-3" />
                copy prompt
              </button>
            </div>

            <div className="rounded-2xl border bg-[#101012] p-6" style={{ borderColor: BORDER }}>
              <SectionLabel n="Index 06" t="Changelog" />
              <ol className="mt-4 space-y-5">
                {changelog.map((c) => (
                  <li key={c.version} className="pl-3" style={{ borderLeft: `1px solid ${BORDER}` }}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[12px]" style={{ fontFamily: MONO, color: INK }}>{c.version}</span>
                      <span className="text-[10px] uppercase tracking-[0.18em]" style={{ fontFamily: MONO, color: SUB }}>
                        {c.date}
                      </span>
                    </div>
                    <p className="mt-1 text-[12.5px] leading-[1.55]" style={{ color: SUB }}>{c.note}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-2xl border p-6" style={{ borderColor: BORDER, background: "#101012" }}>
              <Quote className="h-3.5 w-3.5 mb-3" style={{ color: FAINT }} />
              <blockquote className="text-[15px] leading-[1.5]" style={{ fontFamily: SERIF, color: INK }}>
                Verified May 14 by the UIUXofAi editorial team. Carbon scores highest of any
                enterprise system on accessibility and component completeness.
              </blockquote>
              <div className="mt-4 text-[11.5px]" style={{ fontFamily: MONO, color: SUB }}>
                — The editorial desk
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
