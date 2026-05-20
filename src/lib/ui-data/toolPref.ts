/**
 * Tool preference primitives — pure data + helpers, no React hooks. Safe to
 * import from both server and client components.
 *
 * The interactive hook lives in ./useToolPref.ts so this file can stay
 * server-compatible (a "use client" module cannot export plain data values
 * to server components without breaking SSR).
 */

export const TOOL_PREF_KEY = "uiuxskills:vote:tool";

export type ToolId = "claude" | "cursor" | "lovable" | "figma";

export const TOOLS: { id: ToolId; label: string }[] = [
  { id: "claude", label: "Claude" },
  { id: "cursor", label: "Cursor" },
  { id: "lovable", label: "Lovable" },
  { id: "figma", label: "Figma Make" },
];

export function toolLabel(id: ToolId): string {
  return TOOLS.find((t) => t.id === id)?.label ?? "Claude";
}
