import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Header } from "./_Shared";
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
      { label: "Paste the copied bundle into the file and save", hint: "Cmd + V, Cmd + S" },
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
    <div className="designmd-root bg-white">
      <Header />
      
      <main className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto px-6 py-20 w-full text-center">
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-green-50 border border-green-200">
          <Check className="h-10 w-10 text-green-600" />
        </div>
        
        <h1 className="designmd-serif text-4xl font-bold text-[#111110] mb-3">Stripe bundle copied</h1>
        <p className="text-[#6B6A66] text-lg mb-12">1,847 tokens ready for your clipboard.</p>

        <div className="w-full text-left rounded-xl border border-[#E8E6DF] bg-white shadow-sm overflow-hidden">
          <div className="flex border-b border-[#E8E6DF] bg-[#FDFCF8]">
            {tools.map((tool) => (
              <button
                key={tool}
                onClick={() => setActiveTool(tool)}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTool === tool
                    ? "border-[#111110] text-[#111110]"
                    : "border-transparent text-[#6B6A66] hover:text-[#111110]"
                }`}
              >
                {tool}
              </button>
            ))}
          </div>
          
          <div className="p-8">
            <h3 className="font-semibold text-[#111110] mb-6">{active.title}</h3>
            
            <div className="space-y-8">
              {active.steps.map((step, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#111110] text-xs text-white">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#111110] mb-2">{step.label}</p>
                    <div className="rounded-lg border border-[#E8E6DF] bg-[#FAFAFA] p-3 text-[#6B6A66] text-xs designmd-mono flex items-center gap-2">
                      {i === 1 ? <Copy className="h-3 w-3" /> : null}
                      {step.hint}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 bg-[#FDFCF8] rounded-xl border border-[#E8E6DF] p-8 w-full">
          <h3 className="font-semibold text-[#111110] mb-3">Try a test prompt</h3>
          <p className="text-[#6B6A66] text-sm mb-4">Paste this into Claude to verify the system is working:</p>
          <div className="relative group">
            <div className="rounded-lg bg-white border border-[#E8E6DF] p-4 text-left font-mono text-sm text-[#111110]">
              "Build a pricing card component following our design system. Include a primary CTA and 3 feature bullet points."
            </div>
            <button className="absolute right-3 top-3 rounded-md bg-[#F4F3EE] p-1.5 text-[#6B6A66] opacity-0 transition-opacity group-hover:opacity-100">
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}