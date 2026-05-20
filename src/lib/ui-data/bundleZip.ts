import JSZip from "jszip";
import { INSTALL_STEPS } from "./installSteps";
import { toolLabel, type ToolId } from "./toolPref";

export async function downloadBundleZip(args: {
  slug: string;
  name: string;
  version: string;
  designMd: string;
  companionMd: string;
  tool: ToolId;
}) {
  const { slug, name, version, designMd, companionMd, tool } = args;
  const label = toolLabel(tool);
  const steps = INSTALL_STEPS[tool];

  const readme = [
    `# ${name} — UIUXskills design system (v${version})`,
    ``,
    `## What's in this folder`,
    ``,
    `- \`design.md\` — the brand spec (tokens, component anatomy, forbidden rules). Treat this as the source of truth your AI tool reads before generating UI.`,
    `- \`companion.md\` — the calibrated system prompt that teaches your AI tool how to use \`design.md\`. Paste it into the tool's system / custom instructions slot.`,
    `- \`README.md\` — this file: how to install in ${label}.`,
    ``,
    `## How to use this in ${label}`,
    ``,
    ...steps.map((s) => `${s.n}. ${s.t}${s.cmd ? `\n   - ${s.cmd}` : ""}`),
    ``,
    `## Source`,
    ``,
    `Curated by UIUXskills · uiuxskills.com`,
    ``,
  ].join("\n");

  const zip = new JSZip();
  zip.file("design.md", designMd);
  zip.file("companion.md", companionMd);
  zip.file("README.md", readme);

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}-design-system.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
