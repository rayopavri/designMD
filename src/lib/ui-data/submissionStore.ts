import type { ItemType } from "./items";

export type QueuedSubmission = {
  id: string;
  type: ItemType;
  source: string;
  host: string;
  filename: string;
  language: "yaml" | "md" | "json";
  body: string;
  status: "queued";
  createdAt: number;
};

const queue: QueuedSubmission[] = [];
const KEY = "uiuxskills:submissions";

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

export function queueSubmission(s: Omit<QueuedSubmission, "id" | "status" | "createdAt">): QueuedSubmission {
  const entry: QueuedSubmission = {
    ...s,
    id: `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    status: "queued",
    createdAt: Date.now(),
  };
  queue.push(entry);
  persist();
  return entry;
}

export function listSubmissions(): QueuedSubmission[] {
  return [...queue];
}
