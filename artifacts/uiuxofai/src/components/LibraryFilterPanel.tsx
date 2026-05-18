import { BORDER, INK, MONO, MUTED, SUB, SURFACE, VIOLET } from "../lib/tokens";
import {
  PROJECT_TYPES,
  STYLES,
  TOOL_OPTIONS,
  useLibraryFilters,
  type LibraryFilters,
} from "../lib/libraryFilters";

type Row = {
  key: keyof LibraryFilters;
  label: string;
  options: readonly string[];
};

const ROWS: Row[] = [
  { key: "type", label: "Project type", options: PROJECT_TYPES },
  { key: "style", label: "Style", options: STYLES },
  { key: "tool", label: "Tool", options: TOOL_OPTIONS },
];

export function LibraryFilterPanel() {
  const { filters, setFilter, reset, activeCount } = useLibraryFilters();

  return (
    <div className="space-y-8">
      {activeCount > 0 ? (
        <div
          className="rounded-md border px-3 py-2 flex items-center justify-between"
          style={{ borderColor: BORDER, background: SURFACE }}
        >
          <span
            className="text-[10.5px] uppercase tracking-[0.22em]"
            style={{ fontFamily: MONO, color: MUTED }}
          >
            {activeCount} active
          </span>
          <button
            onClick={reset}
            className="text-[11px]"
            style={{ color: SUB, fontFamily: MONO }}
          >
            clear all
          </button>
        </div>
      ) : null}

      {ROWS.map((row) => (
        <FilterSection key={row.key} label={row.label}>
          {row.options.map((opt) => {
            const active = filters[row.key] === opt;
            return (
              <RadioRow
                key={opt}
                label={opt}
                checked={active}
                onChange={() => setFilter(row.key, opt)}
              />
            );
          })}
        </FilterSection>
      ))}
    </div>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="text-[10.5px] uppercase tracking-[0.22em] mb-3"
        style={{ fontFamily: MONO, color: MUTED }}
      >
        {label}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function RadioRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2.5 text-[12.5px] cursor-pointer">
      <span
        className="relative inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border"
        style={{ borderColor: checked ? VIOLET : BORDER, background: SURFACE }}
      >
        {checked ? (
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: VIOLET }} />
        ) : null}
      </span>
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span style={{ color: checked ? INK : SUB }}>{label}</span>
    </label>
  );
}
