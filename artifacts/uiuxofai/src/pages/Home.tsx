import { Link } from "wouter";
import { ArrowUpRight, Check } from "lucide-react";
import { SectionLabel } from "../components/Shell";
import { CodePanel } from "../components/CodePanel";
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
import { BUNDLES, getBundle, ITEMS, TYPE_META, type ItemType } from "../lib/items";

const TOOL_BADGES = ["Claude", "Cursor", "Lovable", "Figma Make", "ChatGPT", "Universal"];

export function Home() {
  const linear = getBundle("linear")!;
  const counts: { type: ItemType; n: number }[] = (["bundle", "skill", "agent", "mcp"] as ItemType[]).map(
    (t) => ({ type: t, n: ITEMS.filter((i) => i.type === t).length }),
  );
  return (
    <>
      {/* Hero */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-3xl px-6 lg:px-8 pt-24 pb-16 text-center">
          <div
            className="inline-flex items-center gap-2.5 mb-7 text-[10.5px] uppercase tracking-[0.22em]"
            style={{ fontFamily: MONO, color: MUTED }}
          >
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: LIME, boxShadow: `0 0 8px ${LIME}88` }}
              />
              <span style={{ color: SUB }}>free forever</span>
            </span>
            <span className="h-px w-6" style={{ background: "#26262A" }} />
            <span>MDN-style public reference</span>
          </div>
          <h1 className="text-[44px] sm:text-[60px] leading-[1.02] font-medium tracking-[-0.022em]" style={{ color: INK }}>
            Design systems,
            <br />
            <span style={{ color: SUB }}>written for the</span>{" "}
            <span style={{ color: INK }}>model.</span>
          </h1>
          <p
            className="mx-auto mt-7 max-w-[36rem] text-[15.5px] leading-[1.65]"
            style={{ color: SUB }}
          >
            A curated library that packages real brand systems into a
            <span
              className="px-1.5 py-0.5 mx-1 rounded"
              style={{
                fontFamily: MONO,
                color: INK,
                background: SURFACE_2,
                border: `1px solid ${BORDER}`,
              }}
            >
              design.md
            </span>
            spec and a calibrated companion prompt. Built for designers shipping with AI.
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
              Generate from URL
              <span style={{ fontFamily: MONO, color: MUTED }}>↗</span>
            </Link>
          </div>
          <div className="mt-5 text-[11px]" style={{ fontFamily: MONO, color: MUTED }}>
            no install · paste into any model · free forever
          </div>

          {/* Tool badges */}
          <div className="mt-8 flex items-center justify-center gap-1.5 flex-wrap">
            {TOOL_BADGES.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 text-[10.5px] px-2.5 py-1 rounded-full border"
                style={{
                  fontFamily: MONO,
                  color: SUB,
                  borderColor: BORDER,
                  background: SURFACE,
                }}
              >
                <span className="h-1 w-1 rounded-full" style={{ background: VIOLET }} />
                {t.toLowerCase()}
              </span>
            ))}
          </div>

          {/* Stats row — 4 types */}
          <div
            className="mt-10 mx-auto max-w-2xl grid grid-cols-4 gap-px rounded-lg overflow-hidden border"
            style={{ background: BORDER, borderColor: BORDER }}
          >
            {counts.map(({ type, n }) => {
              const m = TYPE_META[type];
              return (
                <Link
                  key={type}
                  href={`/library?type=${type}`}
                  className="py-4 px-2 block text-center transition-colors hover:bg-[#101013]"
                  style={{ background: BG }}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.accent }} />
                    <span className="text-[20px] font-medium" style={{ color: INK }}>
                      {n}
                    </span>
                  </div>
                  <div
                    className="mt-1 text-[10px] uppercase tracking-[0.2em]"
                    style={{ fontFamily: MONO, color: MUTED }}
                  >
                    {m.plural.toLowerCase()}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-6 lg:px-8 pb-24">
          <CodePanel
            title={`${linear.name.toLowerCase()} / design.md`}
            language="yaml"
            source={linear.designMd}
            highlights={{ 5: "mod", 8: "add" }}
            rightMeta={
              <>
                <span>{linear.tokens.toLocaleString()} tokens</span>
                <span className="inline-flex items-center gap-1.5" style={{ color: INK }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIME }} />
                  {linear.coverage}% coverage
                </span>
              </>
            }
          />
        </div>
      </section>

      {/* What you get */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8 py-20">
          <div className="grid grid-cols-12 gap-10">
            <div className="col-span-12 md:col-span-4">
              <SectionLabel n="01" t="The pair" />
              <h2 className="mt-3 text-[32px] leading-[1.08] font-medium tracking-[-0.018em]">
                One spec.
                <br />
                <span style={{ color: SUB }}>One companion prompt.</span>
              </h2>
              <p className="mt-5 text-[13.5px] leading-[1.6] max-w-[18rem]" style={{ color: SUB }}>
                Two flat files, version-controlled, that teach any model to treat your brand as
                the source of truth.
              </p>
            </div>
            <div
              className="col-span-12 md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-px rounded-lg overflow-hidden"
              style={{ background: BORDER }}
            >
              {[
                {
                  n: "01",
                  t: "design.md",
                  k: "spec",
                  d: "Flat, model-readable. Type, color, radii, motion, component anatomy. Versioned and diffable.",
                  icon: "▢",
                },
                {
                  n: "02",
                  t: "Companion prompt",
                  k: "calibrated",
                  d: "Teaches Claude or GPT to treat the spec as truth — not as a hint.",
                  icon: "◇",
                },
                {
                  n: "03",
                  t: "Coverage scoring",
                  k: "transparent",
                  d: "A score so you know exactly which parts of the system are captured.",
                  icon: "◆",
                },
                {
                  n: "04",
                  t: "Drop-in workflow",
                  k: "no install",
                  d: "Paste into Claude Projects, Cursor, Lovable. No SDK, no runtime.",
                  icon: "◐",
                },
              ].map(({ n, t, k, d, icon }) => (
                <div
                  key={t}
                  className="p-7 transition-colors"
                  style={{ background: BG }}
                >
                  <div className="flex items-center justify-between mb-5">
                    <span
                      className="text-[10.5px] uppercase tracking-[0.22em]"
                      style={{ fontFamily: MONO, color: MUTED }}
                    >
                      {n}
                    </span>
                    <span className="text-[14px]" style={{ color: VIOLET, opacity: 0.8 }}>
                      {icon}
                    </span>
                  </div>
                  <div className="text-[15px] font-medium mb-1.5">{t}</div>
                  <div
                    className="text-[10.5px] uppercase tracking-[0.18em] mb-3"
                    style={{ fontFamily: MONO, color: VIOLET, opacity: 0.85 }}
                  >
                    {k}
                  </div>
                  <p className="text-[13px] leading-[1.6]" style={{ color: SUB }}>
                    {d}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Library preview */}
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8 py-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <SectionLabel n="02" t="The library" />
              <h2 className="mt-3 text-[32px] leading-[1.08] font-medium tracking-[-0.018em]">
                240 systems,{" "}
                <span style={{ color: SUB }}>ready for the model.</span>
              </h2>
            </div>
            <Link
              href="/library"
              className="inline-flex items-center gap-1.5 text-[12.5px] self-start md:self-end"
              style={{ color: INK }}
            >
              Browse all
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-lg overflow-hidden"
            style={{ background: BORDER }}
          >
            {BUNDLES.slice(0, 8).map((b) => (
              <Link
                key={b.id}
                href={`/library/${b.id}`}
                className="p-5 group transition-colors hover:bg-[#101013] block"
                style={{ background: BG }}
              >
                <div className="flex items-center justify-between mb-5">
                  <span
                    className="text-[10px] uppercase tracking-[0.2em]"
                    style={{ fontFamily: MONO, color: MUTED }}
                  >
                    № {b.num}
                  </span>
                  <ArrowUpRight
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    style={{ color: SUB }}
                  />
                </div>
                <div className="text-[15px] font-medium mb-1" style={{ color: INK }}>
                  {b.name}
                </div>
                <div className="text-[11.5px] mb-4" style={{ color: SUB }}>
                  {b.tagline}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex h-1.5">
                    {b.palette.map((c, i) => (
                      <span
                        key={i}
                        className="w-5 first:rounded-l-sm last:rounded-r-sm"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <span
                    className="text-[10.5px] inline-flex items-center gap-1"
                    style={{ fontFamily: MONO, color: SUB }}
                  >
                    <Check className="h-2.5 w-2.5" style={{ color: LIME }} />
                    {b.coverage}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="mx-auto max-w-3xl px-6 lg:px-8 py-24 text-center">
          <SectionLabel n="04" t="Get started" />
          <h2 className="mt-5 text-[40px] sm:text-[46px] leading-[1.02] font-medium tracking-[-0.022em]">
            Stop fighting the
            <br />
            <span style={{ color: SUB }}>model's defaults.</span>
          </h2>
          <p className="mt-6 text-[15.5px] leading-[1.65] max-w-[34rem] mx-auto" style={{ color: SUB }}>
            Browse 4,800+ curated specs, skills, agents and MCPs — or paste any URL to generate
            your own. Free forever.
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
              Generate from URL
              <span style={{ fontFamily: MONO, color: MUTED }}>↗</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
