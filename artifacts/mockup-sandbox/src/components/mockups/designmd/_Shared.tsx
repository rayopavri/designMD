import { Search } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#E8E6DF] bg-[#FDFCF8]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <a href="#" className="flex items-center gap-2">
            <span className="designmd-serif text-2xl font-bold tracking-tight text-[#111110]">
              designmd
            </span>
          </a>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#6B6A66]">
            <a href="#" className="text-[#111110] transition-colors hover:text-[#111110]">Library</a>
            <a href="#" className="transition-colors hover:text-[#111110]">Generate</a>
            <a href="#" className="transition-colors hover:text-[#111110]">Docs</a>
            <a href="#" className="transition-colors hover:text-[#111110]">Vote queue</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden lg:block">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#6B6A66]" />
            <input
              type="text"
              placeholder="Search bundles..."
              className="h-9 w-64 rounded-md border border-[#E8E6DF] bg-white pl-9 pr-4 text-sm outline-none placeholder:text-[#6B6A66] focus:border-[#111110] focus:ring-1 focus:ring-[#111110]"
            />
          </div>
          <button className="hidden h-9 items-center justify-center rounded-md bg-[#111110] px-4 text-sm font-medium text-white shadow transition-colors hover:bg-[#111110]/90 md:inline-flex">
            Sign In
          </button>
        </div>
      </div>
    </header>
  );
}

export function PaletteStrip({ colors }: { colors: string[] }) {
  return (
    <div className="flex h-1.5 w-full">
      {colors.map((c, i) => (
        <div key={i} className="flex-1" style={{ backgroundColor: c }}></div>
      ))}
    </div>
  );
}

export function CoverageBar({ label, score, value }: { label: string, score: number, value?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-medium text-[#6B6A66]">
        <span>{label}</span>
        {value ? <span className="designmd-mono text-[#111110]">{value}</span> : <span>{score}%</span>}
      </div>
      <div className="h-2 w-full rounded-full bg-[#E8E6DF] overflow-hidden">
        <div className="h-full bg-[#111110]" style={{ width: `${score}%` }}></div>
      </div>
    </div>
  );
}
