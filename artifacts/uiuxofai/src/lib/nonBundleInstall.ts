import type { AgentItem, McpItem, SkillItem, Tool } from "./items";
import { TOOLS, type ToolId } from "./toolPref";

export type InstallStep = { n: string; t: string; cmd?: string };

const TOOL_TO_NAME: Record<ToolId, Tool> = {
  claude: "Claude",
  cursor: "Cursor",
  lovable: "Lovable",
  figma: "Figma Make",
};

export function compatibleTools(itemTools: Tool[]): ToolId[] {
  // "Universal" items work in every supported picker tool
  if ((itemTools as string[]).includes("Universal")) {
    return TOOLS.map((t) => t.id);
  }
  const ids = TOOLS.map((t) => t.id).filter((id) => itemTools.includes(TOOL_TO_NAME[id]));
  return ids.length > 0 ? ids : (["claude"] as ToolId[]);
}

export function nonBundleSteps(
  item: SkillItem | AgentItem | McpItem,
  tool: ToolId,
): InstallStep[] {
  if (item.type === "skill") {
    if (tool === "claude") {
      return [
        { n: "1", t: "Make sure the Claude skills folder exists", cmd: "mkdir -p ~/.claude/skills" },
        { n: "2", t: "Save the skill markdown below to", cmd: item.installPath },
        { n: "3", t: "Reload skills inside Claude", cmd: "/skills reload" },
        { n: "4", t: "Mention the skill's name in chat to trigger it" },
      ];
    }
    if (tool === "cursor") {
      return [
        { n: "1", t: "Create your Cursor rules folder if missing", cmd: "mkdir -p .cursor/rules" },
        { n: "2", t: "Save the rule below to", cmd: `.cursor/rules/${item.id.replace(/^skill-/, "")}.mdc` },
        { n: "3", t: "Restart Cursor or reload the rules panel" },
        { n: "4", t: "Reference it in chat with @rule-name" },
      ];
    }
    if (tool === "lovable") {
      return [
        { n: "1", t: "Open your Lovable project → Settings → Custom prompt" },
        { n: "2", t: "Paste the file below into the custom instructions" },
        { n: "3", t: "Save — Lovable will use it on every generation" },
      ];
    }
    return [
      { n: "1", t: "Open Figma Make → AI assistant → System prompt" },
      { n: "2", t: "Paste the file below" },
      { n: "3", t: "Save — Figma Make will follow the new rules" },
    ];
  }

  if (item.type === "agent") {
    if (tool === "claude") {
      return [
        { n: "1", t: "Create the Claude Code agents folder", cmd: "mkdir -p .claude/agents" },
        { n: "2", t: "Save the agent definition below to", cmd: item.installPath },
        { n: "3", t: "Restart Claude Code or run /agents reload" },
        { n: "4", t: "Invoke the agent", cmd: `@${item.id.replace(/^agent-/, "")}` },
      ];
    }
    if (tool === "cursor") {
      return [
        { n: "1", t: "Open Cursor → Settings → Agents" },
        { n: "2", t: "Create a new agent and paste the definition below" },
        { n: "3", t: "Pin the agent in your sidebar and call it by name" },
      ];
    }
    return [
      { n: "1", t: "Open your tool's system prompt or agent config" },
      { n: "2", t: "Paste the agent definition below" },
      { n: "3", t: "Save and invoke" },
    ];
  }

  // MCP
  const cfgPath =
    tool === "claude"
      ? "~/Library/Application Support/Claude/claude_desktop_config.json"
      : tool === "cursor"
      ? "~/.cursor/mcp.json"
      : "your tool's mcp.json";
  const steps: InstallStep[] = [
    { n: "1", t: `Open your config file`, cmd: cfgPath },
    { n: "2", t: "Add the server block below to the mcpServers map" },
  ];
  if (item.notes) steps.push({ n: String(steps.length + 1), t: item.notes });
  steps.push({
    n: String(steps.length + 1),
    t: `Restart your tool and confirm the server appears`,
  });
  return steps;
}
