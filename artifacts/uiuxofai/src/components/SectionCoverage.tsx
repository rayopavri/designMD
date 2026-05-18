import { BORDER, INK, LIME, MONO, MUTED, PEACH, SUB, SURFACE_2 } from "../lib/tokens";
import type { SectionCoverage as Coverage } from "../lib/bundles";

const SECTIONS: { key: keyof Coverage; label: string }[] = [
  { key: "colors", label: "Colors" },
  { key: "typography", label: "Typography" },
  { key: "spacing", label: "Spacing" },
  { key: "radius", label: "Radius" },
  { key: "components", label: "Components" },
  { key: "motion", label: "Motion" },
  { key: "dosDonts", label: "Do's & Don'ts" },
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
        style={{ fontFamily: MONO, color: MUTED }}
      >
        what's covered
      </div>
      <ul className="space-y-2">
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
    </div>
  );
}
