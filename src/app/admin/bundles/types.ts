export type BundleStatus =
  | "personal"
  | "pending_review"
  | "published"
  | "flagged"
  | "rejected"
  | "archived";

export interface ListRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: BundleStatus;
  companionStatus: string;
  coverageScore: number | null;
  primaryCategorySlug: string | null;
  primaryCategoryName: string | null;
  designStyle: string[];
  compatibleTools: string[];
  paletteColors: string[];
  isFeatured: boolean;
  isCurated: boolean;
  sourceDomain: string | null;
  authorName: string | null;
  license: string | null;
  voteCount: number;
  positiveVoteRate: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

export interface DetailRow extends ListRow {
  designMd: string | null;
  companionPrompt: string;
  // Creator attribution. createdBy is null for anonymously-generated bundles;
  // creatorName/creatorEmail come from a join on the users table.
  createdBy: string | null;
  creatorName: string | null;
  creatorEmail: string | null;
  brandLogoUrl: string | null;
  brandInitial: string | null;
  brandColor: string | null;
  primaryCategoryId: string | null;
  attributionStatement: string | null;
  reviewNotes: string | null;
  accessibilityNotes: string | null;
  sourceUrl: string | null;
  previewImageUrl: string | null;
  coverageColors: number | null;
  coverageTypography: number | null;
  coverageLayout: number | null;
  coverageElevation: number | null;
  coverageShapes: number | null;
  coverageComponents: number | null;
  coverageDosDonts: number | null;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  level: number;
}

// Editable subset that the PATCH endpoint accepts.
export interface EditFormState {
  title: string;
  description: string;
  sourceUrl: string;
  brandLogoUrl: string;
  designMd: string;
  companionPrompt: string;
  designStyle: string[];
  compatibleTools: string[];
  primaryCategoryId: string | null;
  license: string;
  attributionStatement: string;
  isFeatured: boolean;
  isCurated: boolean;
}

export type LoadState = "loading" | "ready" | "forbidden" | "error";
export type ActionState =
  | "idle"
  | "saving"
  | "archiving"
  | "restoring"
  | "publishing"
  | "rejecting"
  | "regenerating-companion"
  | "rerunning-pipeline"
  | "deleting";

// Re-run pipeline progress phases — mirror /generate page semantics so the
// admin and public flows look like the same machine. Each phase groups one
// or more backend `currentStep` values written by scrape-and-extract.ts.
export interface RerunPhase {
  id: string;
  label: string;
  tool: string;
  steps: string[];
}

// Server-truth latest job for the selected bundle. Survives page reloads,
// unlike `rerunStatus` (which is only set during a click-initiated re-run).
// Drives the persistent pipeline-status row above the action bar.
export interface LatestJob {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  currentStep: string | null;
  errorStep: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  firecrawlDoneAt: string | null;
  geminiExtractDoneAt: string | null;
  designMdDoneAt: string | null;
  lintDoneAt: string | null;
  companionStartedAt: string | null;
  companionDoneAt: string | null;
}
