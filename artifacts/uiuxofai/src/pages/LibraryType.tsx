import { useMemo, useState } from "react";
import { LibraryFilterPanel } from "../components/LibraryFilterPanel";
import { matchesFilters, useLibraryFilters } from "../lib/libraryFilters";
import { Link } from "wouter";
import { ArrowUpRight, Check, Search } from "lucide-react";
import { ItemCard } from "../components/ItemCard";
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
  SURFACE_2,
  VIOLET,
} from "../lib/tokens";
import {
  DISPLAY_TYPES,
  ITEMS,
  TYPE_META,
  displayTypeOf,
  isDesignSystem,
  type DisplayType,
  type Tool,
} from "../lib/items";

const TOOLS_ROW: Tool[] = ["Claude", "Cursor", "Lovable", "Figma Make", "ChatGPT"];

const COPY: Record<
  DisplayType,
  {
    intro: string;
    detail: string;
    steps: { t: string; d: string }[];
    findHeading: string;
    findSub: string;
  }
> = {
  skill: {
    intro:
      "A Skill is a short instruction file you drop into Claude or Cursor that gives it a specific design talent — like building tokenized specs, following a real brand design system, or writing strict UI rules.",
    detail:
      "Think of it like hiring a focused specialist for one job. Design systems live here too — drop a Linear, Stripe, or Notion spec into your tool and your generations stop looking generic.",
    steps: [
      { t: "Pick the skill you need", d: "Each skill names the job it's good at — token wrangling, Figma-to-React, strict design system rules." },
      { t: "Save it in your tool", d: "Drop the file into Claude's skills folder or your Cursor rules folder. Copy/paste, one file." },
      { t: "Call it by name", d: "Mention the skill or rule in chat and your tool switches into that mode." },
    ],
    findHeading: "Skills on the shelf",
    findSub: "Focused single-purpose instructions for Claude, Cursor, ChatGPT, and Lovable.",
  },
  agent: {
    intro:
      "An Agent is a small persona you give to Claude Code or Cursor — a UI engineer, a design critic, a component architect — so it shows up to the conversation already in role.",
    detail:
      "Agents are heavier than skills: they have a job, a workflow, and a set of tools. Use one when you want Claude to act like a teammate, not a generic chatbot.",
    steps: [
      { t: "Pick the role", d: "Browse agents by what they do — implement, critique, architect — and open the one that fits your task." },
      { t: "Install in your tool", d: "Save the agent definition to your Claude Code or Cursor agents folder, then reload." },
      { t: "Invoke and hand off", d: "Mention the agent and give it a task. It follows its charter without you re-explaining." },
    ],
    findHeading: "Agents on the shelf",
    findSub: "Personas with a charter, a workflow, and a clear job to do.",
  },
  mcp: {
    intro:
      "An MCP is a small server that gives your AI tool a new sense — like reading live Figma frames, searching real shipped app screens, or browsing curated references.",
    detail:
      "You add it once to your model's config and your tool gains a new capability. Most are free; some need an API key from the underlying service.",
    steps: [
      { t: "Pick the capability", d: "Browse MCPs by what they let your AI see or do — Figma, Mobbin, design references." },
      { t: "Add it to your config", d: "Paste the server block into your Claude Desktop or Cursor mcp.json file." },
      { t: "Restart and use it", d: "Restart the client; your tool can now call the new tools the server exposes." },
    ],
    findHeading: "MCPs on the shelf",
    findSub: "Connections that let Claude, Cursor, and other MCP-aware tools see new things.",
  },
};

const TYPE_PATH: Record<DisplayType, string> = {
  skill: "/library/skills",
  agent: "/library/agents",
  mcp: "/library/mcps",
};

