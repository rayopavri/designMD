import { Check, Circle, Loader2 } from "lucide-react";
import { Header, SectionLabel, CoverageBar, ChipLime, BG, BG_SOFT, INK, SUB, FAINT, BORDER, SERIF, MONO } from "./_Shared";
import "./_group.css";

export function UrlGenerator() {
  return (
    <div className="designmd-root">
      <Header active="Generate" />

      <main className="flex-1 mx-auto max-w-5xl px-10 py-20 w-full" style={{ background: BG }}>
        <div className="text-center mb-12">
          <SectionLabel n="Index 01" t="From any URL" />
          <h1 className="mt-5 text-[64px] leading-[1.02] font-medium" style={{ fontFamily: SERIF, color: INK }}>
            Extract any brand's<br />
            <span style={{ color: "#8E8E94" }}>system in 12 seconds.</span>
          </h1>
          <p className="mt-6 mx-auto max-w-[38rem] text-[15.5px] leading-[1.6]" style={{ color: SUB }}>
            Paste a URL. We'll scrape it, lift the tokens, write a calibrated companion
            prompt, and score the coverage — ready to drop into Claude.
          </p>
        </div>

        {/* URL input */}
        <div className="mx-auto max-w-3xl mb-14">
          <div className="relative">
            <input
              type="url"
              value="https://nytimes.com"
              readOnly
              className="w-full h-16 rounded-full bg-[#101012] pl-7 pr-40 text-[15px] outline-none"
              style={{ border: `1px solid ${INK}`, color: INK, fontFamily: MONO, boxShadow: "0 10px 28px -16px rgba(40, 25, 15, 0.12)" }}
            />
            <button className="absolute right-2 top-2 bottom-2 rounded-full px-5 text-[13px] font-medium text-[#0A0A0B] inline-flex items-center gap-2" style={{ background: INK }}>
              <Loader2 className="h-4 w-4 animate-spin" />
              Extracting
            </button>
          </div>
          <div className="mt-3 text-center text-[11.5px]" style={{ fontFamily: MONO, color: SUB }}>
            free during public beta · 4.8s elapsed of ~12s
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pipeline */}
          <div className="rounded-2xl border bg-[#101012] p-8" style={{ borderColor: BORDER }}>
            <SectionLabel n="Index 02" t="Extraction pipeline" />

            <ol className="mt-8 relative space-y-7 before:absolute before:left-3 before:top-1 before:bottom-1 before:w-px" style={{ }}>
              <div className="absolute left-3 top-1 bottom-1 w-px" style={{ background: BORDER }} />

              {[
                { state: "done", label: "Scraping via Firecrawl", hint: "14 pages · 2.4s" },
                { state: "done", label: "Extracting tokens (Gemini Flash)", hint: "12 colors, 3 fonts · 3.1s" },
                { state: "active", label: "Writing companion prompt (Claude Sonnet)", hint: "calibrating constraints… · 4.2s" },
                { state: "pending", label: "Scoring coverage", hint: "pending" },
                { state: "pending", label: "Bundle ready", hint: "pending" },
              ].map((s, i) => (
                <li key={i} className="relative flex items-start gap-4">
                  <div className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full" style={{
                    background:
                      s.state === "done" ? INK :
                      s.state === "active" ? "white" :
                      BG_SOFT,
                    color: s.state === "active" ? INK : undefined,
                    border: s.state === "active" ? `1px solid ${INK}` : `1px solid ${BORDER}`,
                  }}>
                    {s.state === "done" ? (
                      <Check className="h-3 w-3 text-[#0A0A0B]" />
                    ) : s.state === "active" ? (
                      <Loader2 className="h-3 w-3 animate-spin" style={{ color: INK }} />
                    ) : (
                      <Circle className="h-2 w-2" style={{ color: SUB }} />
                    )}
                  </div>
                  <div className="flex-1" style={{ opacity: s.state === "pending" ? 0.45 : 1 }}>
                    <div className="text-[13.5px]" style={{ color: INK }}>{s.label}</div>
                    <div className="text-[11.5px] mt-0.5" style={{ fontFamily: MONO, color: SUB }}>{s.hint}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Early preview */}
          <div className="rounded-2xl border bg-[#101012] overflow-hidden" style={{ borderColor: BORDER }}>
            <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: BORDER, background: BG_SOFT }}>
              <SectionLabel n="Index 03" t="Early preview" />
              <span className="text-[11px]" style={{ fontFamily: MONO, color: SUB }}>nytimes.com</span>
            </div>

            <div className="p-7 space-y-7">
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.22em] mb-3" style={{ fontFamily: MONO, color: SUB }}>
                  Detected palette
                </div>
                <div className="h-12 w-full rounded overflow-hidden flex" style={{ border: `1px solid ${BORDER}` }}>
                  {["#000000", "#333333", "#E2E2E2", "#F4F4F4", "#FFFFFF"].map((c) => (
                    <div key={c} className="flex-1" style={{ background: c }} />
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10.5px] uppercase tracking-[0.22em] mb-3" style={{ fontFamily: MONO, color: SUB }}>
                  Detected typography
                </div>
                <div className="space-y-2.5">
                  <div className="p-4 rounded" style={{ background: BG_SOFT, border: `1px solid ${BORDER}` }}>
                    <div className="text-[24px]" style={{ fontFamily: SERIF, color: INK }}>Cheltenham</div>
                    <div className="text-[11px] mt-0.5" style={{ fontFamily: MONO, color: SUB }}>primary serif · headlines</div>
                  </div>
                  <div className="p-4 rounded" style={{ background: BG_SOFT, border: `1px solid ${BORDER}` }}>
                    <div className="text-[18px]" style={{ color: INK }}>NYT Franklin</div>
                    <div className="text-[11px] mt-0.5" style={{ fontFamily: MONO, color: SUB }}>primary sans · UI</div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t" style={{ borderColor: BORDER, opacity: 0.45 }}>
                <CoverageBar label="Estimated coverage" score={85} />
                <div className="mt-3 flex items-center justify-between text-[11.5px]" style={{ fontFamily: MONO, color: SUB }}>
                  <span>final score pending</span>
                  <ChipLime>preview</ChipLime>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
