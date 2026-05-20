"use client";

import { useId, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`w-full flex items-center justify-between text-[10.5px] uppercase tracking-[0.22em] ${open ? "mb-3" : ""}`}
        style={{ fontFamily: MONO, color: MUTED }}
      >
        <span>what's covered</span>
        <span
          aria-hidden="true"
          className="inline-block leading-none transition-transform duration-150"
          style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
        >
          +
        </span>
      </button>
      {open && (
        <ul id={panelId} className="space-y-2">
          {SECTIONS.map(({ key, label }) => {
            const n = coverage[key];
            const s = status(n);
            return (
              <li key={key} className="flex items-center gap-3 text-[12.5px]">
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: s.color }}
                />
                <span style={{ color: INK }} className="min-w-[88px]">
                  {label}
                </span>
                <div
                  className="flex-1 h-1 rounded-sm overflow-hidden"
                  style={{ background: SURFACE_2, border: `1px solid ${BORDER}` }}
                >
                  <span
                    className="block h-full"
                    style={{ width: `${Math.max(0, Math.min(100, n))}%`, background: s.color }}
                  />
                </div>
                <span
                  className="text-[10.5px] uppercase tracking-[0.18em] min-w-[56px] text-right"
                  style={{ fontFamily: MONO, color: SUB }}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
