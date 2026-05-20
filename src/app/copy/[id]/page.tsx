"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

import { useEffect, useState } from "react";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import { SectionLabel } from "@/components/ui/Shell";
import {
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
} from "@/lib/ui-data/tokens";
import { getItem, TYPE_META } from "@/lib/ui-data/items";
import { CodePanel } from "@/components/ui/CodePanel";
import { getDraft, isDraftId } from "@/lib/ui-data/draftStore";

export function CopySuccess() {
  const params = useParams<Record<string,string>>();
  const router = useRouter();
  const paramId = params?.id ?? "";
  const draft = paramId && isDraftId(paramId) ? getDraft(paramId) : undefined;
  const item = paramId && !isDraftId(paramId) ? getItem(paramId) : undefined;
  // Bundle copy flow has moved to /library/:id with install steps inline.
  // Redirect any /copy/:bundleId (or other non-draft item ids) to the detail page.
  useEffect(() => {
    if (!paramId || isDraftId(paramId)) return;
    if (item) {
      const suffix = item.type === "bundle" ? "?install=1" : "";
      router.replace(`/library/${item.id}${suffix}`);
    } else {
      router.replace("/library");
    }
  }, [paramId, item, router]);
  const [copiedDraft, setCopiedDraft] = useState(false);

  if (draft) {
    const meta = TYPE_META[draft.type];
    async function copyDraftBody() {
      try {
        await navigator.clipboard.writeText(draft!.body);
      } catch {
        // ignore
      }
      setCopiedDraft(true);
      setTimeout(() => setCopiedDraft(false), 2000);
    }
    return (
      <>
        <section className="border-b text-center" style={{ borderColor: BORDER_SOFT }}>
          <div className="mx-auto max-w-3xl px-6 lg:px-8 pt-20 pb-12">
            <span
              className="inline-flex items-center gap-2 h-7 px-3 rounded-full text-[10.5px] uppercase tracking-[0.22em]"
              style={{ background: SURFACE_2, border: `1px solid ${BORDER}`, color: SUB, fontFamily: MONO }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.accent }} />
              <Check className="h-3 w-3" style={{ color: LIME }} />
              draft copied · {meta.label.toLowerCase()} from {draft.host}
            </span>
            <h1 className="mt-7 text-[48px] sm:text-[60px] leading-[1.02] font-medium tracking-[-0.022em]">
              Your draft is on
              <br />
              <span style={{ color: SUB }}>your clipboard.</span>
            </h1>
            <p className="mt-6 text-[14.5px] leading-[1.65] max-w-[34rem] mx-auto" style={{ color: SUB }}>
              Generated drafts are for personal use. Paste{" "}
              <span
                className="px-1.5 py-0.5 rounded mx-0.5"
                style={{ fontFamily: MONO, color: INK, background: SURFACE_2, border: `1px solid ${BORDER}` }}
              >
                {draft.filename}
              </span>{" "}
              into your tool of choice — or submit it to the editorial desk for review.
            </p>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-4xl px-6 lg:px-8 py-12">
            <SectionLabel n="01" t="Your draft" />
            <div className="mt-6">
              <CodePanel
                title={draft.filename}
                language={draft.language}
                source={draft.body}
                rightMeta={`${meta.label.toLowerCase()} · ${draft.host}`}
              />
            </div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={copyDraftBody}
                className="rounded-xl border p-5 text-left transition-colors"
                style={{ borderColor: copiedDraft ? `${LIME}88` : BORDER, background: SURFACE }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-[10.5px] uppercase tracking-[0.22em]"
                    style={{ fontFamily: MONO, color: MUTED }}
                  >
                    draft
                  </span>
                  {copiedDraft ? (
                    <Check className="h-4 w-4" style={{ color: LIME }} />
                  ) : (
                    <Copy className="h-4 w-4" style={{ color: SUB }} />
                  )}
                </div>
                <div className="text-[14px] font-medium" style={{ color: INK }}>
                  {copiedDraft ? "Draft copied" : `Copy ${draft.filename}`}
                </div>
                <div className="text-[11.5px] mt-1" style={{ color: SUB }}>
                  {draft.body.split("\n").length} lines · personal use
                </div>
              </button>
              <Link
                href="/generate"
                className="rounded-xl border p-5 text-left transition-colors block"
                style={{ borderColor: BORDER, background: SURFACE }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-[10.5px] uppercase tracking-[0.22em]"
                    style={{ fontFamily: MONO, color: MUTED }}
                  >
                    desk
                  </span>
                  <ArrowUpRight className="h-4 w-4" style={{ color: SUB }} />
                </div>
                <div className="text-[14px] font-medium" style={{ color: INK }}>
                  Submit for editorial review
                </div>
                <div className="text-[11.5px] mt-1" style={{ color: SUB }}>
                  curators verify compliance and publish to the public library
                </div>
              </Link>
            </div>

            <div className="mt-10 flex items-center justify-between pt-6 border-t" style={{ borderColor: BORDER_SOFT }}>
              <Link href="/generate" className="text-[12.5px]" style={{ color: SUB }}>
                ← generate another
              </Link>
              <Link
                href="/library"
                className="inline-flex items-center gap-1.5 text-[12.5px]"
                style={{ color: VIOLET }}
              >
                Browse the curated library
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>
      </>
    );
  }

  // Non-draft ids redirect via the effect above; render a lightweight placeholder
  // for the brief moment before the redirect lands.
  return (
    <div className="mx-auto max-w-3xl px-6 lg:px-8 py-32 text-center">
      <p className="text-[13px]" style={{ color: SUB }}>
        Redirecting…
      </p>
    </div>
  );
}

export default CopySuccess;
