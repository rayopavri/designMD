import { LIME, VIOLET, PEACH, SUB, MUTED } from "@/lib/ui-data/tokens";
import type { BundleStatus, RerunPhase } from "./types";

export const ALL_STATUSES: BundleStatus[] = [
  "published",
  "pending_review",
  "personal",
  "flagged",
  "rejected",
  "archived",
];

export const BULK_RERUN_LS_KEY = "bulk-rerun-since";

export const RERUN_PHASES: RerunPhase[] = [
  {
    id: "collect",
    label: "Page collection",
    tool: "Firecrawl",
    steps: ["scraping", "parsing-computed"],
  },
  {
    id: "extract",
    label: "Brand extraction",
    tool: "Gemini 3.5 Flash",
    steps: ["extracting", "resolving-orphans"],
  },
  {
    id: "author",
    label: "Design.md authored",
    tool: "Gemini 3.5 Flash",
    steps: ["persisting", "writing-design-md", "persisting-design-md"],
  },
  {
    id: "validate",
    label: "Validate & score",
    tool: "@google/design.md",
    steps: ["linting", "scoring"],
  },
  {
    id: "companion",
    label: "Companion prompt",
    tool: "Claude Sonnet",
    steps: [],
  },
];

export function statusColor(status: BundleStatus): string {
  switch (status) {
    case "published":
      return LIME;
    case "pending_review":
      return VIOLET;
    case "rejected":
    case "flagged":
      return PEACH;
    case "personal":
      return SUB;
    case "archived":
      return MUTED;
    default:
      return MUTED;
  }
}

export function statusLabel(status: BundleStatus): string {
  switch (status) {
    case "published":
      return "published";
    case "pending_review":
      return "pending";
    case "rejected":
      return "rejected";
    case "flagged":
      return "flagged";
    case "personal":
      return "personal";
    case "archived":
      return "archived";
    default:
      return status;
  }
}

export function rerunPhaseIndex(currentStep: string | null): number {
  if (!currentStep) return -1;
  for (let i = 0; i < RERUN_PHASES.length; i += 1) {
    if (RERUN_PHASES[i].steps.includes(currentStep)) return i;
  }
  // currentStep is something terminal (`rerun_complete`, `ready_for_review`,
  // `held_as_draft`) — every phase is done.
  if (
    currentStep === "rerun_complete" ||
    currentStep === "ready_for_review" ||
    currentStep === "held_as_draft"
  ) {
    return RERUN_PHASES.length;
  }
  return -1;
}
