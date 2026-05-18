import { Command, GitCommit } from "lucide-react";

// C2 "Command Bar" — dark editorial tokens
export const BG = "#0A0A0B";
export const BG_SOFT = "#101012";       // surface 1 (cards, inputs)
export const SURFACE_2 = "#15151A";     // surface 2 (chips, inset)
export const INK = "#F2F1EE";
export const SUB = "#8E8E94";
export const FAINT = "#5F5F66";
export const BORDER = "#1F1F23";
export const BORDER_SOFT = "#17171A";
export const LAVENDER = "#8B7BFF";      // violet accent (used as LAVENDER for compat)
export const VIOLET = "#8B7BFF";
export const LIME = "#C5E96A";
export const PEACH = "#E0B868";         // amber on dark
export const INK_ON_LIGHT = "#0A0A0B";  // dark text on light pill CTA

// SERIF intentionally aliased to Inter — Fraunces does not belong in the dark/precise direction.
export const SERIF = `"Inter", system-ui, sans-serif`;
export const SANS = `"Inter", system-ui, sans-serif`;
export const MONO = `"JetBrains Mono", ui-monospace, monospace`;

function StatusBar() {
  return (
    <div
      className="w-full text-[11px]"
      style={{ background: "#070708", borderBottom: `1px solid ${BORDER_SOFT}`, color: FAINT, fontFamily: MONO }}
    >
      <div className="mx-auto flex h-7 max-w-7xl items-center justify-between px-10">
        <div className="flex items-center gap-5">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIME, boxShadow: `0 0 6px ${LIME}88` }} />
            <span style={{ color: INK }}>operational</span>
          </span>
          <span>240 systems · 4,812 specs</span>
          <span className="hidden md:inline">edge · iad1 / fra1 / sin1</span>
        </div>
        <div className="flex items-center gap-5">
          <span className="inline-flex items-center gap-1.5">
            <GitCommit className="h-3 w-3" />
            <span>build 8a9b2c · v0.42.1</span>
          </span>
          <span className="hidden md:inline">may 18 · 18:21 UTC</span>
        </div>
      </div>
    </div>
  );
}

export function Header({ active = "Collection" }: { active?: string }) {
  const nav = ["Collection", "Plates", "Generate", "Journal", "Vote"];
  return (
    <>
      <StatusBar />
      <header
        className="sticky top-0 z-50 w-full border-b backdrop-blur-md"
        style={{ background: "rgba(10,10,11,0.78)", borderColor: BORDER }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-10">
          <div className="flex items-center gap-9">
            <a href="#" className="flex items-baseline gap-2 text-[14px] font-medium tracking-tight" style={{ color: INK }}>
              UIUXofAi
              <span className="text-[10px]" style={{ fontFamily: MONO, color: FAINT }}>/ 042</span>
            </a>
            <nav className="hidden md:flex items-center gap-7 text-[12.5px]" style={{ fontFamily: SANS, color: SUB }}>
              {nav.map((n) => {
                const isActive = n === active;
                return (
                  <a
                    key={n}
                    href="#"
                    className="inline-flex items-center gap-1.5"
                    style={{ color: isActive ? INK : SUB }}
                  >
                    {isActive ? <span className="h-1 w-1 rounded-full" style={{ background: VIOLET }} /> : null}
                    {n}
                  </a>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3" style={{ fontFamily: SANS }}>
            <div
              className="hidden lg:flex h-7 items-center gap-2 rounded-md border px-2 text-[11.5px]"
              style={{ borderColor: BORDER, color: FAINT, background: BG_SOFT }}
            >
              <Command className="h-3 w-3" />
              <span style={{ color: SUB }}>K</span>
              <span className="ml-1">Search 240 bundles</span>
            </div>
            <a href="#" className="text-[12.5px]" style={{ color: SUB }}>Sign in</a>
            <button className="h-7 rounded-full px-3 text-[12px] font-medium" style={{ background: INK, color: INK_ON_LIGHT }}>
              Open library
            </button>
          </div>
        </div>
      </header>
    </>
  );
}

export function SectionLabel({ n, t }: { n: string; t: string }) {
  // "Index 0X" → "§ 0X" treatment with violet § prefix
  const normalized = n.replace(/^Index\s*/i, "");
  return (
    <div className="flex items-center gap-2.5 text-[10.5px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: FAINT }}>
      <span style={{ color: VIOLET }}>§ {normalized}</span>
      <span className="h-px w-5" style={{ background: BORDER }} />
      <span style={{ color: SUB }}>{t}</span>
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
      <div className="flex justify-between items-baseline text-[12.5px]">
        <span style={{ color: SUB }}>{label}</span>
        <span style={{ fontFamily: MONO, color: INK }}>{value ?? `${score}%`}</span>
      </div>
      <div className="h-[3px] w-full overflow-hidden rounded-full" style={{ background: SURFACE_2 }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: VIOLET }} />
      </div>
    </div>
  );
}

function DotChip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10.5px] px-2 py-0.5 rounded-full"
      style={{ background: BG_SOFT, border: `1px solid ${BORDER}`, color: SUB, fontFamily: MONO }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

export function ChipLime({ children }: { children: React.ReactNode }) {
  return <DotChip color={LIME}>{children}</DotChip>;
}
export function ChipPeach({ children }: { children: React.ReactNode }) {
  return <DotChip color={PEACH}>{children}</DotChip>;
}
export function ChipLavender({ children }: { children: React.ReactNode }) {
  return <DotChip color={VIOLET}>{children}</DotChip>;
}
