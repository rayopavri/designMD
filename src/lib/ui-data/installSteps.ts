import type { ToolId } from "./toolPref";

export type InstallStep = { n: string; t: string; cmd?: string };

export const INSTALL_STEPS: Record<ToolId, InstallStep[]> = {
  claude: [
    { n: "1", t: "Create a new Project in Claude and open Project Instructions", cmd: "Projects → New project → Instructions" },
    { n: "2", t: "Paste the design.md spec as project knowledge" },
    { n: "3", t: "Paste the companion prompt as the project's custom instructions" },
    { n: "4", t: "Start designing — Claude will treat the spec as truth" },
  ],
  cursor: [
    { n: "1", t: "Open .cursorrules in your project root (create if missing)" },
    { n: "2", t: "Paste the companion prompt at the top of the rules file" },
    { n: "3", t: "Drop design.md into the repo at /docs/design.md and reference it" },
    { n: "4", t: "Use @design.md in Cursor chat to anchor every generation" },
  ],
  lovable: [
    { n: "1", t: "Open the Lovable project settings → Custom prompt" },
    { n: "2", t: "Paste the companion prompt into the custom instructions" },
    { n: "3", t: "Upload design.md as a project attachment" },
    { n: "4", t: "Reference design.md by name in every Lovable prompt" },
  ],
  figma: [
    { n: "1", t: "In Figma Make, open the design system panel" },
    { n: "2", t: "Paste design.md into the tokens import" },
    { n: "3", t: "Set the companion prompt as the generator's system prompt" },
    { n: "4", t: "Generate — Figma Make will honor the declared tokens" },
  ],
};
