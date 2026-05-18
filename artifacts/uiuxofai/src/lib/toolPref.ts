import { useEffect, useState } from "react";

export const TOOL_PREF_KEY = "uiuxofai:vote:tool";

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

function readPref(): ToolId {
  if (typeof window === "undefined") return "claude";
  try {
    const v = window.localStorage.getItem(TOOL_PREF_KEY);
    if (v === "claude" || v === "cursor" || v === "lovable" || v === "figma") return v;
    if (typeof v === "string") {
      const lower = v.toLowerCase();
      if (lower.includes("cursor")) return "cursor";
      if (lower.includes("lovable")) return "lovable";
      if (lower.includes("figma")) return "figma";
      if (lower.includes("claude")) return "claude";
    }
  } catch {
    // ignore
  }
  return "claude";
}

function writePref(id: ToolId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOOL_PREF_KEY, id);
  } catch {
    // ignore
  }
}

export function useToolPref(): [ToolId, (t: ToolId) => void] {
  const [tool, setToolState] = useState<ToolId>(() => readPref());

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === TOOL_PREF_KEY) setToolState(readPref());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTool = (t: ToolId) => {
    setToolState(t);
    writePref(t);
  };

  return [tool, setTool];
}
