"use client";

import { BORDER, INK, LIME, MONO, MUTED, PEACH, SUB, SURFACE_2 } from "@/lib/ui-data/tokens";
import type { SectionCoverage as Coverage } from "@/lib/ui-data/bundles";

const SECTIONS: { key: keyof Coverage; label: string }[] = [
  { key: "colors", label: "Colors" },
  { key: "typography", label: "Typography" },
  { key: "spacing", label: "Spacing" },
  { key: "elevation", label: "Elevation" },
  { key: "shapes", label: "Shapes" },
  { key: "components", label: "Components" },
  { key: "dosDonts", label: "Dos & Don'ts" },
];

function status(n: number): { label: string; color: string } {
  if (n >= 85) return { label: "strong", color: LIME };
  if (n >= 50) return { label: "thin", color: PEACH };
  return { label: "missing", color: MUTED };
}

export function SectionCoverage({ coverage }: { coverage: Coverage }) {
  return (
    <div>
      <div
        className="text-[10.5px] uppercase tracking-[0.22em] mb-3"
        style={{ fontFamily: MONO, color: SUB }}
      >
        what&apos;s covered
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {SECTIONS.map(({ key, label }) => {
          const n = coverage[key];
          const s = status(n);
          return (
            <li key={key} className="flex items-center gap-2 text-[11.5px]">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: s.color }} aria-hidden="true" />
              <span style={{ color: INK }} className="min-w-[64px]">{label}</span>
              <div
                className="flex-1 h-1 rounded-sm overflow-hidden"
                style={{ background: SURFACE_2, border: `1px solid ${BORDER}` }}
              >
                <span
                  role="progressbar"
                  aria-valuenow={Math.max(0, Math.min(100, n))}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${label} coverage: ${s.label}`}
                  className="block h-full"
                  style={{ width: `${Math.max(0, Math.min(100, n))}%`, background: s.color }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