export function LibraryType({ type }: { type: DisplayType }) {
  const meta = TYPE_META[type];
  const copy = COPY[type];
  const [query, setQuery] = useState("");
  const [designSystemOnly, setDesignSystemOnly] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("ds") === "1";
  });

  const { filters: urlFilters } = useLibraryFilters();

  const all = useMemo(() => ITEMS.filter((i) => displayTypeOf(i) === type), [type]);
  const dsCount = useMemo(() => all.filter(isDesignSystem).length, [all]);
  const filtered = useMemo(() => {
    return all.filter((it) => {
      if (designSystemOnly && !isDesignSystem(it)) return false;
      if (!matchesFilters(it, urlFilters)) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const haystack = [it.name, it.tagline, it.description, ...it.tags, ...(it.tools as string[])]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [all, query, designSystemOnly, urlFilters]);

  return (
    <>
      {/* Intro */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8 pt-10 pb-14">
          <div
            className="flex items-center gap-2 text-[12px] mb-6"
            style={{ fontFamily: MONO, color: MUTED }}
          >
            <Link href="/library" style={{ color: SUB }}>
              library
            </Link>
            <span style={{ color: BORDER }}>/</span>
            <span style={{ color: INK }}>{meta.plural.toLowerCase()}</span>
          </div>
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 lg:col-span-7">
              <div
                className="inline-flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] mb-4"
                style={{ fontFamily: MONO, color: MUTED }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.accent }} />
                <span style={{ color: meta.accent }}>{meta.icon}</span>
                <span style={{ color: SUB }}>{meta.plural.toLowerCase()}</span>
                <span style={{ color: BORDER }}>·</span>
                <span>{all.length} in stock</span>
              </div>
              <h1 className="text-[44px] sm:text-[54px] leading-[1.02] font-medium tracking-[-0.022em]">
                {copy.intro.split(" — ")[0]}
                <span style={{ color: SUB }}>
                  {copy.intro.includes(" — ") ? " — " + copy.intro.split(" — ").slice(1).join(" — ") : ""}
                </span>
              </h1>
              <p className="mt-6 text-[15px] leading-[1.65] max-w-[40rem]" style={{ color: SUB }}>
                {copy.detail}
              </p>
            </div>
            <div className="col-span-12 lg:col-span-5">
              <div className="rounded-xl border p-5" style={{ borderColor: BORDER, background: SURFACE }}>
                <div
                  className="text-[10.5px] uppercase tracking-[0.22em] mb-3"
                  style={{ fontFamily: MONO, color: MUTED }}
                >
                  Made for
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {TOOLS_ROW.map((t) => {
                    const covered = all.some((i) => (i.tools as string[]).includes(t));
                    return (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border"
                        style={{
                          fontFamily: MONO,
                          color: covered ? INK : MUTED,
                          borderColor: covered ? `${LIME}55` : BORDER,
                          background: covered ? `${LIME}10` : SURFACE_2,
                        }}
                      >
                        {covered ? (
                          <Check className="h-2.5 w-2.5" style={{ color: LIME }} strokeWidth={3} />
                        ) : (
                          <span className="h-1 w-1 rounded-full" style={{ background: MUTED }} />
                        )}
                        {t}
                      </span>
                    );
                  })}
                </div>
                <div
                  className="mt-4 pt-4 border-t text-[11.5px] leading-[1.5]"
                  style={{ borderColor: BORDER, color: SUB }}
                >
                  Pick the {meta.label.toLowerCase()}, install it in your tool, use it. The detail page
                  has copy-paste steps for each tool above.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How to use one */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8 py-14">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
            <div>
              <div
                className="text-[10.5px] uppercase tracking-[0.22em]"
                style={{ fontFamily: MONO, color: MUTED }}
              >
                How to use one
              </div>
              <h2 className="mt-3 text-[28px] leading-[1.08] font-medium tracking-[-0.018em]">
                Three steps,{" "}
                <span style={{ color: SUB }}>then it's yours.</span>
              </h2>
            </div>
          </div>
          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-px rounded-lg overflow-hidden"
            style={{ background: BORDER }}
          >
            {copy.steps.map((s, i) => (
              <div key={i} className="p-6" style={{ background: BG }}>
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-medium"
                    style={{ background: INK, color: INK_ON_LIGHT }}
                  >
                    {i + 1}
                  </span>
                  <span
                    className="text-[10.5px] uppercase tracking-[0.22em]"
                    style={{ fontFamily: MONO, color: meta.accent }}
                  >
                    step
                  </span>
                </div>
                <div className="text-[15px] font-medium mb-1.5" style={{ color: INK }}>
                  {s.t}
                </div>
                <div className="text-[13px] leading-[1.6]" style={{ color: SUB }}>
                  {s.d}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The catalog */}
      <section>
        <div className="mx-auto max-w-6xl px-6 lg:px-8 py-14">
          <div className="mb-8">
            <div
              className="text-[10.5px] uppercase tracking-[0.22em]"
              style={{ fontFamily: MONO, color: MUTED }}
            >
              What you'll find here
            </div>
            <h2 className="mt-3 text-[28px] leading-[1.08] font-medium tracking-[-0.018em]">
              {filtered.length}{" "}
              <span style={{ color: SUB }}>
                {filtered.length === 1 ? meta.label.toLowerCase() : meta.plural.toLowerCase()} on the shelf.
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-12 gap-8">
            <aside className="col-span-12 md:col-span-3 space-y-8">
              <div>
                <div
                  className="text-[10.5px] uppercase tracking-[0.22em] mb-3"
                  style={{ fontFamily: MONO, color: MUTED }}
                >
                  Search
                </div>
                <div className="relative">
                  <Search
                    className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: MUTED }}
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search…"
                    className="w-full h-9 rounded-md border pl-9 pr-3 text-[12.5px]"
                    style={{ borderColor: BORDER, background: SURFACE, color: INK }}
                  />
                </div>
              </div>

              <LibraryFilterPanel />

              {type === "skill" && dsCount > 0 ? (
                <div>
                  <div
                    className="text-[10.5px] uppercase tracking-[0.22em] mb-3"
                    style={{ fontFamily: MONO, color: MUTED }}
                  >
                    Design systems
                  </div>
                  <button
                    onClick={() => setDesignSystemOnly((v) => !v)}
                    className="h-8 px-3 rounded-full border text-[11.5px] inline-flex items-center gap-1.5"
                    style={{
                      borderColor: designSystemOnly ? VIOLET : BORDER,
                      background: designSystemOnly ? `${VIOLET}1A` : SURFACE,
                      color: designSystemOnly ? INK : SUB,
                    }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: VIOLET }} />
                    Design systems only
                    <span style={{ fontFamily: MONO, color: MUTED }}>{dsCount}</span>
                  </button>
                </div>
              ) : null}
            </aside>

            <div className="col-span-12 md:col-span-9">
              {filtered.length === 0 ? (
                <div
                  className="rounded-lg border p-12 text-center"
                  style={{ borderColor: BORDER, background: SURFACE }}
                >
                  <p className="text-[14px]" style={{ color: SUB }}>
                    Nothing matches. Try clearing the filters.
                  </p>
                </div>
              ) : (
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px rounded-lg overflow-hidden"
                  style={{ background: BORDER }}
                >
                  {filtered.map((it) => (
                    <ItemCard key={it.id} item={it} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-10 flex items-center justify-between flex-wrap gap-3">
            <Link
              href="/library"
              className="inline-flex items-center gap-1.5 text-[12.5px]"
              style={{ color: SUB }}
            >
              ← Back to the full library
            </Link>
            <Link
              href={`/generate?type=${type}`}
              className="inline-flex items-center gap-1.5 text-[12.5px]"
              style={{ color: meta.accent }}
            >
              Can't find what you need? Generate a {meta.label.toLowerCase()}
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* Other shelves */}
      <section className="border-t" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8 py-14">
          <div
            className="text-[10.5px] uppercase tracking-[0.22em] mb-6"
            style={{ fontFamily: MONO, color: MUTED }}
          >
            Other shelves
          </div>
          <div
            className="grid grid-cols-2 gap-px rounded-lg overflow-hidden"
            style={{ background: BORDER }}
          >
            {DISPLAY_TYPES
              .filter((t) => t !== type)
              .map((t) => {
                const m = TYPE_META[t];
                const count = ITEMS.filter((i) => displayTypeOf(i) === t).length;
                return (
                  <Link
                    key={t}
                    href={TYPE_PATH[t]}
                    className="p-5 block transition-colors hover:bg-[#101013]"
                    style={{ background: BG }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.22em]"
                        style={{ fontFamily: MONO, color: MUTED }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.accent }} />
                        {m.plural}
                      </span>
                      <span style={{ fontFamily: MONO, color: SUB }} className="text-[11px]">
                        {count}
                      </span>
                    </div>
                    <div className="text-[13px] leading-[1.5]" style={{ color: SUB }}>
                      {COPY[t].intro.split(".")[0]}.
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
