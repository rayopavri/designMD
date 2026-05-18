import { BUNDLES, getBundle as _getBundle, type Bundle } from "./bundles";

// Re-export legacy bundle accessor so callers can migrate to the
// unified items module without touching bundles.ts directly.
export const getBundle = _getBundle;
export { BUNDLES };

export type ItemType = "bundle" | "skill" | "agent" | "mcp";

export type DiscoveryMethod = "Editorial" | "Community" | "Auto-discovered";

export type Tool =
  | "Claude"
  | "Cursor"
  | "Lovable"
  | "Figma Make"
  | "ChatGPT"
  | "Universal";

export type Attribution = {
  sourceUrl: string;
  author: string;
  license: string;
  discoveryMethod: DiscoveryMethod;
  communityHandle?: string;
  discoveredAt: string;
  verifiedAt: string;
};

type BaseItem = {
  id: string;
  type: ItemType;
  num: string;
  name: string;
  tagline: string;
  description: string;
  tags: string[];
  tools: Tool[];
  attribution: Attribution;
  relatedIds: string[];
  updatedAgo: string;
  accent: string;
  icon: string;
  projectType?:
    | "Mobile apps"
    | "SaaS"
    | "E-commerce"
    | "Dashboards"
    | "Marketing sites"
    | "Design systems";
  style?: "Minimal" | "Enterprise" | "Bold" | "Playful" | "Accessible" | "Dark mode";
};

export type BundleItem = BaseItem & {
  type: "bundle";
  bundle: Bundle;
};

export type SkillItem = BaseItem & {
  type: "skill";
  surface: "Claude Skill" | "Cursor Rule" | "ChatGPT Instructions" | "Lovable Project";
  installPath: string;
  body: string;
};

export type AgentItem = BaseItem & {
  type: "agent";
  framework: "Claude Code" | "Cursor" | "Universal";
  installPath: string;
  body: string;
};

export type McpItem = BaseItem & {
  type: "mcp";
  transport: "stdio" | "http" | "sse";
  packageName?: string;
  mcpJson: string;
  notes?: string;
};

export type Item = BundleItem | SkillItem | AgentItem | McpItem;

// ─────────────────────────────────────────────────────────────
// Type metadata (accent, icon, label)
// ─────────────────────────────────────────────────────────────

import { VIOLET, LIME, PEACH, CYAN } from "./tokens";

export const TYPE_META: Record<
  ItemType,
  { label: string; plural: string; accent: string; icon: string }
> = {
  bundle: { label: "Design system", plural: "Design systems", accent: VIOLET, icon: "▢" },
  skill: { label: "Skill", plural: "Skills", accent: LIME, icon: "◇" },
  agent: { label: "Agent", plural: "Agents", accent: PEACH, icon: "◆" },
  mcp: { label: "MCP", plural: "MCPs", accent: CYAN, icon: "◐" },
};

// Categories the user actually sees in nav / shelves.
// Bundles (design systems) are exposed as a sub-kind of Skill — they live
// on the Skill shelf and are filterable via isDesignSystem().
export type DisplayType = "skill" | "agent" | "mcp";
export const DISPLAY_TYPES: DisplayType[] = ["skill", "agent", "mcp"];

export function displayTypeOf(it: Item): DisplayType {
  return it.type === "bundle" ? "skill" : it.type;
}

export function isDesignSystem(it: Item): boolean {
  return it.type === "bundle";
}

export const TYPE_FILTERS: ("All" | DisplayType)[] = ["All", "skill", "agent", "mcp"];

// ─────────────────────────────────────────────────────────────
// Attribution sidecar for the existing 8 bundles
// (Bundle objects in bundles.ts predate this schema; we attach
//  attribution here so we don't churn that file.)
// ─────────────────────────────────────────────────────────────

type ProjectType = NonNullable<BaseItem["projectType"]>;
type StyleTag = NonNullable<BaseItem["style"]>;

