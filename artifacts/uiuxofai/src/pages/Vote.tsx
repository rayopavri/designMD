import { useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowUpRight, Check, X } from "lucide-react";

import { SectionLabel } from "../components/Shell";
import {
  BG,
  BORDER,
  BORDER_SOFT,
  INK,
  INK_ON_LIGHT,
  LIME,
  MONO,
  MUTED,
  PEACH,
  SUB,
  SURFACE,
  SURFACE_2,
  VIOLET,
} from "../lib/tokens";
import { getItem } from "../lib/items";

const TOOL_PREF_KEY = "uiuxofai:vote:tool";

type Vote = "yes" | "no" | null;

const DRIFT = [
  "Colours were off",
  "Typography ignored",
  "Spacing wrong",
  "Component anatomy missed",
  "Used forbidden rule",
  "Coverage felt low",
];

const FEEDBACK = [
  { tag: "typography ignored", ago: "10 mins", model: "cursor", tone: "neg" as const },
  { tag: "worked perfectly", ago: "1 hour", model: "claude", tone: "pos" as const },
  { tag: "spacing wrong", ago: "3 hours", model: "lovable", tone: "neg" as const },
  { tag: "shipped on first try", ago: "5 hours", model: "claude", tone: "pos" as const },
  { tag: "coverage felt low", ago: "1 day", model: "figma make", tone: "neg" as const },
];

