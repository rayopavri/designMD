import { Check, X } from "lucide-react";
import { Header, SectionLabel, PaletteStrip, ChipLime, ChipPeach, BG, BG_SOFT, INK, SUB, FAINT, BORDER, BORDER_SOFT, SERIF, MONO } from "./_Shared";
import "./_group.css";

export function Voting() {
  return (
    <div className="designmd-root">
      <Header active="Vote" />

      <main className="flex-1 mx-auto max-w-5xl px-10 py-14 w-full flex gap-12" style={{ background: BG }}>
        <div className="flex-1 max-w-xl">
          {/* Bundle context card */}
          <div className="rounded-xl border bg-white overflow-hidden mb-8" style={{ borderColor: BORDER }}>
            <PaletteStrip colors={["#FF4F00", "#1A1A1A", "#F4F4F4"]} />
            <div className="px-5 py-3 flex items-center justify-between" style={{ background: BG_SOFT }}>
              <div className="flex items-baseline gap-3">
                <span className="text-[10.5px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: SUB }}>
                  Plate 038
                </span>
                <span className="text-[18px]" style={{ fontFamily: SERIF, color: INK }}>Y Combinator</span>
              </div>
              <span className="text-[11px]" style={{ fontFamily: MONO, color: SUB }}>id 8a9b2c</span>
            </div>
          </div>

          <div className="text-center mb-10">
            <SectionLabel n="Index 01" t="Did this plate hold?" />
            <h1 className="mt-4 text-[44px] leading-[1.05] font-normal" style={{ fontFamily: SERIF, color: INK }}>
              Did the bundle<br />
              <em className="font-normal" style={{ fontStyle: "italic" }}>land on-brand?</em>
            </h1>
            <p className="mt-4 text-[14.5px] leading-[1.6]" style={{ color: SUB }}>
              Your vote calibrates the companion prompt for everyone.
            </p>
          </div>

          {/* Vote buttons */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <button className="rounded-xl bg-white p-7 text-center transition-colors hover:bg-[#FDFAF6]" style={{ border: `1px solid ${BORDER}` }}>
              <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "#C5E96A" }}>
                <Check className="h-5 w-5" style={{ color: INK }} />
              </div>
              <div className="text-[15px]" style={{ fontFamily: SERIF, color: INK }}>Yes, it landed</div>
            </button>
            <button className="rounded-xl bg-white p-7 text-center" style={{ border: `2px solid ${INK}` }}>
              <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "#FFC8AF" }}>
                <X className="h-5 w-5" style={{ color: INK }} />
              </div>
              <div className="text-[15px]" style={{ fontFamily: SERIF, color: INK }}>Something was off</div>
            </button>
          </div>

          {/* Expanded feedback */}
          <div className="rounded-2xl border bg-white p-8" style={{ borderColor: BORDER }}>
            <SectionLabel n="Index 02" t="What drifted?" />
            <div className="mt-5 flex flex-wrap gap-2">
              {["Colours were off", "Typography ignored", "Spacing wrong", "Too generic", "Components missing", "Other"].map((tag, i) => (
                <button
                  key={tag}
                  className="h-8 rounded-full px-3.5 text-[12.5px]"
                  style={
                    i === 0
                      ? { background: "#FFC8AF", color: INK, border: `1px solid #E7B19B`, fontFamily: MONO }
                      : { background: "white", color: SUB, border: `1px solid ${BORDER}` }
                  }
                >
                  {tag}
                </button>
              ))}
            </div>

            <div className="mt-7">
              <label className="block text-[12.5px] mb-2" style={{ color: INK }}>Context (optional)</label>
              <textarea
                className="w-full rounded-md p-3 text-[13.5px] outline-none resize-none h-24 bg-white"
                style={{ border: `1px solid ${BORDER}`, color: INK }}
                defaultValue="It used #FF0000 instead of the official #FF4F00 for the primary button."
              />
            </div>

            <div className="mt-5">
              <label className="block text-[12.5px] mb-2" style={{ color: INK }}>Which model did you use?</label>
              <select className="w-full h-10 rounded-md px-3 text-[13.5px] bg-white outline-none" style={{ border: `1px solid ${BORDER}`, color: INK }}>
                <option>Claude Projects</option>
                <option>Cursor</option>
                <option>Lovable</option>
                <option>Figma Make</option>
              </select>
            </div>

            <button className="mt-7 w-full h-11 rounded-full text-[13.5px] font-medium text-white" style={{ background: INK }}>
              Submit feedback
            </button>
          </div>
        </div>

        {/* Right rail */}
        <aside className="hidden lg:block w-72 space-y-6">
          <div className="rounded-xl border p-6" style={{ borderColor: BORDER, background: BG_SOFT }}>
            <SectionLabel n="Index 03" t="Editorial queue" />
            <p className="mt-3 text-[13px] leading-[1.6]" style={{ color: SUB }}>
              Your vote feeds the editorial queue. Plates that drop below 60% are auto-flagged
              for review by the curation desk.
            </p>
          </div>

          <div className="rounded-xl border bg-white p-6" style={{ borderColor: BORDER }}>
            <SectionLabel n="Index 04" t="Recent feedback" />
            <div className="mt-4 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ChipPeach>typography ignored</ChipPeach>
                </div>
                <div className="text-[11.5px]" style={{ fontFamily: MONO, color: SUB }}>10 mins ago · cursor</div>
              </div>
              <div className="h-px" style={{ background: BORDER_SOFT }} />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ChipLime>worked perfectly</ChipLime>
                </div>
                <div className="text-[11.5px]" style={{ fontFamily: MONO, color: SUB }}>1 hour ago · claude</div>
              </div>
              <div className="h-px" style={{ background: BORDER_SOFT }} />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ChipPeach>spacing wrong</ChipPeach>
                </div>
                <div className="text-[11.5px]" style={{ fontFamily: MONO, color: SUB }}>3 hours ago · lovable</div>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
