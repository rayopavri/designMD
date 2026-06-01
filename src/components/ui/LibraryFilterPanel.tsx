import { Search } from "lucide-react";
import { BORDER, INK, MONO, MUTED, SUB, SURFACE, VIOLET } from "@/lib/ui-data/tokens";
import { CATEGORIES, useLibraryFilters } from "@/lib/ui-data/libraryFilters";

type Props = {
  query: string;
  onQueryChange: (v: string) => void;
};

export function LibraryFilterPanel({ query, onQueryChange }: Props) {
  const { filters, setCategory } = useLibraryFilters();

  return (
    <div className="space-y-8">
      <Section label="Search">
        <div className="relative">
          <Search
            className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: MUTED }}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Linear, Figma, Stripe…"
            className="w-full h-9 rounded-md border pl-9 pr-3 text-[12.5px]"
            style={{ borderColor: BORDER, background: SURFACE, color: INK }}
          />
        </div>
      </Section>

      <Section label="Category">
        {CATEGORIES.map((c) => (
          <Row
            key={c}
            label={c}
            checked={filters.category === c}
            onChange={() => setCategory(c)}
          />
        ))}
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
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

function Row({
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
        className="relative inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border shrink-0"
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
      <span className="flex-1 truncate" style={{ color: checked ? INK : SUB }}>
        {label}
      </span>
    </label>
  );
}
