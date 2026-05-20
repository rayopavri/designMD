import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { HomeHero } from "./HomeHero";
import {
  BG,
  BORDER,
  BORDER_SOFT,
  INK,
  INK_ON_LIGHT,
  LIME,
  MONO,
  MUTED,
  SUB,
  SURFACE,
  VIOLET,
} from "@/lib/ui-data/tokens";
import { ITEMS, TYPE_META, type ItemType } from "@/lib/ui-data/items";

const CATEGORY_BADGES: { slug: string; label: string }[] = [
  { slug: "ai-llm-platforms", label: "AI & LLM" },
  { slug: "developer-tools-ides", label: "Developer Tools" },
  { slug: "design-creative-tools", label: "Design & Creative" },
  { slug: "fintech-crypto", label: "Fintech" },
];

const SHELVES: {
  type: ItemType;
  href: string;
  blurb: string;
}[] = [
  {
    type: "skill",
    href: "/library/skills",
    blurb: "Instruction files for Claude and Cursor — including real brand design systems.",
  },
  {
    type: "agent",
    href: "/library/agents",
    blurb: "Personas with a charter — UI engineer, design critic, architect.",
  },
  {
    type: "mcp",
    href: "/library/mcps",
    blurb: "Connections that let your tool see Figma, Mobbin, and more.",
  },
];