const BUNDLE_FILTERS: Record<string, { projectType: ProjectType; style: StyleTag }> = {
  linear: { projectType: "Dashboards", style: "Dark mode" },
  stripe: { projectType: "Marketing sites", style: "Bold" },
  notion: { projectType: "Marketing sites", style: "Minimal" },
  carbon: { projectType: "Dashboards", style: "Enterprise" },
  arc: { projectType: "Mobile apps", style: "Playful" },
  vercel: { projectType: "Marketing sites", style: "Dark mode" },
  ramp: { projectType: "SaaS", style: "Dark mode" },
  atlassian: { projectType: "SaaS", style: "Enterprise" },
};

const NON_BUNDLE_FILTERS: Record<string, { projectType: ProjectType; style: StyleTag }> = {
  "skill-design-system-architect": { projectType: "Design systems", style: "Minimal" },
  "skill-ui-ux-cursor-rules": { projectType: "SaaS", style: "Minimal" },
  "skill-design-system-cursor": { projectType: "Design systems", style: "Enterprise" },
  "skill-figma-to-react": { projectType: "SaaS", style: "Minimal" },
  "agent-ui-engineer": { projectType: "SaaS", style: "Minimal" },
  "agent-design-critique": { projectType: "Marketing sites", style: "Accessible" },
  "agent-component-architect": { projectType: "Design systems", style: "Enterprise" },
  "mcp-figma-dev-mode": { projectType: "Design systems", style: "Minimal" },
  "mcp-mobbin": { projectType: "Mobile apps", style: "Playful" },
  "mcp-refero": { projectType: "Marketing sites", style: "Minimal" },
  "mcp-stitch": { projectType: "Design systems", style: "Enterprise" },
};

const BUNDLE_ATTR: Record<
  string,
  { tools: Tool[]; relatedIds: string[]; discoveryMethod: DiscoveryMethod }
> = {
  linear: {
    tools: ["Claude", "Cursor", "Lovable", "Figma Make"],
    relatedIds: ["skill-design-system-architect", "agent-ui-engineer", "mcp-figma-dev-mode"],
    discoveryMethod: "Editorial",
  },
  stripe: {
    tools: ["Claude", "Cursor", "Lovable"],
    relatedIds: ["skill-design-system-architect", "mcp-figma-dev-mode", "agent-ui-engineer"],
    discoveryMethod: "Editorial",
  },
  notion: {
    tools: ["Claude", "Cursor", "Lovable", "Figma Make"],
    relatedIds: ["skill-ui-ux-cursor-rules", "agent-design-critique", "mcp-refero"],
    discoveryMethod: "Editorial",
  },
  carbon: {
    tools: ["Claude", "Cursor"],
    relatedIds: ["skill-design-system-architect", "agent-component-architect", "mcp-figma-dev-mode"],
    discoveryMethod: "Editorial",
  },
  arc: {
    tools: ["Claude", "Cursor", "Lovable"],
    relatedIds: ["agent-design-critique", "mcp-mobbin", "skill-figma-to-react"],
    discoveryMethod: "Community",
  },
  vercel: {
    tools: ["Claude", "Cursor", "Lovable", "Figma Make"],
    relatedIds: ["skill-design-system-cursor", "agent-ui-engineer", "mcp-figma-dev-mode"],
    discoveryMethod: "Editorial",
  },
  ramp: {
    tools: ["Claude", "Cursor"],
    relatedIds: ["skill-design-system-cursor", "mcp-figma-dev-mode", "agent-component-architect"],
    discoveryMethod: "Auto-discovered",
  },
  atlassian: {
    tools: ["Claude", "Cursor", "Lovable"],
    relatedIds: ["agent-component-architect", "mcp-mobbin", "skill-design-system-architect"],
    discoveryMethod: "Editorial",
  },
};

const COMMUNITY_HANDLES: Record<string, string> = {
  arc: "@thebrowsercompany",
  ramp: "discovery-bot",
};

