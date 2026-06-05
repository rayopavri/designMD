"use client";

import { SectionLabel } from "@/components/ui/Shell";
import { ItemCard } from "@/components/ui/ItemCard";
import { useRelatedBundles } from "@/hooks/useRelatedBundles";
import { BORDER, BORDER_SOFT, SUB } from "@/lib/ui-data/tokens";

/**
 * "Related design skills" — neighbours matched on category / design style /
 * tool compatibility (see getRelatedBundles). Renders nothing while loading
 * or when there are no matches, so the section never shows an empty shell.
 */
export function RelatedSkills({ slug, n }: { slug: string; n: string }) {
  const { items, loading } = useRelatedBundles(slug);
  if (loading || items.length === 0) return null;

  return (
    <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-8 py-16">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-3">
            <SectionLabel n={n} t="Related design skills" />
            <h2 className="mt-3 text-[28px] leading-[1.08] font-medium tracking-[-0.018em]">
              More systems{" "}
              <span style={{ color: SUB }}>in the same vein.</span>
            </h2>
            <p className="mt-5 text-[13.5px] leading-[1.6]" style={{ color: SUB }}>
              Matched on category, design style, and tool compatibility.
            </p>
          </div>
          <div className="col-span-12 lg:col-span-9">
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px border"
              style={{ background: BORDER, borderColor: BORDER }}
            >
              {items.map((it) => (
                <ItemCard key={it.id} item={it} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
