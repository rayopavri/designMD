import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Header, SectionLabel, ChipLime, BG, BG_SOFT, INK, SUB, FAINT, BORDER, BORDER_SOFT, SERIF, MONO } from "./_Shared";
import "./_group.css";

type ToolKey = "Claude" | "Cursor" | "Lovable" | "Figma Make";

const toolSteps: Record<ToolKey, { title: string; steps: { label: string; hint: string }[] }> = {
  Claude: {
    title: "How to apply this in Claude Projects",
    steps: [
      { label: "Create a new Project in Claude and open Project Instructions", hint: "Projects → New project → Instructions" },
      { label: "Paste the copied bundle at the top of the instructions", hint: "Cmd + V" },
      { label: "Start a new chat in the Project — every reply now follows the system", hint: "Try the test prompt below" },
    ],
  },
  Cursor: {
    title: "How to apply this in Cursor",
    steps: [
      { label: "Open your project root and create .cursor/rules/design-system.mdc", hint: "touch .cursor/rules/design-system.mdc" },
      { label: "Paste the copied bundle into the file and save", hint: "Cmd + V · Cmd + S" },
      { label: "Reload the Cursor workspace so the rule is picked up", hint: "Cmd + Shift + P → Reload Window" },
    ],
  },
  Lovable: {
    title: "How to apply this in Lovable",
    steps: [
      { label: "Open your Lovable project and go to Settings → Knowledge", hint: "lovable.dev/projects/[id]/knowledge" },
      { label: "Paste the bundle as a new knowledge entry titled 'Design system'", hint: "Cmd + V" },
      { label: "Resume your chat — Lovable will style new components from the system", hint: "No restart needed" },
    ],
  },
  "Figma Make": {
    title: "How to apply this in Figma Make",
    steps: [
      { label: "Open Figma Make and click the system prompt icon in the chat input", hint: "Figma Make → System prompt" },
      { label: "Paste the bundle into the system prompt field", hint: "Cmd + V" },
      { label: "Generate a frame — output follows the tokens, type, and spacing exactly", hint: "Try the test prompt below" },
    ],
  },
};

export function CopySuccess() {
  const [activeTool, setActiveTool] = useState<ToolKey>("Claude");
  const tools: ToolKey[] = ["Claude", "Cursor", "Lovable", "Figma Make"];
  const active = toolSteps[activeTool];

  return (
    <div className="designmd-root">
      <Header active="Collection" />

      <main className="flex-1 flex flex-col items-center mx-auto max-w-3xl px-10 py-20 w-full text-center" style={{ background: BG }}>
        <div className="mb-7 inline-flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: SUB }}>
          <ChipLime>
            <Check className="h-3 w-3 mr-1" />
            copied
          </ChipLime>
          <span>Plate 041 · Stripe</span>
        </div>

        <h1 className="text-[64px] leading-[1.02] font-normal" style={{ fontFamily: SERIF, color: INK }}>
          The bundle is on<br />
          <em className="font-normal" style={{ fontStyle: "italic" }}>your clipboard.</em>
        </h1>
        <p className="mt-5 text-[15.5px] leading-[1.6] max-w-[28rem]" style={{ color: SUB }}>
          1,847 tokens — companion prompt and{" "}
          <span style={{ fontFamily: MONO, color: INK }}>design.md</span> together. Pick where it
          should land.
        </p>

        <div className="w-full mt-12 text-left rounded-2xl border bg-white overflow-hidden" style={{ borderColor: BORDER, boxShadow: "0 20px 50px -30px rgba(40, 25, 15, 0.14)" }}>
          <div className="flex border-b" style={{ borderColor: BORDER, background: BG }}>
            {tools.map((tool) => (
              <button
                key={tool}
                onClick={() => setActiveTool(tool)}
                className="flex-1 py-3.5 text-[13px] transition-colors"
                style={
                  activeTool === tool
                    ? { color: INK, borderBottom: `2px solid ${INK}`, fontFamily: MONO }
                    : { color: SUB, borderBottom: "2px solid transparent", fontFamily: MONO }
                }
              >
                {tool}
              </button>
            ))}
          </div>

          <div className="p-8">
            <SectionLabel n="Index 01" t={active.title.replace("How to apply this in ", "")} />
            <h3 className="mt-4 text-[24px]" style={{ fontFamily: SERIF, color: INK }}>{active.title}</h3>

            <ol className="mt-8 space-y-7">
              {active.steps.map((step, i) => (
                <li key={i} className="flex gap-5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px]" style={{ background: INK, color: "white", fontFamily: MONO }}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-[14px]" style={{ color: INK }}>{step.label}</p>
                    <div className="mt-2 rounded-md px-3 py-2 text-[12.5px] inline-flex items-center gap-2" style={{ background: BG_SOFT, border: `1px solid ${BORDER}`, fontFamily: MONO, color: SUB }}>
                      {i === 1 ? <Copy className="h-3 w-3" /> : null}
                      {step.hint}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="mt-10 w-full text-left rounded-2xl border p-7" style={{ borderColor: BORDER, background: BG_SOFT }}>
          <SectionLabel n="Index 02" t="A test prompt" />
          <h3 className="mt-3 text-[22px]" style={{ fontFamily: SERIF, color: INK }}>
            Paste this in {activeTool}.
          </h3>
          <div className="mt-4 relative group">
            <div className="rounded-md bg-white border p-4 text-[14px] leading-[1.5]" style={{ borderColor: BORDER, color: INK, fontFamily: SERIF, fontStyle: "italic" }}>
              "Build a pricing card component following our design system. Include a primary
              CTA and 3 feature bullet points."
            </div>
            <button className="absolute right-3 top-3 h-7 px-2 rounded-md text-[11px] inline-flex items-center gap-1" style={{ border: `1px solid ${BORDER}`, background: "white", color: SUB, fontFamily: MONO }}>
              <Copy className="h-3 w-3" />
              copy
            </button>
          </div>
          <div className="mt-3 text-[11.5px]" style={{ fontFamily: MONO, color: SUB }}>
            If the card renders with #635BFF and Inter at -0.01em letter-spacing, the system
            took.
          </div>
        </div>

        <div className="mt-10 h-px w-full" style={{ background: BORDER_SOFT }} />
      </main>
    </div>
  );
}