function bundleToItem(b: Bundle): BundleItem {
  const meta = BUNDLE_ATTR[b.id] ?? {
    tools: b.worksWith as Tool[],
    relatedIds: [],
    discoveryMethod: "Editorial" as DiscoveryMethod,
  };
  const filters = BUNDLE_FILTERS[b.id];
  return {
    id: b.id,
    type: "bundle",
    num: b.num,
    name: b.name,
    tagline: b.tagline,
    description: b.description,
    tags: b.tags,
    tools: meta.tools,
    relatedIds: meta.relatedIds,
    updatedAgo: b.updatedAgo,
    accent: TYPE_META.bundle.accent,
    icon: TYPE_META.bundle.icon,
    projectType: filters?.projectType,
    style: filters?.style,
    attribution: {
      sourceUrl: `https://${b.url}`,
      author: b.maintainer,
      license: b.license,
      discoveryMethod: meta.discoveryMethod,
      communityHandle: COMMUNITY_HANDLES[b.id],
      discoveredAt: b.updatedAgo,
      verifiedAt: b.updatedAgo,
    },
    bundle: b,
  };
}

// ─────────────────────────────────────────────────────────────
// Seed: Skills (4)
// ─────────────────────────────────────────────────────────────

const skillDesignSystemArchitect = `---
name: design-system-architect
description: Builds a tokenized design.md spec from a brand reference so any model can ship UI on-brand.
trigger: When user mentions "design system", "tokens", "brand", or pastes a brand reference URL.
---

# ROLE
You are a Design System Architect. Your job is to turn brand references into a single
flat, model-readable design.md file. You never invent tokens; you extract them.

# STEPS
1. Read every reference the user provides (URL, screenshot, Figma frame).
2. Cluster colors in OKLCH and propose a palette of 6–10 named tokens.
3. Infer a type scale (7 sizes max) and a single font family.
4. Map at least 6 component anatomies: Button, Input, Card, Pill, Table row, Modal.
5. Output a design.md following the project schema, plus a coverage score 0–100.

# OUTPUT
A single design.md file with sections: ABSOLUTE CONSTRAINTS, TOKEN VALUES, COMPONENT
ANATOMY, FORBIDDEN. Always end with a coverage estimate.

# FORBIDDEN
- Inventing colors not present in the reference.
- Inferring motion without source evidence.
- Mixing two brands into one spec.
`;

const skillCursorUiUx = `# UI/UX Designer

You are a senior UI/UX designer working inside Cursor. Apply these rules to every
generation in this repo.

## PRINCIPLES
- Always read /docs/design.md before producing UI.
- Prefer composition over new components. Reuse existing primitives.
- Density first: respect the 4px spacing grid. Never subdivide.
- Single accent rule: one brand accent per surface. No rainbow gradients.

## COMPONENT OUTPUT
- Tailwind v4 with design-token CSS variables.
- Inline styles only for runtime token values.
- Annotate any deviation from design.md with // deviation: <reason>

## REFUSAL
If a token doesn't exist in design.md, ask the user before guessing.
`;

const skillCursorDesignSystem = `# Design System (strict)

This Cursor rule enforces a single design.md as the source of truth.

## RULES
1. Never inline hex values. Use \`var(--color-*)\` from design.md.
2. Never introduce new font families. The system defines exactly one.
3. Respect the 8 radius tokens. No ad-hoc radii.
4. Spacing scale: [4, 8, 12, 16, 20, 24, 32, 48, 64]. Pick from this list.
5. Forbidden: \`!important\`, arbitrary tailwind values like \`p-[13px]\`.

## SELF-CHECK
After generating, list which tokens you used and which you skipped.
`;

const skillFigmaToReact = `---
name: figma-to-react
description: Converts a Figma frame paste into a React + design.md component.
trigger: When user pastes a Figma node or shares a Figma Dev Mode link.
---

# ROLE
You translate Figma frames into typed React components that consume design.md tokens.

# STEPS
1. Read the Figma node via the Figma Dev Mode MCP (if available) or the paste.
2. Identify every visual property and map to a design.md token. List unmapped properties.
3. Emit a React functional component with TypeScript props.
4. Use Tailwind classes for declared tokens; inline style only for dynamic values.
5. Return a coverage report: declared / inferred / unmapped.

# DEPENDENCIES
- Pairs naturally with the Figma Dev Mode MCP and any UIUXofAi design system.
`;

