"use client";

import { Check, Copy } from "lucide-react";
import { BORDER, INK, LIME, MONO, MUTED, SUB, SURFACE_2 } from "@/lib/ui-data/tokens";

export function ArtifactChip({
  filename,
  hint,
  meta,
  accent,
  onCopy,
  copied,
}: {
  filename: string;
  hint: string;
  meta: string;
  accent: string;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div
      className="rounded-lg border p-3.5"
      style={{ borderColor: BORDER, background: SURFACE_2 }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
          <span className="text-[12.5px] font-medium" style={{ color: INK, fontFamily: MONO }}>
            {filename}
          </span>
        </div>
        {onCopy && (
          <button
            type="button"
            onClick={onCopy}
            title={copied ? "Copied!" : `Copy ${filename}`}
            className="h-6 w-6 rounded flex items-center justify-center transition-colors hover:opacity-80"
            style={{ color: copied ? LIME : MUTED }}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      <div className="text-[11.5px] leading-[1.5]" style={{ color: SUB }}>
        {hint}
      </div>
      <div className="text-[10.5px] mt-2" style={{ fontFamily: MONO, color: MUTED }}>
        {meta}
      </div>
    </div>
  );
}
