import type { ItemType } from "./items";

export type GeneratedDraft = {
  id: string;
  type: ItemType;
  source: string;
  host: string;
  filename: string;
  language: "yaml" | "md" | "json";
  body: string;
  createdAt: number;
};

const memory = new Map<string, GeneratedDraft>();
const KEY_PREFIX = "uiuxskills:draft:";

function readSession(id: string): GeneratedDraft | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(KEY_PREFIX + id);
    if (!raw) return undefined;
    return JSON.parse(raw) as GeneratedDraft;
  } catch {
    return undefined;
  }
}

function writeSession(d: GeneratedDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY_PREFIX + d.id, JSON.stringify(d));
  } catch {
    // ignore quota / disabled storage — memory copy still works in-tab
  }
}

export function saveDraft(d: Omit<GeneratedDraft, "id" | "createdAt">): GeneratedDraft {
  const id = `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const draft: GeneratedDraft = { ...d, id, createdAt: Date.now() };
  memory.set(id, draft);
  writeSession(draft);
  return draft;
}

export function getDraft(id: string): GeneratedDraft | undefined {
  return memory.get(id) ?? readSession(id);
}

export function isDraftId(id: string): boolean {
  return id.startsWith("draft-");
}