const SKILLS: SkillItem[] = [
  {
    id: "skill-design-system-architect",
    type: "skill",
    num: "S04",
    name: "Design System Architect",
    tagline: "Turns brand references into a design.md spec",
    description:
      "A Claude Skill that takes URLs, screenshots, or Figma frames and produces a strict, tokenized design.md ready to drop into any UIUXofAi design system.",
    tags: ["Claude Skill", "Tokens", "Architecture"],
    tools: ["Claude"],
    relatedIds: ["linear", "vercel", "mcp-figma-dev-mode", "skill-figma-to-react"],
    updatedAgo: "2d ago",
    accent: TYPE_META.skill.accent,
    icon: TYPE_META.skill.icon,
    surface: "Claude Skill",
    installPath: "~/.claude/skills/design-system-architect.md",
    body: skillDesignSystemArchitect,
    attribution: {
      sourceUrl: "https://skills.sh/stitch-skills/design-system-architect",
      author: "skills.sh",
      license: "MIT",
      discoveryMethod: "Editorial",
      discoveredAt: "2d ago",
      verifiedAt: "2d ago",
    },
  },
  {
    id: "skill-ui-ux-cursor-rules",
    type: "skill",
    num: "S03",
    name: "UI/UX Designer (Cursor)",
    tagline: "Cursor rules for shipping on-brand UI",
    description:
      "A .cursor/rules file that turns Cursor into a brand-aware UI engineer. Reads /docs/design.md, respects the 4px grid, enforces single-accent compositions.",
    tags: ["Cursor Rule", "UI/UX", "Density"],
    tools: ["Cursor"],
    relatedIds: ["notion", "agent-ui-engineer", "mcp-mobbin"],
    updatedAgo: "6d ago",
    accent: TYPE_META.skill.accent,
    icon: TYPE_META.skill.icon,
    surface: "Cursor Rule",
    installPath: ".cursor/rules/ui-ux-designer.mdc",
    body: skillCursorUiUx,
    attribution: {
      sourceUrl: "https://aitmpl.com/ui-ux-designer",
      author: "aitmpl",
      license: "MIT",
      discoveryMethod: "Editorial",
      discoveredAt: "6d ago",
      verifiedAt: "6d ago",
    },
  },
  {
    id: "skill-design-system-cursor",
    type: "skill",
    num: "S02",
    name: "Design System (Cursor)",
    tagline: "Strict token enforcement in Cursor",
    description:
      "Cursor rule that locks generations to declared design.md tokens. No inline hex, no ad-hoc spacing, no extra font families. Pairs with any design system.",
    tags: ["Cursor Rule", "Tokens", "Strict"],
    tools: ["Cursor"],
    relatedIds: ["vercel", "ramp", "mcp-figma-dev-mode"],
    updatedAgo: "1w ago",
    accent: TYPE_META.skill.accent,
    icon: TYPE_META.skill.icon,
    surface: "Cursor Rule",
    installPath: ".cursor/rules/design-system.mdc",
    body: skillCursorDesignSystem,
    attribution: {
      sourceUrl: "https://aitmpl.com/ui-design-system",
      author: "aitmpl",
      license: "MIT",
      discoveryMethod: "Auto-discovered",
      discoveredAt: "1w ago",
      verifiedAt: "1w ago",
    },
  },
  {
    id: "skill-figma-to-react",
    type: "skill",
    num: "S01",
    name: "Figma to React",
    tagline: "Frame → typed component with token mapping",
    description:
      "Claude Skill that converts a Figma frame paste into a React component, mapping every visual property to a design.md token and reporting coverage.",
    tags: ["Claude Skill", "Figma", "React"],
    tools: ["Claude"],
    relatedIds: ["mcp-figma-dev-mode", "agent-ui-engineer", "linear"],
    updatedAgo: "4d ago",
    accent: TYPE_META.skill.accent,
    icon: TYPE_META.skill.icon,
    surface: "Claude Skill",
    installPath: "~/.claude/skills/figma-to-react.md",
    body: skillFigmaToReact,
    attribution: {
      sourceUrl: "https://skills.sh/stitch-skills/figma-to-react",
      author: "skills.sh",
      license: "MIT",
      discoveryMethod: "Editorial",
      discoveredAt: "4d ago",
      verifiedAt: "4d ago",
    },
  },
];

