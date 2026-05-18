import { BORDER, INK, MONO, MUTED, SUB, SURFACE, VIOLET } from "../lib/tokens";
import {
  PROJECT_TYPES,
  STYLES,
  TOOL_OPTIONS,
  useLibraryFilters,
} from "../lib/libraryFilters";

type Row = { key: "type" | "style" | "tool"; label: string; options: readonly string[] };

const ROWS: Row[] = [
  { key: "type", label: "Project type", options: PROJECT_TYPES },
  { key: "style", label: "Style", options: STYLES },
  { key: "tool", label: "Tool", options: TOOL_OPTIONS },
];

export function LibraryFilterStrip({ count, stickyTop = 56 }: { count: number; stickyTop?: number }) {
  const { filters, setFilter, reset, activeCount } = useLibraryFilters();

  return (
    <div
      className="sticky z-30 -mx-6 lg:-mx-8 px-6 lg:px-8 py-3 mb-6 backdrop-blur-md border-y"
      style={{
        top: stickyTop,
        background: "rgba(10,10,11,0.85)",
        borderColor: BORDER,
      }}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          {ROWS.map((row) => (
            <div key={row.key} className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[10px] uppercase tracking-[0.22em] mr-1 min-w-[88px]"
                style={{ fontFamily: MONO, color: MUTED }}
              >
                {row.label}
              </span>
              {row.options.map((opt) => {
                const active = filters[row.key] === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => setFilter(row.key, opt)}
                    aria-pressed={active}
                    className="h-7 px-2.5 rounded-full border text-[11.5px] transition-colors"
                    style={{
                      borderColor: active ? VIOLET : BORDER,
                      background: active ? `${VIOLET}1A` : SURFACE,
                      color: active ? INK : SUB,
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className="text-[10.5px] uppercase tracking-[0.22em]"
            style={{ fontFamily: MONO, color: MUTED }}
          >
            results
          </span>
          <span className="text-[18px] font-medium leading-none" style={{ color: INK }}>
            {count}
          </span>
          {activeCount > 0 ? (
            <button
              onClick={reset}
              className="text-[11px] mt-1"
              style={{ color: SUB, fontFamily: MONO }}
            >
              clear ({activeCount})
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
