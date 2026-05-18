import { CodePanel } from "./CodePanel";
import type { AgentItem, McpItem, SkillItem } from "../lib/items";
import { BORDER, INK, INK_ON_LIGHT, MONO, MUTED, SUB, SURFACE, SURFACE_2 } from "../lib/tokens";

function Step({ n, t, cmd }: { n: string; t: string; cmd?: string }) {
  return (
    <div className="flex items-start gap-4">
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full shrink-0 text-[12px] font-medium"
        style={{ background: INK, color: INK_ON_LIGHT }}
      >
        {n}
      </span>
      <div className="flex-1 pt-0.5">
        <div className="text-[14px]" style={{ color: INK }}>
          {t}
        </div>
        {cmd ? (
          <div
            className="mt-2 inline-block rounded-md px-2 py-1 text-[11.5px]"
            style={{
              background: SURFACE_2,
              border: `1px solid ${BORDER}`,
              color: SUB,
              fontFamily: MONO,
            }}
          >
            {cmd}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SkillInstall({ skill }: { skill: SkillItem }) {
  const steps =
    skill.surface === "Cursor Rule"
      ? [
          { n: "1", t: "Create the rules folder in your repo if missing", cmd: "mkdir -p .cursor/rules" },
          { n: "2", t: `Save the rule contents to`, cmd: skill.installPath },
          { n: "3", t: "Restart Cursor or reload the rules panel" },
          { n: "4", t: "Reference @design-system or @ui-ux-designer in chat" },
        ]
      : skill.surface === "Claude Skill"
      ? [
          { n: "1", t: "Create your Claude skills folder if missing", cmd: "mkdir -p ~/.claude/skills" },
          { n: "2", t: `Save the skill markdown to`, cmd: skill.installPath },
          { n: "3", t: "Open Claude and run /skills reload" },
          { n: "4", t: "Trigger the skill by mentioning its keyword in chat" },
        ]
      : [
          { n: "1", t: "Open the target tool's custom instructions panel" },
          { n: "2", t: `Paste the contents below`, cmd: skill.installPath },
          { n: "3", t: "Save and reload" },
        ];

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        {steps.map((s) => (
          <Step key={s.n} {...s} />
        ))}
      </div>
      <CodePanel
        title={`${skill.id} · ${skill.installPath}`}
        language={skill.surface === "Cursor Rule" ? "mdc" : "md"}
        source={skill.body}
        rightMeta={<span>{skill.surface}</span>}
      />
    </div>
  );
}

export function AgentInstall({ agent }: { agent: AgentItem }) {
  const steps =
    agent.framework === "Claude Code"
      ? [
          { n: "1", t: "Create the Claude Code agents folder", cmd: "mkdir -p .claude/agents" },
          { n: "2", t: `Save the agent definition to`, cmd: agent.installPath },
          { n: "3", t: "Restart Claude Code or run /agents reload" },
          { n: "4", t: `Invoke with`, cmd: `@${agent.id.replace(/^agent-/, "")}` },
        ]
      : agent.framework === "Cursor"
      ? [
          { n: "1", t: "Open Cursor → Settings → Agents" },
          { n: "2", t: `Save the agent definition to`, cmd: agent.installPath },
          { n: "3", t: "Pin the agent in your sidebar" },
        ]
      : [
          { n: "1", t: "Copy the agent prompt below" },
          { n: "2", t: "Paste into your tool's system prompt or agent config" },
          { n: "3", t: "Reload and invoke" },
        ];

  return (
    <div className="space-y-8">
      <div
        className="flex items-center gap-3 text-[11px]"
        style={{ fontFamily: MONO, color: MUTED }}
      >
        <span>framework</span>
        <span
          className="inline-flex items-center h-6 px-2 rounded text-[11px]"
          style={{ background: SURFACE_2, border: `1px solid ${BORDER}`, color: INK }}
        >
          {agent.framework}
        </span>
      </div>
      <div className="space-y-5">
        {steps.map((s) => (
          <Step key={s.n} {...s} />
        ))}
      </div>
      <CodePanel
        title={`${agent.id} · ${agent.installPath}`}
        language="yaml"
        source={agent.body}
        rightMeta={<span>{agent.framework}</span>}
      />
    </div>
  );
}

export function McpInstall({ mcp }: { mcp: McpItem }) {
  const steps =
    mcp.transport === "http"
      ? [
          { n: "1", t: "Open your model client's mcp.json (Claude Desktop, Cursor, etc.)" },
          { n: "2", t: "Add the HTTP server block below to the mcpServers map" },
          { n: "3", t: "Save and restart the client" },
        ]
      : [
          { n: "1", t: "Open your model client's mcp.json (Claude Desktop, Cursor, etc.)" },
          { n: "2", t: `Add the server block below — it spawns ${mcp.packageName ?? "the server"} via npx` },
          { n: "3", t: "Set any required env vars in your shell or the env block" },
          { n: "4", t: "Restart the client and confirm the server shows up" },
        ];

  return (
    <div className="space-y-8">
      <div
        className="flex items-center gap-3 text-[11px] flex-wrap"
        style={{ fontFamily: MONO, color: MUTED }}
      >
        <span>transport</span>
        <span
          className="inline-flex items-center h-6 px-2 rounded text-[11px]"
          style={{ background: SURFACE_2, border: `1px solid ${BORDER}`, color: INK }}
        >
          {mcp.transport}
        </span>
        {mcp.packageName ? (
          <>
            <span style={{ color: BORDER }}>·</span>
            <span>package</span>
            <span
              className="inline-flex items-center h-6 px-2 rounded text-[11px]"
              style={{ background: SURFACE_2, border: `1px solid ${BORDER}`, color: INK }}
            >
              {mcp.packageName}
            </span>
          </>
        ) : null}
      </div>
      <div className="space-y-5">
        {steps.map((s) => (
          <Step key={s.n} {...s} />
        ))}
      </div>
      <CodePanel
        title={`${mcp.id} · mcp.json`}
        language="json"
        source={mcp.mcpJson}
        rightMeta={<span>{mcp.transport}</span>}
      />
      {mcp.notes ? (
        <div
          className="rounded-md border p-3 text-[12px]"
          style={{ borderColor: BORDER, background: SURFACE, color: SUB }}
        >
          {mcp.notes}
        </div>
      ) : null}
    </div>
  );
}