// ─────────────────────────────────────────────────────────────
// Seed: Agents (3)
// ─────────────────────────────────────────────────────────────

const agentUiEngineer = `---
name: ui-engineer
role: senior-ui-engineer
model: claude-sonnet
tools: [read, write, bash, mcp:figma-dev-mode]
---

# CHARTER
You are a senior UI engineer. You implement designs faithfully and ship.

# WORKFLOW
1. Read the design.md in the repo.
2. Read or generate the component spec from the design.
3. Implement using the project's stack (React + Tailwind + design tokens).
4. Run the dev server and smoke-check the result.
5. Report coverage: declared tokens used / skipped / deviations.

# CONSTRAINTS
- Do not introduce new dependencies without asking.
- Do not modify design.md. Surface a token request instead.
`;

const agentDesignCritique = `---
name: design-critique
role: editorial-design-critic
model: claude-sonnet
tools: [read, screenshot]
---

# CHARTER
You are a senior design critic. You score UI work against the design system
and surface drift before it ships.

# CRITIQUE RUBRIC
- Hierarchy: is the primary action obvious in < 1 second?
- Density: does spacing follow the declared scale?
- Accent discipline: is the brand accent used sparingly?
- Type rhythm: are sizes from the declared scale?
- Motion: is duration & easing on-brand?

# OUTPUT
A 5-line critique with a score 0–100 and 3 specific edits.
`;

const agentComponentArchitect = `---
name: component-architect
role: design-system-engineer
model: claude-opus
tools: [read, write]
---

# CHARTER
You design the public API of a new component before any code is written.

# WORKFLOW
1. Identify the component's role in the existing system.
2. Propose a minimal props surface (≤ 8 props).
3. Map every prop to a declared design token where possible.
4. List the component's states (default, hover, focus, active, disabled, loading, error).
5. Output a TypeScript interface and a stories.tsx file outline.

# FORBIDDEN
- Inventing a new variant family without a real use case.
- Exposing visual props (colors, spacing) — those come from tokens.
`;

