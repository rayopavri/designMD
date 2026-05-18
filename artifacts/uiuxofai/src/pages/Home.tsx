import { Link } from "wouter";
import { ArrowUpRight, Check } from "lucide-react";
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
} from "../lib/tokens";
import { ITEMS, TYPE_META, type ItemType } from "../lib/items";

const TOOL_BADGES = ["Claude", "Cursor", "Lovable", "Figma Make", "ChatGPT"];

const SHELVES: {
  type: ItemType;
  href: string;
  blurb: string;
}[] = [
  {
    type: "bundle",
    href: "/library/bundles",
    blurb: "Real brand systems packaged so your AI tool produces on-brand UI.",
  },
  {
    type: "skill",
    href: "/library/skills",
    blurb: "Single-purpose instruction files for Claude and Cursor.",
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

export function Home() {
  const count = (t: ItemType) => ITEMS.filter((i) => i.type === t).length;

  // Representative items for the outcomes section
  const outcome1 = ITEMS.find((i) => i.id === "linear");
  const outcome2 = ITEMS.find((i) => i.id === "agent-design-critique");
  const outcome3 = ITEMS.find((i) => i.id === "mcp-figma-dev-mode");
  const outcomes = [
    {
      title: "Ship on-brand UI in Cursor in minutes",
      body: "Drop a bundle into Cursor and your generations stop looking generic. Brand colors, type, density — all from one spec file.",
      item: outcome1,
      eyebrow: "with a Bundle",
    },
    {
      title: "Get a real critique from a UI agent",
      body: "Hand a screenshot to a design-critic agent and get a brand score, three specific edits, and the rationale behind each.",
      item: outcome2,
      eyebrow: "with an Agent",
    },
    {
      title: "Pipe Figma frames straight into your model",
      body: "Add the Figma MCP to your tool and Claude or Cursor can read your live frames — variables, components, the lot.",
      item: outcome3,
      eyebrow: "with an MCP",
    },
  ];

  return (
    <>
      {/* Act 1 — What this is */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-3xl px-6 lg:px-8 pt-24 pb-20 text-center">
          <div
            className="inline-flex items-center gap-2.5 mb-7 text-[10.5px] uppercase tracking-[0.22em]"
            style={{ fontFamily: MONO, color: MUTED }}
          >
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: LIME, boxShadow: `0 0 8px ${LIME}88` }}
              />
              <span style={{ color: SUB }}>free, no install</span>
            </span>
            <span className="h-px w-6" style={{ background: "#26262A" }} />
            <span>made for designers</span>
          </div>
          <h1 className="text-[44px] sm:text-[60px] leading-[1.02] font-medium tracking-[-0.022em]" style={{ color: INK }}>
            The one-stop library
            <br />
            <span style={{ color: SUB }}>to stop your AI from</span>{" "}
            <span style={{ color: INK }}>making sloppy UI.</span>
          </h1>
          <p
            className="mx-auto mt-7 max-w-[36rem] text-[15.5px] leading-[1.65]"
            style={{ color: SUB }}
          >
            UIUXofAi is a curated catalog of brand specs, skills, agents, and MCPs you can drop
            into Claude, Cursor, Lovable, or Figma Make. Pick what you need, paste it in, and your
            tool starts shipping UI that actually looks designed.
          </p>
          <p
            className="mx-auto mt-4 max-w-[34rem] text-[13.5px] leading-[1.6]"
            style={{ color: MUTED }}
          >
            For designers shipping with AI — and developers who want their output to look like a designer made it.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/library"
              className="h-10 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center gap-2"
              style={{
                background: INK,
                color: INK_ON_LIGHT,
                boxShadow: `0 0 0 1px ${VIOLET}66, 0 10px 36px -10px ${VIOLET}88`,
              }}
            >
              Browse the library
              <span style={{ fontFamily: MONO, color: MUTED }}>⏎</span>
            </Link>
            <Link
              href="/generate"
              className="h-10 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center gap-2"
              style={{
                background: INK,
                color: INK_ON_LIGHT,
                boxShadow: `0 0 0 1px ${LIME}66, 0 10px 36px -10px ${LIME}88`,
              }}
            >
              Generate from a URL
              <span style={{ fontFamily: MONO, color: MUTED }}>↗</span>
            </Link>
          </div>

          <div className="mt-8 flex items-center justify-center gap-1.5 flex-wrap">
            <span
              className="text-[10px] uppercase tracking-[0.22em] mr-1.5"
              style={{ fontFamily: MONO, color: MUTED }}
            >
              works in
            </span>
            {TOOL_BADGES.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border"
                style={{
                  fontFamily: MONO,
                  color: INK,
                  borderColor: `${LIME}55`,
                  background: `${LIME}10`,
                }}
              >
                <Check className="h-2.5 w-2.5" style={{ color: LIME }} strokeWidth={3} />
                {t}
              </span>
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
                Four shelves,{" "}
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
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px rounded-lg overflow-hidden"
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
                  href={o.item ? `/library/${o.item.id}` : "/library"}
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
                  {o.item ? (
                    <div
                      className="mt-6 pt-4 border-t flex items-center justify-between"
                      style={{ borderColor: BORDER }}
                    >
                      <span className="text-[12px]" style={{ color: INK }}>
                        {o.item.name}
                      </span>
                      <ArrowUpRight
                        className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        style={{ color: SUB }}
                      />
                    </div>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section>
        <div className="mx-auto max-w-3xl px-6 lg:px-8 py-24 text-center">
          <div
            className="text-[10.5px] uppercase tracking-[0.22em] mb-4"
            style={{ fontFamily: MONO, color: MUTED }}
          >
            Get started
          </div>
          <h2 className="text-[40px] sm:text-[46px] leading-[1.02] font-medium tracking-[-0.022em]">
            Stop fighting the
            <br />
            <span style={{ color: SUB }}>model's defaults.</span>
          </h2>
          <p className="mt-6 text-[15.5px] leading-[1.65] max-w-[34rem] mx-auto" style={{ color: SUB }}>
            Browse the four shelves, install one thing, see your AI tool start producing UI you'd
            actually ship.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/library"
              className="h-10 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center gap-2"
              style={{
                background: INK,
                color: INK_ON_LIGHT,
                boxShadow: `0 0 0 1px ${VIOLET}66, 0 10px 36px -10px ${VIOLET}88`,
              }}
            >
              Browse the library
              <span style={{ fontFamily: MONO, color: MUTED }}>⏎</span>
            </Link>
            <Link
              href="/generate"
              className="h-10 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center gap-2"
              style={{
                background: SURFACE,
                color: INK,
                border: `1px solid ${BORDER}`,
              }}
            >
              Generate from a URL
              <span style={{ fontFamily: MONO, color: MUTED }}>↗</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
