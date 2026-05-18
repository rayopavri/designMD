export const BG = "#FBF7F2";
export const BG_SOFT = "#FDFAF6";
export const INK = "#1A1714";
export const SUB = "#7A6E63";
export const FAINT = "#A89C8E";
export const BORDER = "#E7DFD3";
export const BORDER_SOFT = "#EFE9DE";
export const LAVENDER = "#B7A6FF";
export const LIME = "#C5E96A";
export const PEACH = "#FFC8AF";

export const SERIF = `"Fraunces", "PP Editorial New", "Spectral", Georgia, serif`;
export const SANS = `"Inter", system-ui, sans-serif`;
export const MONO = `"JetBrains Mono", ui-monospace, monospace`;

export function Header({ active = "Collection" }: { active?: string }) {
  const nav = ["Collection", "Plates", "Generate", "Journal", "Vote"];
  return (
    <header className="w-full" style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}>
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-10">
        <div className="flex items-baseline gap-3">
          <a href="#" className="text-[22px] font-semibold tracking-tight" style={{ fontFamily: SERIF, color: INK }}>
            UIUXofAi
          </a>
          <span className="text-[10.5px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: SUB }}>
            № 042
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-[13px]" style={{ fontFamily: SANS, color: INK }}>
          {nav.map((n) => (
            <a
              key={n}
              href="#"
              className="relative pb-1"
              style={
                n === active
                  ? { borderBottom: `1px solid ${INK}` }
                  : { color: SUB }
              }
            >
              {n}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3" style={{ fontFamily: SANS }}>
          <a href="#" className="text-[13px]" style={{ color: INK }}>
            Sign in
          </a>
          <button className="h-9 rounded-full px-4 text-[13px] font-medium text-white" style={{ background: INK }}>
            Open collection
          </button>
        </div>
      </div>
    </header>
  );
}

export function SectionLabel({ n, t }: { n: string; t: string }) {
  return (
    <div className="flex items-center gap-3 text-[10.5px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: SUB }}>
      <span style={{ color: INK }}>{n}</span>
      <span className="h-px w-6" style={{ background: BORDER }} />
      <span>{t}</span>
    </div>
  );
}

export function PaletteStrip({ colors }: { colors: string[] }) {
  return (
    <div className="flex h-1.5 w-full">
      {colors.map((c, i) => (
        <div key={i} className="flex-1" style={{ backgroundColor: c }} />
      ))}
    </div>
  );
}

export function CoverageBar({ label, score, value }: { label: string; score: number; value?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline text-[12.5px]" style={{ color: SUB }}>
        <span>{label}</span>
        {value ? (
          <span style={{ fontFamily: MONO, color: INK }}>{value}</span>
        ) : (
          <span style={{ fontFamily: MONO, color: INK }}>{score}%</span>
        )}
      </div>
      <div className="h-[3px] w-full overflow-hidden" style={{ background: BORDER }}>
        <div className="h-full" style={{ width: `${score}%`, background: INK }} />
      </div>
    </div>
  );
}

export function ChipLime({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full" style={{ background: LIME, color: INK, fontFamily: MONO }}>
      {children}
    </span>
  );
}

export function ChipPeach({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full" style={{ background: PEACH, color: INK, fontFamily: MONO }}>
      {children}
    </span>
  );
}

export function ChipLavender({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full" style={{ background: LAVENDER, color: INK, fontFamily: MONO }}>
      {children}
    </span>
  );
}