export function Vote() {
  const [, params] = useRoute<{ id: string }>("/vote/:id");
  const item = params ? getItem(params.id) : undefined;
  // Voting today is bundle-only; non-bundle items show a graceful message.
  const bundle = item && item.type === "bundle" ? item.bundle : undefined;

  const [tool, setToolState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(TOOL_PREF_KEY);
    } catch {
      return null;
    }
  });
  const setTool = (t: string | null) => {
    setToolState(t);
    if (typeof window === "undefined") return;
    try {
      if (t) window.localStorage.setItem(TOOL_PREF_KEY, t);
      else window.localStorage.removeItem(TOOL_PREF_KEY);
    } catch {
      // ignore
    }
  };
  const [vote, setVote] = useState<Vote>(null);
  const [drift, setDrift] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const TOOLS = ["Claude", "Cursor", "Lovable", "Figma Make", "ChatGPT"];

  function toggleDrift(d: string) {
    setDrift((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  function submit() {
    setSubmitted(true);
  }

  if (!bundle) {
    const isNonBundle = !!item && item.type !== "bundle";
    return (
      <div className="mx-auto max-w-3xl px-6 lg:px-8 py-32 text-center">
        <SectionLabel n={isNonBundle ? "—" : "404"} t={isNonBundle ? "Voting is bundle-only for now" : "Bundle not found"} />
        <h1 className="mt-4 text-[28px] font-medium">
          {isNonBundle
            ? `${item!.name} doesn't take votes yet.`
            : "No bundle with that id."}
        </h1>
        {isNonBundle ? (
          <p className="mt-4 text-[14px]" style={{ color: SUB }}>
            Skills, agents, and MCPs collect attribution & verification signals instead of community votes.
          </p>
        ) : null}
        <Link
          href={isNonBundle ? `/library/${item!.id}` : "/vote"}
          className="mt-6 inline-flex items-center gap-1.5 text-[13px]"
          style={{ color: VIOLET }}
        >
          {isNonBundle ? `Back to ${item!.name}` : "Browse bundles to vote on"}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 lg:px-8 py-12 grid grid-cols-12 gap-8">
      <div className="col-span-12 lg:col-span-8 space-y-8">
        {/* Bundle header */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: BORDER, background: SURFACE }}>
          <div className="flex h-1.5">
            {bundle.palette.map((c, i) => (
              <span key={i} className="flex-1" style={{ background: c }} />
            ))}
          </div>
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <span
                className="text-[11px] uppercase tracking-[0.22em]"
                style={{ fontFamily: MONO, color: MUTED }}
              >
                plate {bundle.num}
              </span>
              <span className="text-[16px] font-medium" style={{ color: INK }}>
                {bundle.name}
              </span>
            </div>
            <Link
              href={`/library/${bundle.id}`}
              className="inline-flex items-center gap-1.5 text-[12px]"
              style={{ color: SUB }}
            >
              View bundle
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {!submitted ? (
          <>
            <div className="text-center pt-6">
              <SectionLabel n="01" t="Which tool did you ship with?" />
              <h1 className="mt-4 text-[40px] sm:text-[48px] leading-[1.04] font-medium tracking-[-0.018em]">
                Did this bundle
                <br />
                <span style={{ color: SUB }}>
                  hold up in {tool ?? "Claude"}?
                </span>
              </h1>
              <p className="mt-4 text-[14px]" style={{ color: SUB }}>
                We calibrate the companion prompt per tool — pick the one you used.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 flex-wrap">
              {TOOLS.map((t) => {
                const active = tool === t;
                return (
                  <button
                    key={t}
                    onClick={() => setTool(t)}
                    className="inline-flex items-center gap-1.5 h-8 rounded-full border px-3 text-[12px]"
                    style={{
                      borderColor: active ? VIOLET : BORDER,
                      background: active ? `${VIOLET}1A` : SURFACE,
                      color: active ? INK : SUB,
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: active ? VIOLET : MUTED }}
                    />
                    {t.toLowerCase()}
                  </button>
                );
              })}
            </div>

            <div
              className="grid grid-cols-2 gap-4 transition-opacity"
              style={{ opacity: 1 }}
            >
              <VoteCard
                tone="yes"
                selected={vote === "yes"}
                onSelect={() => setVote("yes")}
                title="Yes, it landed"
                desc="On brand, on spec, ready to ship."
              />
              <VoteCard
                tone="no"
                selected={vote === "no"}
                onSelect={() => setVote("no")}
                title="Something was off"
                desc="Drifted from the design system."
              />
            </div>

            {vote === "no" ? (
              <div className="space-y-5">
                <SectionLabel n="02" t="What drifted?" />
                <div className="flex flex-wrap gap-2">
                  {DRIFT.map((d) => {
                    const active = drift.includes(d);
                    return (
                      <button
                        key={d}
                        onClick={() => toggleDrift(d)}
                        className="inline-flex items-center gap-1.5 h-8 rounded-full border px-3 text-[12px]"
                        style={{
                          borderColor: active ? VIOLET : BORDER,
                          background: active ? `${VIOLET}1A` : SURFACE,
                          color: active ? INK : SUB,
                        }}
                      >
                        {active ? <Check className="h-3 w-3" style={{ color: VIOLET }} /> : null}
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {vote ? (
              <div className="space-y-3">
                <SectionLabel n={vote === "no" ? "03" : "02"} t="Notes (optional)" />
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Anything the curation desk should know? Pasted prompt, screenshots, repro steps…"
                  rows={4}
                  className="w-full rounded-md border p-3 text-[13px]"
                  style={{ borderColor: BORDER, background: SURFACE, color: INK }}
                />
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: BORDER_SOFT }}>
              <Link href={`/library/${bundle.id}`} className="text-[12.5px]" style={{ color: SUB }}>
                Cancel
              </Link>
              <button
                disabled={!vote}
                onClick={submit}
                className="h-10 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center gap-2 disabled:opacity-40"
                style={{ background: INK, color: INK_ON_LIGHT }}
              >
                Submit vote
                <span style={{ fontFamily: MONO, color: MUTED }}>⏎</span>
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <span
              className="inline-flex items-center gap-2 h-8 rounded-full px-3 text-[11px] uppercase tracking-[0.22em]"
              style={{
                background: SURFACE_2,
                border: `1px solid ${BORDER}`,
                color: SUB,
                fontFamily: MONO,
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIME }} />
              vote recorded
            </span>
            <h2 className="mt-6 text-[36px] leading-[1.04] font-medium tracking-[-0.018em]">
              Thanks — your vote
              <br />
              <span style={{ color: SUB }}>just shifted the curve.</span>
            </h2>
            <p className="mt-4 text-[14px]" style={{ color: SUB }}>
              {vote === "yes"
                ? "Vote rate climbing. We'll keep this bundle pinned."
                : `Logged ${drift.length || 0} drift signal${drift.length === 1 ? "" : "s"}. The editorial desk will recalibrate.`}
            </p>
            <Link
              href="/library"
              className="mt-8 inline-flex items-center gap-2 h-10 rounded-full px-5 text-[12.5px] font-medium"
              style={{ background: INK, color: INK_ON_LIGHT }}
            >
              Back to library
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <aside className="col-span-12 lg:col-span-4 space-y-6">
        <div className="rounded-xl border p-6" style={{ borderColor: BORDER, background: SURFACE }}>
          <SectionLabel n="03" t="Editorial queue" />
          <p className="mt-4 text-[13px] leading-[1.6]" style={{ color: SUB }}>
            Your vote feeds the editorial queue. Bundles that drop below 60% are auto-flagged for
            review by the curation desk.
          </p>
        </div>
        <div className="rounded-xl border p-6" style={{ borderColor: BORDER, background: SURFACE }}>
          <SectionLabel n="04" t="Recent feedback" />
          <div className="mt-4 space-y-4">
            {FEEDBACK.map((f, i) => (
              <div key={i} className="flex flex-col gap-1">
                <span
                  className="inline-flex items-center gap-1.5 self-start text-[11px] px-2 py-0.5 rounded-full"
                  style={{
                    background: BG,
                    border: `1px solid ${BORDER}`,
                    color: SUB,
                    fontFamily: MONO,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: f.tone === "pos" ? LIME : PEACH }}
                  />
                  {f.tag}
                </span>
                <span className="text-[11px]" style={{ color: MUTED, fontFamily: MONO }}>
                  {f.ago} ago · {f.model}
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function VoteCard({
  tone,
  selected,
  onSelect,
  title,
  desc,
}: {
  tone: "yes" | "no";
  selected: boolean;
  onSelect: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onSelect}
      className="rounded-xl border p-8 text-left transition-colors"
      style={{
        borderColor: selected ? VIOLET : BORDER,
        background: selected ? `${VIOLET}12` : SURFACE,
        boxShadow: selected ? `0 0 0 1px ${VIOLET}55` : undefined,
      }}
    >
      <span
        className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-5"
        style={{
          background: tone === "yes" ? `${LIME}1A` : SURFACE_2,
          border: `1px solid ${tone === "yes" ? `${LIME}66` : BORDER}`,
        }}
      >
        {tone === "yes" ? (
          <Check className="h-5 w-5" style={{ color: LIME }} strokeWidth={2.4} />
        ) : (
          <X className="h-5 w-5" style={{ color: PEACH }} strokeWidth={2.4} />
        )}
      </span>
      <div className="text-[15px] font-medium" style={{ color: INK }}>
        {title}
      </div>
      <div className="text-[12.5px] mt-1" style={{ color: SUB }}>
        {desc}
      </div>
    </button>
  );
}