function Home() {
  const count = (t: ItemType) =>
    ITEMS.filter((i) => (t === "skill" ? i.type === "skill" || i.type === "bundle" : i.type === t)).length;

  // Representative items for the outcomes section.
  // Each outcome links to a filtered library shelf, not a single example item.
  const outcome1 = ITEMS.find((i) => i.id === "linear");
  const outcome2 = ITEMS.find((i) => i.id === "agent-design-critique");
  const outcome3 = ITEMS.find((i) => i.id === "mcp-figma-dev-mode");
  const outcomes = [
    {
      title: "Ship on-brand UI in Cursor in minutes",
      body: "Drop a design system into Cursor and your generations stop looking generic. Brand colors, type, density — all from one spec file.",
      item: outcome1,
      href: "/library?type=design-systems",
      shelfLabel: "Browse design systems",
      eyebrow: "with a Design system",
    },
    {
      title: "Get a real critique from a UI agent",
      body: "Hand a screenshot to a design-critic agent and get a brand score, three specific edits, and the rationale behind each.",
      item: outcome2,
      href: "/library/agents",
      shelfLabel: "Browse agents",
      eyebrow: "with an Agent",
    },
    {
      title: "Pipe Figma frames straight into your model",
      body: "Add the Figma MCP to your tool and Claude or Cursor can read your live frames — variables, components, the lot.",
      item: outcome3,
      href: "/library/mcps",
      shelfLabel: "Browse MCPs",
      eyebrow: "with an MCP",
    },
  ];

  return (
    <>
      {/* Hero — split layout with sample design.md card + try-it-now form */}
      <HomeHero />

      {/* How it works — three steps, no jargon */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8 py-16">
          <div
            className="text-[10.5px] uppercase tracking-[0.22em] mb-3"
            style={{ fontFamily: MONO, color: MUTED }}
          >
            How it works
          </div>
          <h2 className="text-[28px] sm:text-[32px] leading-[1.08] font-medium tracking-[-0.018em] mb-10">
            Three steps,{" "}
            <span style={{ color: SUB }}>no setup.</span>
          </h2>
          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-px rounded-lg overflow-hidden"
            style={{ background: BORDER }}
          >
            {[
              {
                n: "01",
                t: "Pick a shelf",
                d: "Design system, Skill, Agent, or MCP — each one solves a different on-brand UI problem.",
              },
              {
                n: "02",
                t: "Copy the spec",
                d: "One click copies the files. No account, no install, no email signup.",
              },
              {
                n: "03",
                t: "Paste into your tool",
                d: "Claude, Cursor, Lovable, or Figma Make. Your tool starts shipping UI on-brand.",
              },
            ].map((s) => (
              <div key={s.n} className="p-6" style={{ background: BG }}>
                <div
                  className="text-[10.5px] uppercase tracking-[0.22em] mb-3"
                  style={{ fontFamily: MONO, color: VIOLET }}
                >
                  {s.n}
                </div>
                <div className="text-[16px] font-medium mb-2" style={{ color: INK }}>
                  {s.t}
                </div>
                <p className="text-[13px] leading-[1.55]" style={{ color: SUB }}>
                  {s.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Act 2 — The library, upfront */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8 py-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <div
                className="text-[10.5px] uppercase tracking-[0.22em] mb-3"
                style={{ fontFamily: MONO, color: MUTED }}
              >
                The library
              </div>
              <h2 className="text-[36px] leading-[1.06] font-medium tracking-[-0.018em]">
                Three shelves,{" "}
                <span style={{ color: SUB }}>one place.</span>
              </h2>
              <p className="mt-4 max-w-[34rem] text-[14px] leading-[1.6]" style={{ color: SUB }}>
                Everything is sorted by what it does for you. Open a shelf, see what's inside, install
                whatever fits.
              </p>
            </div>
            <Link
              href="/library"
              className="inline-flex items-center gap-1.5 text-[12.5px] self-start md:self-end"
              style={{ color: INK }}
            >
              Browse all {ITEMS.length}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div
            className="grid grid-cols-1 sm:grid-cols-3 gap-px rounded-lg overflow-hidden"
            style={{ background: BORDER }}
          >
            {SHELVES.map((s) => {
              const m = TYPE_META[s.type];
              return (
                <Link
                  key={s.type}
                  href={s.href}
                  className="p-7 block transition-colors hover:bg-[#101013] group"
                  style={{ background: BG }}
                >
                  <div className="flex items-center justify-between mb-5">
                    <span
                      className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.22em]"
                      style={{ fontFamily: MONO, color: MUTED }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.accent }} />
                      <span style={{ color: m.accent }}>{m.icon}</span>
                      {m.plural}
                    </span>
                    <ArrowUpRight
                      className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      style={{ color: SUB }}
                    />
                  </div>
                  <div className="text-[28px] leading-[1] font-medium tracking-[-0.018em] mb-3" style={{ color: INK }}>
                    {count(s.type)}
                  </div>
                  <div className="text-[13px] leading-[1.55]" style={{ color: SUB }}>
                    {s.blurb}
                  </div>
                  <div
                    className="mt-5 inline-flex items-center gap-1 text-[11.5px]"
                    style={{ color: m.accent, fontFamily: MONO }}
                  >
                    browse {m.plural.toLowerCase()}
                    <ArrowUpRight className="h-3 w-3" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Act 3 — What you can do with it */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8 py-20">
          <div className="mb-10">
            <div
              className="text-[10.5px] uppercase tracking-[0.22em] mb-3"
              style={{ fontFamily: MONO, color: MUTED }}
            >
              What you can do with it
            </div>
            <h2 className="text-[36px] leading-[1.06] font-medium tracking-[-0.018em]">
              Pick a tool,{" "}
              <span style={{ color: SUB }}>then a job to do.</span>
            </h2>
          </div>
          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-px rounded-lg overflow-hidden"
            style={{ background: BORDER }}
          >
            {outcomes.map((o, i) => {
              const m = o.item ? TYPE_META[o.item.type] : null;
              return (
                <Link
                  key={i}
                  href={o.href}
                  className="p-7 block transition-colors hover:bg-[#101013] group"
                  style={{ background: BG }}
                >
                  <div
                    className="text-[10.5px] uppercase tracking-[0.22em] mb-5"
                    style={{ fontFamily: MONO, color: m?.accent ?? VIOLET }}
                  >
                    {o.eyebrow}
                  </div>
                  <div className="text-[20px] leading-[1.2] font-medium mb-3" style={{ color: INK }}>
                    {o.title}
                  </div>
                  <p className="text-[13.5px] leading-[1.6]" style={{ color: SUB }}>
                    {o.body}
                  </p>
                  <div
                    className="mt-6 pt-4 border-t flex items-center justify-between gap-3"
                    style={{ borderColor: BORDER }}
                  >
                    <div className="min-w-0">
                      {o.item ? (
                        <>
                          <div
                            className="text-[10.5px] uppercase tracking-[0.22em]"
                            style={{ fontFamily: MONO, color: MUTED }}
                          >
                            featured · {o.item.name}
                          </div>
                          <div className="text-[12px] mt-0.5 truncate" style={{ color: INK }}>
                            {o.shelfLabel}
                          </div>
                        </>
                      ) : (
                        <span className="text-[12px]" style={{ color: INK }}>
                          {o.shelfLabel}
                        </span>
                      )}
                    </div>
                    <ArrowUpRight
                      className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      style={{ color: SUB }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}

export default Home;
