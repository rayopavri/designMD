import { BORDER, MONO, MUTED } from "@/lib/ui-data/tokens";

export function LegalDisclaimer({ name }: { name: string }) {
  return (
    <div className="border-t" style={{ borderColor: BORDER }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-8 py-6">
        <p className="text-[11px] leading-[1.5]" style={{ fontFamily: MONO, color: MUTED }}>
          Not affiliated with {name}. All trademarks belong to their respective owners.
        </p>
      </div>
    </div>
  );
}
