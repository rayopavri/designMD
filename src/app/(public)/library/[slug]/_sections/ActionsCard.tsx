"use client";

import { ChevronRight, Download, Heart } from "lucide-react";
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
  isSaved: boolean;
  savePending: boolean;
  toggleFavorite: () => void;
  signedIn: boolean;
}) {
  const bundle = item.bundle;

  return (
    <aside className="w-full lg:w-[28%] lg:shrink-0 lg:overflow-hidden">
      <div className="rounded-xl border p-4 lg:h-full lg:flex lg:flex-col" style={{ borderColor: BORDER, background: SURFACE }}>
        {/* Identity */}
        <div
          className="text-[9.5px] uppercase tracking-[0.18em] mb-2 inline-flex items-center gap-1.5 flex-wrap"
          style={{ fontFamily: MONO, color: MUTED }}
        >
          <span>plate {bundle.num}</span>
          <span style={{ color: BORDER }}>·</span>
          <span>v{bundle.version}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-[24px] leading-[1.05] font-medium tracking-[-0.018em] min-w-0">
            {bundle.name}
            <span style={{ color: SUB }}>.</span>
          </h1>
          {bundle.brandLogoUrl && (
            <BrandLogo
              src={bundle.brandLogoUrl}
              fallbackDomain={hostnameSafe(bundle.brandLogoUrl)}
              size={40}
            />
          )}
        </div>

        {/* Tags */}
        {bundle.tags.length > 0 && (
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            {bundle.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
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

        {/* Attribution */}
        <div className="mt-3">
          <AttributionRow attr={item.attribution} />
        </div>

        {/* Coverage stat */}
        <div
          className="mt-3 pt-3 border-t flex items-center justify-between text-[10.5px]"
          style={{ borderColor: BORDER, fontFamily: MONO, color: MUTED }}
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIME }} />
            <span style={{ color: INK }}>{bundle.coverage}%</span>
            {" "}coverage
          </span>
          <span>{item.updatedAgo}</span>
        </div>

        {/* Spacer pushes CTAs to bottom on desktop */}
        <div className="flex-1" />

        {/* Tool picker */}
        <div className="mt-4">
          <div
            className="text-[9.5px] uppercase tracking-[0.18em] mb-2"
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
                  className="h-6 px-2.5 rounded-full text-[11px] font-medium transition-colors"
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
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={onUse}
            className="h-10 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center justify-center gap-2"
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
            className="h-8 rounded-full border inline-flex items-center justify-center gap-1.5 px-4 text-[11.5px] transition-opacity hover:opacity-80"
            style={{
              borderColor: BORDER,
              color: SUB,
              opacity: zipping ? 0.5 : 1,
              cursor: zipping ? "not-allowed" : "pointer",
            }}
          >
            <Download className="h-3 w-3" />
            {zipping ? "preparing…" : "Download .zip"}
          </button>
        </div>

        {/* Save + vote */}
        <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: BORDER }}>
          <button
            onClick={toggleFavorite}
            disabled={savePending}
            title={signedIn ? (isSaved ? "Remove from favorites" : "Save to favorites") : "Sign in to save"}
            className="inline-flex items-center gap-1.5 text-[11.5px] transition-colors"
            style={{ color: isSaved ? "#84CC16" : SUB, opacity: savePending ? 0.6 : 1 }}
          >
            <Heart
              className="h-3 w-3"
              style={{ fill: isSaved ? "#84CC16" : "none", stroke: isSaved ? "#84CC16" : "currentColor" }}
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