const AGENTS: AgentItem[] = [
  {
    id: "agent-ui-engineer",
    type: "agent",
    num: "A03",
    name: "UI Engineer",
    tagline: "Reads design.md, ships components",
    description:
      "A Claude Code agent that implements designs from a design.md spec. Pairs with the Figma Dev Mode MCP for pixel-faithful builds.",
    tags: ["Claude Code", "Implementation", "Frontend"],
    tools: ["Claude"],
    relatedIds: ["linear", "skill-design-system-architect", "mcp-figma-dev-mode"],
    updatedAgo: "3d ago",
    accent: TYPE_META.agent.accent,
    icon: TYPE_META.agent.icon,
    framework: "Claude Code",
    installPath: ".claude/agents/ui-engineer.md",
    body: agentUiEngineer,
    attribution: {
      sourceUrl: "https://github.com/wshobson/awesome-ui-agents",
      author: "wshobson",
      license: "MIT",
      discoveryMethod: "Editorial",
      discoveredAt: "3d ago",
      verifiedAt: "3d ago",
    },
  },
  {
    id: "agent-design-critique",
    type: "agent",
    num: "A02",
    name: "Design Critique",
    tagline: "Scores UI against the system before it ships",
    description:
      "A Claude Code agent that takes screenshots, scores them against the design.md, and returns three concrete edits with a 0–100 brand score.",
    tags: ["Claude Code", "Critique", "QA"],
    tools: ["Claude"],
    relatedIds: ["notion", "arc", "mcp-refero"],
    updatedAgo: "8d ago",
    accent: TYPE_META.agent.accent,
    icon: TYPE_META.agent.icon,
    framework: "Claude Code",
    installPath: ".claude/agents/design-critique.md",
    body: agentDesignCritique,
    attribution: {
      sourceUrl: "https://github.com/davila7/claude-code-ui-agents",
      author: "davila7",
      license: "MIT",
      discoveryMethod: "Community",
      communityHandle: "@davila7",
      discoveredAt: "8d ago",
      verifiedAt: "8d ago",
    },
  },
  {
    id: "agent-component-architect",
    type: "agent",
    num: "A01",
    name: "Component Architect",
    tagline: "Designs the props API before any code",
    description:
      "An agent that takes a component brief and produces the minimal TypeScript prop surface, state list, and stories outline. Token-aware.",
    tags: ["Architecture", "Components", "Design System"],
    tools: ["Universal"],
    relatedIds: ["carbon", "atlassian", "skill-design-system-architect"],
    updatedAgo: "2w ago",
    accent: TYPE_META.agent.accent,
    icon: TYPE_META.agent.icon,
    framework: "Universal",
    installPath: ".claude/agents/component-architect.md",
    body: agentComponentArchitect,
    attribution: {
      sourceUrl: "https://github.com/wshobson/awesome-ui-agents",
      author: "wshobson",
      license: "MIT",
      discoveryMethod: "Editorial",
      discoveredAt: "2w ago",
      verifiedAt: "2w ago",
    },
  },
];

// ─────────────────────────────────────────────────────────────
// Seed: MCPs (4)
// ─────────────────────────────────────────────────────────────

const mcpFigmaJson = `{
  "mcpServers": {
    "figma-dev-mode": {
      "command": "npx",
      "args": ["-y", "@figma/dev-mode-mcp@latest"],
      "env": {
        "FIGMA_API_TOKEN": "\${FIGMA_API_TOKEN}"
      }
    }
  }
}`;

const mcpMobbinJson = `{
  "mcpServers": {
    "mobbin": {
      "command": "npx",
      "args": ["-y", "@mobbin/mcp@latest"],
      "env": {
        "MOBBIN_API_KEY": "\${MOBBIN_API_KEY}"
      }
    }
  }
}`;

const mcpReferoJson = `{
  "mcpServers": {
    "refero": {
      "url": "https://refero.design/mcp",
      "transport": "http"
    }
  }
}`;

const mcpStitchJson = `{
  "mcpServers": {
    "stitch": {
      "command": "npx",
      "args": ["-y", "@stitch/mcp@latest"]
    }
  }
}`;

