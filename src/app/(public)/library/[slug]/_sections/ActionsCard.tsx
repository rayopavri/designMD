"use client";

import { type ReactNode } from "react";
import { ChevronRight, Download, GitFork, Heart } from "lucide-react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { VoteWidget } from "@/components/ui/VoteWidget";
import { AttributionRow } from "@/components/ui/AttributionRow";
import {
  BORDER,
  INK,
  INK_ON_LIGHT,
  LIME,
  MONO,
  MUTED,
  SUB,
  SURFACE,
  SURFACE_2,
  VIOLET,
} from "@/lib/ui-data/tokens";
import { TOOLS, toolLabel, type ToolId } from "@/lib/ui-data/toolPref";
import { type BundleItem } from "@/lib/ui-data/items";
import { ArtifactChip } from "./ArtifactChip";

function hostnameSafe(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
  } catch {
    return null;
  }
}

/**
 * The right-hand card that holds every action and fact about the bundle:
 * identity (name, brand, version), description + tags, a compact stats strip,
 * the two source files with copy + zip, the tool picker + install CTA, save,
 * and the vote widget. The hero visual sits to its left.
 */
export function ActionsCard({
  item,
  slug,
  tool,
  setTool,
  onUse,
  onZip,
  zipping,
  copyText,
  copiedSpec,
  copiedPrompt,
  isSaved,
  savePending,
  toggleFavorite,
  signedIn,
}: {
  item: BundleItem;
  slug: string;
  tool: ToolId;
  setTool: (t: ToolId) => void;
  onUse: () => void;
  onZip: () => void;
  zipping: boolean;
  copyText: (text: string, kind: "spec" | "prompt") => void;
  copiedSpec: boolean;
  copiedPrompt: boolean;
  isSaved: boolean;
  savePending: boolean;
  toggleFavorite: () => void;
  signedIn: boolean;
}) {
  const bundle = item.bundle;
  const designLines = bundle.designMd.split("\n").length;
  const promptLines = bundle.companionPrompt.split("\n").length;
  const promptTokensApprox = Math.max(1, Math.round(bundle.companionPrompt.length / 4));

  return (
    <aside className="col-span-12 lg:col-span-5">
      <div className="rounded-xl border p-6" style={{ borderColor: BORDER, background: SURFACE }}>
        {/* Identity */}
        <div
          className="text-[10.5px] uppercase tracking-[0.22em] mb-3 inline-flex items-center gap-2 flex-wrap"
          style={{ fontFamily: MONO, color: MUTED }}
        >
          <span>plate {bundle.num}</span>
          <span style={{ color: BORDER }}>·</span>
          <span>maintained by {bundle.maintainer || "—"}</span>
          <span style={{ color: BORDER }}>·</span>
          <span>v{bundle.version}</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-[34px] sm:text-[40px] leading-[1.0] font-medium tracking-[-0.022em] min-w-0">
            {bundle.name}
            <span style={{ color: SUB }}>.</span>
          </h1>
          {bundle.brandLogoUrl && (
            <BrandLogo
              src={bundle.brandLogoUrl}
              fallbackDomain={hostnameSafe(bundle.brandLogoUrl)}
              size={56}
            />
          )}
        </div>
        <p className="mt-4 text-[14px] leading-[1.6]" style={{ color: SUB }}>
          {bundle.description}
        </p>

        {/* Tags */}
        {bundle.tags.length > 0 && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {bundle.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full"
                style={{
                  background: SURFACE_2,
                  border: `1px solid ${BORDER}`,
                  color: SUB,
                  fontFamily: MONO,
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: VIOLET }} />
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Attribution + reassurance */}
        <div className="mt-4">
          <AttributionRow attr={item.attribution} />
        </div>
        <div className="mt-3 text-[11.5px]" style={{ fontFamily: MONO, color: MUTED }}>
          free forever · no install · paste into any AI tool
        </div>

        {/* Stats strip */}
        <div
          className="mt-5 pt-5 border-t grid grid-cols-2 gap-y-3 text-[11.5px]"
          style={{ borderColor: BORDER, fontFamily: MONO, color: MUTED }}
        >
          <Stat label="coverage" value={`${bundle.coverage}%`} dot={LIME} />
          <Stat label="verified" value={item.updatedAgo} />
          {bundle.tokens > 0 ? (
            <Stat
              label="tokens · components"
              value={`${bundle.tokens.toLocaleString()} · ${bundle.components}`}
            />
          ) : null}
          <Stat label="forks" value={`${bundle.forks}`} icon={<GitFork className="h-3 w-3" />} />
        </div>

        {/* The two files */}
        <div className="mt-5">
          <div
            className="text-[10.5px] uppercase tracking-[0.22em] mb-3"
            style={{ fontFamily: MONO, color: MUTED }}
          >
            what you&apos;ll get
          </div>
          <div className="grid grid-cols-1 gap-3">
            <ArtifactChip
              filename="design.md"
              hint="the brand spec — tokens, component anatomy, forbidden rules"
              meta={`${bundle.tokens > 0 ? `${bundle.tokens.toLocaleString()} tokens · ` : ""}${designLines} lines`}
              accent={LIME}
              onCopy={() => copyText(bundle.designMd, "spec")}
              copied={copiedSpec}
            />
            <ArtifactChip
              filename="companion.md"
              hint="system instructions that teach your AI how to use the spec"
              meta={`~${promptTokensApprox.toLocaleString()} tokens · ${promptLines} lines`}
              accent={VIOLET}
              onCopy={() => copyText(bundle.companionPrompt, "prompt")}
              copied={copiedPrompt}
            />
          </div>
        </div>

        {/* Tool picker */}
        <div className="mt-5">
          <div
            className="text-[10.5px] uppercase tracking-[0.22em] mb-2.5"
            style={{ fontFamily: MONO, color: MUTED }}
          >
            pick your tool
          </div>
          <div
            className="inline-flex items-center rounded-full border p-1"
            style={{ borderColor: BORDER, background: SURFACE }}
          >
            {TOOLS.map((t) => {
              const active = tool === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTool(t.id)}
                  className="h-7 px-3 rounded-full text-[12px] font-medium transition-colors"
                  style={{
                    background: active ? INK : "transparent",
                    color: active ? INK_ON_LIGHT : SUB,
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary CTA + zip */}
        <div className="mt-5 flex flex-col gap-3">
          <button
            onClick={onUse}
            className="h-11 rounded-full px-6 text-[13px] font-medium inline-flex items-center justify-center gap-2"
            style={{
              background: INK,
              color: INK_ON_LIGHT,
              boxShadow: `0 0 0 1px ${VIOLET}55, 0 10px 36px -10px ${VIOLET}88`,
            }}
          >
            Use in {toolLabel(tool)}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onZip}
            disabled={zipping}
            className="h-9 rounded-full border inline-flex items-center justify-center gap-1.5 px-4 text-[12px] transition-opacity hover:opacity-80"
            style={{
              borderColor: BORDER,
              color: SUB,
              opacity: zipping ? 0.5 : 1,
              cursor: zipping ? "not-allowed" : "pointer",
            }}
          >
            <Download className="h-3.5 w-3.5" />
            {zipping ? "preparing…" : "Download .zip"}
          </button>
        </div>

        {/* Save + vote */}
        <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: BORDER }}>
          <button
            onClick={toggleFavorite}
            disabled={savePending}
            title={signedIn ? (isSaved ? "Remove from favorites" : "Save to favorites") : "Sign in to save"}
            className="inline-flex items-center gap-1.5 text-[12px] transition-colors"
            style={{ color: isSaved ? LIME : SUB, opacity: savePending ? 0.6 : 1 }}
          >
            <Heart
              className="h-3.5 w-3.5"
              style={{ fill: isSaved ? LIME : "none", stroke: isSaved ? LIME : "currentColor" }}
            />
            {isSaved ? "Saved" : "Save"}
          </button>
          <VoteWidget
            bundleSlug={slug}
            initialVoteCount={bundle.voteCount}
            initialPositiveVoteRate={bundle.voteRate}
          />
        </div>
      </div>
    </aside>
  );
}

function Stat({
  label,
  value,
  dot,
  icon,
}: {
  label: string;
  value: string;
  dot?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="uppercase tracking-[0.18em] text-[9.5px]">{label}</span>
      <span className="inline-flex items-center gap-1.5" style={{ color: INK }}>
        {dot ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} /> : null}
        {icon}
        {value}
      </span>
    </div>
  );
}