const MCPS: McpItem[] = [
  {
    id: "mcp-figma-dev-mode",
    type: "mcp",
    num: "M04",
    name: "Figma Dev Mode MCP",
    tagline: "Read live Figma frames from any model",
    description:
      "Official MCP server from Figma that exposes Dev Mode frames, variables, and component metadata to Claude, Cursor, and other MCP-aware tools.",
    tags: ["Figma", "Official", "Read"],
    tools: ["Claude", "Cursor"],
    relatedIds: ["linear", "skill-figma-to-react", "agent-ui-engineer"],
    updatedAgo: "5h ago",
    accent: TYPE_META.mcp.accent,
    icon: TYPE_META.mcp.icon,
    transport: "stdio",
    packageName: "@figma/dev-mode-mcp",
    mcpJson: mcpFigmaJson,
    notes: "Requires a Figma personal access token in FIGMA_API_TOKEN.",
    attribution: {
      sourceUrl: "https://www.figma.com/blog/introducing-figmas-dev-mode-mcp-server/",
      author: "Figma",
      license: "Proprietary",
      discoveryMethod: "Editorial",
      discoveredAt: "5h ago",
      verifiedAt: "5h ago",
    },
  },
  {
    id: "mcp-mobbin",
    type: "mcp",
    num: "M03",
    name: "Mobbin MCP",
    tagline: "Reference flows from real shipped apps",
    description:
      "Search Mobbin's library of production app screens directly from your model. Useful as a reference layer when iterating on layouts or flows.",
    tags: ["Mobbin", "Reference", "Patterns"],
    tools: ["Claude", "Cursor"],
    relatedIds: ["arc", "skill-ui-ux-cursor-rules", "agent-design-critique"],
    updatedAgo: "3d ago",
    accent: TYPE_META.mcp.accent,
    icon: TYPE_META.mcp.icon,
    transport: "stdio",
    packageName: "@mobbin/mcp",
    mcpJson: mcpMobbinJson,
    notes: "API key required. Read-only.",
    attribution: {
      sourceUrl: "https://github.com/mobbin/mcp",
      author: "Mobbin",
      license: "Proprietary",
      discoveryMethod: "Editorial",
      discoveredAt: "3d ago",
      verifiedAt: "3d ago",
    },
  },
  {
    id: "mcp-refero",
    type: "mcp",
    num: "M02",
    name: "Refero MCP",
    tagline: "Curated design references over HTTP",
    description:
      "HTTP-transport MCP from Refero. Search a curated index of design references — flows, screens, components — from inside your model.",
    tags: ["Refero", "HTTP", "Reference"],
    tools: ["Claude"],
    relatedIds: ["notion", "agent-design-critique", "mcp-mobbin"],
    updatedAgo: "1w ago",
    accent: TYPE_META.mcp.accent,
    icon: TYPE_META.mcp.icon,
    transport: "http",
    mcpJson: mcpReferoJson,
    notes: "No install — HTTP transport.",
    attribution: {
      sourceUrl: "https://refero.design/mcp",
      author: "Refero",
      license: "Proprietary",
      discoveryMethod: "Auto-discovered",
      discoveredAt: "1w ago",
      verifiedAt: "1w ago",
    },
  },
  {
    id: "mcp-stitch",
    type: "mcp",
    num: "M01",
    name: "Stitch MCP",
    tagline: "Design-system skill orchestration",
    description:
      "MCP server that hosts the stitch-skills library: design-system architect, figma-to-react, and the rest of the skills.sh catalogue.",
    tags: ["Stitch", "Skills", "Design"],
    tools: ["Claude"],
    relatedIds: ["skill-design-system-architect", "skill-figma-to-react", "mcp-figma-dev-mode"],
    updatedAgo: "2w ago",
    accent: TYPE_META.mcp.accent,
    icon: TYPE_META.mcp.icon,
    transport: "stdio",
    packageName: "@stitch/mcp",
    mcpJson: mcpStitchJson,
    attribution: {
      sourceUrl: "https://skills.sh",
      author: "skills.sh",
      license: "MIT",
      discoveryMethod: "Editorial",
      discoveredAt: "2w ago",
      verifiedAt: "2w ago",
    },
  },
];

// ─────────────────────────────────────────────────────────────
// Unified catalogue
// ─────────────────────────────────────────────────────────────

function applyFilters<T extends Item>(it: T): T {
  const f = NON_BUNDLE_FILTERS[it.id];
  if (!f) return it;
  return { ...it, projectType: f.projectType, style: f.style };
}

export const BUNDLE_ITEMS: BundleItem[] = BUNDLES.map(bundleToItem);

export const ITEMS: Item[] = [
  ...BUNDLE_ITEMS,
  ...SKILLS.map(applyFilters),
  ...AGENTS.map(applyFilters),
  ...MCPS.map(applyFilters),
];

export function getItem(id: string): Item | undefined {
  return ITEMS.find((i) => i.id === id);
}

export function getRelatedItems(id: string): Item[] {
  const item = getItem(id);
  if (!item) return [];
  return item.relatedIds
    .map((rid) => getItem(rid))
    .filter((x): x is Item => Boolean(x));
}
