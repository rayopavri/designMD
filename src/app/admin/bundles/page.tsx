"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Check,
  ChevronRight,
  ExternalLink,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCw,
  Save,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { SectionLabel } from "@/components/ui/Shell";
import {
  BG,
  BORDER,
  BORDER_SOFT,
  CYAN,
  INK,
  INK_ON_LIGHT,
  LIME,
  MONO,
  MUTED,
  PEACH,
  SUB,
  SURFACE,
  SURFACE_2,
  VIOLET,
} from "@/lib/ui-data/tokens";

// ─── Types matching API contracts ────────────────────────────

type BundleStatus =
  | "personal"
  | "pending_review"
  | "published"
  | "flagged"
  | "rejected"
  | "archived";

const ALL_STATUSES: BundleStatus[] = [
  "published",
  "pending_review",
  "personal",
  "flagged",
  "rejected",
  "archived",
];

interface ListRow {
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

interface DetailRow extends ListRow {
  designMd: string | null;
  companionPrompt: string;
  primaryCategoryId: string | null;
  attributionStatement: string | null;
  reviewNotes: string | null;
  accessibilityNotes: string | null;
  sourceUrl: string | null;
  coverageColors: number | null;
  coverageTypography: number | null;
  coverageLayout: number | null;
  coverageElevation: number | null;
  coverageShapes: number | null;
  coverageComponents: number | null;
  coverageDosDonts: number | null;
}

interface Category {
  id: string;
  slug: string;
  name: string;
  level: number;
}

// Editable subset that the PATCH endpoint accepts.
interface EditFormState {
  title: string;
  description: string;
  sourceUrl: string;
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

type LoadState = "loading" | "ready" | "forbidden" | "error";
type ActionState =
  | "idle"
  | "saving"
  | "archiving"
  | "restoring"
  | "publishing"
  | "rejecting"
  | "regenerating-companion"
  | "rerunning-pipeline"
  | "deleting";

const DESIGN_STYLES = [
  "dark-mode",
  "minimal",
  "bold",
  "playful",
  "enterprise",
  "accessible",
];
const TOOLS = ["claude", "cursor", "lovable", "figma-make"];

const BULK_RERUN_LS_KEY = 'bulk-rerun-since';

// Re-run pipeline progress phases — mirror /generate page semantics so the
// admin and public flows look like the same machine. Each phase groups one
// or more backend `currentStep` values written by scrape-and-extract.ts.
interface RerunPhase {
  id: string;
  label: string;
  tool: string;
  steps: string[];
}
const RERUN_PHASES: RerunPhase[] = [
  {
    id: "collect",
    label: "Page collection",
    tool: "Firecrawl",
    steps: ["scraping", "parsing-computed"],
  },
  {
    id: "extract",
    label: "Brand extraction",
    tool: "Gemini 3.1 Flash-Lite",
    steps: ["extracting", "resolving-orphans"],
  },
  {
    id: "author",
    label: "Design.md authored",
    tool: "Gemini 3.1 Flash-Lite",
    steps: ["persisting", "writing-design-md", "persisting-design-md"],
  },
  {
    id: "validate",
    label: "Validate & score",
    tool: "@google/design.md",
    steps: ["linting", "scoring"],
  },
];

function rerunPhaseIndex(currentStep: string | null): number {
  if (!currentStep) return -1;
  for (let i = 0; i < RERUN_PHASES.length; i += 1) {
    if (RERUN_PHASES[i].steps.includes(currentStep)) return i;
  }
  // currentStep is something terminal (`rerun_complete`, `ready_for_review`,
  // `held_as_draft`) — every phase is done.
  if (currentStep === "rerun_complete" || currentStep === "ready_for_review" || currentStep === "held_as_draft") {
    return RERUN_PHASES.length;
  }
  return -1;
}

// ─── Status pill ─────────────────────────────────────────────

function statusColor(status: BundleStatus): string {
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

function statusLabel(status: BundleStatus): string {
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

function StatusPill({ status }: { status: BundleStatus }) {
  const color = statusColor(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]"
      style={{
        fontFamily: MONO,
        background: `${color}1A`,
        border: `1px solid ${color}55`,
        color,
      }}
    >
      <span className="h-1 w-1 rounded-full" style={{ background: color }} />
      {statusLabel(status)}
    </span>
  );
}

// ─── Page ────────────────────────────────────────────────────

export default function AdminBundlesPage() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [rows, setRows] = useState<ListRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<BundleStatus[]>(ALL_STATUSES);
  const [searchInput, setSearchInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [sort, setSort] = useState<"recent" | "top" | "trending">("recent");

  // Detail + edit
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [form, setForm] = useState<EditFormState | null>(null);
  // Manual-edit mode for the detail panel. Reset when switching bundles so an
  // open edit session can't carry over to a different row.
  const [editing, setEditing] = useState(false);

  // Per-row active-job indicator: set of slugs currently queued/running.
  const [activeJobSlugs, setActiveJobSlugs] = useState<Set<string>>(new Set());

  // Multi-select. NOT persisted to localStorage — bulk destructive actions
  // require deliberate intent each session.
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [bulkDeleteState, setBulkDeleteState] = useState<'idle' | 'deleting'>('idle');

  // Bulk re-run persistent state. `bulkRerunSince` (ISO timestamp) is stored in
  // localStorage so the button stays disabled across page reloads while jobs are
  // still in flight. Polling clears it once queued + running reach zero.
  const [bulkRerunEnqueuing, setBulkRerunEnqueuing] = useState(false);
  const [bulkRerunSince, setBulkRerunSince] = useState<string | null>(null);
  const [bulkRerunCounts, setBulkRerunCounts] = useState<{
    queued: number;
    running: number;
    completed: number;
    failed: number;
  } | null>(null);
  const [bulkRerunFailures, setBulkRerunFailures] = useState<Array<{
    jobId: string;
    slug: string | null;
    errorStep: string | null;
    errorMessage: string | null;
    updatedAt: string;
  }>>([]);

  // Live progress for the Re-run pipeline button. `rerunStep` is the raw
  // `currentStep` polled from /api/generate/[jobId]; `rerunStatus` mirrors
  // job.status so we know when to stop the polling loops.
  const [rerunStep, setRerunStep] = useState<string | null>(null);
  const [rerunStatus, setRerunStatus] = useState<
    "queued" | "running" | "completed" | "failed" | null
  >(null);

  // Server-truth latest job for the selected bundle. Survives page reloads,
  // unlike `rerunStatus` (which is only set during a click-initiated re-run).
  // Drives the persistent pipeline-status row above the action bar.
  type LatestJob = {
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
  };
  const [latestJob, setLatestJob] = useState<LatestJob | null>(null);

  // Ref mirror of `detail` so polling loops inside setInterval closures
  // can read the latest value without stale captures.
  const currentDetailRef = useRef<DetailRow | null>(null);
  useEffect(() => {
    currentDetailRef.current = detail;
  }, [detail]);

  // Ref for "select all" checkbox — needed to set the indeterminate state
  // when some (but not all) rows are selected.
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate =
      selectedSlugs.size > 0 && selectedSlugs.size < rows.length;
  }, [selectedSlugs.size, rows.length]);

  const buildListUrl = useCallback(
    (cursor?: string | null) => {
      const sp = new URLSearchParams();
      if (statusFilter.length > 0 && statusFilter.length < ALL_STATUSES.length) {
        sp.set("status", statusFilter.join(","));
      }
      if (activeQuery.trim()) sp.set("q", activeQuery.trim());
      if (categoryFilter) sp.set("category", categoryFilter);
      if (sort && sort !== "recent") sp.set("sort", sort);
      if (cursor) sp.set("cursor", cursor);
      return `/api/admin/bundles?${sp.toString()}`;
    },
    [statusFilter, activeQuery, categoryFilter, sort],
  );

  const loadList = useCallback(async () => {
    setLoadState("loading");
    setErrorMsg(null);
    try {
      const res = await fetch(buildListUrl());
      if (res.status === 401 || res.status === 403) {
        setLoadState("forbidden");
        return;
      }
      if (!res.ok) {
        setErrorMsg(`Failed to load (${res.status})`);
        setLoadState("error");
        return;
      }
      const body = (await res.json()) as { items: ListRow[]; nextCursor: string | null };
      setRows(body.items);
      setNextCursor(body.nextCursor);
      setLoadState("ready");
      if (selectedSlug && !body.items.find((r) => r.slug === selectedSlug)) {
        // Selected bundle no longer in the visible list. Keep the detail
        // pane open — user may have just filtered it out.
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
      setLoadState("error");
    }
  }, [buildListUrl, selectedSlug]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    try {
      const res = await fetch(buildListUrl(nextCursor));
      if (!res.ok) return;
      const body = (await res.json()) as { items: ListRow[]; nextCursor: string | null };
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...body.items.filter((r) => !seen.has(r.id))];
      });
      setNextCursor(body.nextCursor);
    } catch {
      // ignore — user can retry
    }
  }, [buildListUrl, nextCursor]);

  // Load categories once.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/categories")
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled) setCategories(body.items ?? []);
      })
      .catch(() => {
        // soft fail — dropdown just shows blank
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reload list whenever filters or search change.
  useEffect(() => {
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, activeQuery, categoryFilter, sort]);

  // On mount, restore any persisted bulk-rerun timestamp so the button stays
  // disabled if the page was reloaded while jobs were still processing.
  useEffect(() => {
    const stored = localStorage.getItem(BULK_RERUN_LS_KEY);
    if (stored) setBulkRerunSince(stored);
  }, []);

  // Poll /api/admin/bundles/bulk-rerun/status every 10 s while a bulk re-run
  // is active. Auto-releases the lock when all jobs reach a terminal state.
  useEffect(() => {
    if (!bulkRerunSince) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/admin/bundles/bulk-rerun/status?since=${encodeURIComponent(bulkRerunSince)}`,
        );
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as {
          queued: number;
          running: number;
          completed: number;
          failed: number;
          recentFailures: Array<{
            jobId: string;
            slug: string | null;
            errorStep: string | null;
            errorMessage: string | null;
            updatedAt: string;
          }>;
        };
        if (cancelled) return;
        setBulkRerunCounts({
          queued: body.queued ?? 0,
          running: body.running ?? 0,
          completed: body.completed ?? 0,
          failed: body.failed ?? 0,
        });
        setBulkRerunFailures(body.recentFailures ?? []);
        // All jobs terminal — release the button lock.
        if ((body.queued ?? 0) === 0 && (body.running ?? 0) === 0) {
          localStorage.removeItem(BULK_RERUN_LS_KEY);
          setBulkRerunSince(null);
        }
      } catch {
        // Ignore — try again on the next interval.
      }
    };

    void poll();
    const handle = window.setInterval(() => void poll(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [bulkRerunSince]);

  // Poll active-jobs every 8 s so per-row indicators stay current.
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch('/api/admin/bundles/active-jobs');
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { slugs: string[] };
        if (!cancelled) setActiveJobSlugs(new Set(body.slugs ?? []));
      } catch {
        // ignore — stale indicators are better than crashing
      }
    };

    void poll();
    const handle = window.setInterval(() => void poll(), 8_000);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, []);

  const loadDetail = useCallback(async (slug: string, silent = false) => {
    if (!silent) {
      setDetailLoading(true);
      setDetail(null);
      setForm(null);
      setActionError(null);
    }
    try {
      const res = await fetch(`/api/admin/bundles/${encodeURIComponent(slug)}`);
      if (!res.ok) {
        setActionError(`Failed to load bundle (${res.status})`);
        return;
      }
      const body = (await res.json()) as { data: DetailRow };
      setDetail(body.data);
      setForm({
        title: body.data.title,
        description: body.data.description,
        sourceUrl: body.data.sourceUrl ?? "",
        designMd: body.data.designMd ?? "",
        companionPrompt: body.data.companionPrompt ?? "",
        designStyle: body.data.designStyle ?? [],
        compatibleTools: body.data.compatibleTools ?? [],
        primaryCategoryId: body.data.primaryCategoryId,
        license: body.data.license ?? "",
        attributionStatement: body.data.attributionStatement ?? "",
        isFeatured: body.data.isFeatured,
        isCurated: body.data.isCurated,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSlug) void loadDetail(selectedSlug);
  }, [selectedSlug, loadDetail]);

  // Fetch the latest generation_jobs row for the selected bundle whenever
  // selection changes. Surfaces queued/running/failed status that persists
  // across page reloads (the click-driven rerunStatus is only set in-session).
  const loadJobStatus = useCallback(async (slug: string) => {
    try {
      const r = await fetch(`/api/admin/bundles/${encodeURIComponent(slug)}/job-status`);
      if (!r.ok) return;
      const body = (await r.json()) as { job: LatestJob | null };
      setLatestJob(body.job);
    } catch {
      // soft fail — status row just won't update this tick
    }
  }, []);

  useEffect(() => {
    setLatestJob(null);
    setActionError(null);
    if (selectedSlug) void loadJobStatus(selectedSlug);
  }, [selectedSlug, loadJobStatus]);

  // Auto-poll job status while the latest job is still in flight. Stops as
  // soon as the server reports `completed` or `failed`, or the job has been
  // stuck (no updatedAt change) for more than 12 minutes.
  // loadDetail is NOT called here — see the completion effect below.
  useEffect(() => {
    if (!selectedSlug) return;
    if (!latestJob) return;
    if (latestJob.status !== "queued" && latestJob.status !== "running") return;
    if (latestJob.status === "running") {
      const ageMs = Date.now() - new Date(latestJob.updatedAt).getTime();
      if (ageMs > 12 * 60 * 1000) return;
    }

    const handle = window.setInterval(() => {
      void loadJobStatus(selectedSlug);
    }, 3000);
    return () => {
      window.clearInterval(handle);
    };
  }, [selectedSlug, latestJob?.status, latestJob?.updatedAt, loadJobStatus]);

  // When a job transitions from in-flight → completed/failed, do a single
  // silent detail refresh so palette, coverage, and companion update without
  // blanking the panel.
  const prevJobStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevJobStatusRef.current;
    const curr = latestJob?.status ?? null;
    prevJobStatusRef.current = curr;
    if (
      (prev === "queued" || prev === "running") &&
      (curr === "completed" || curr === "failed") &&
      selectedSlug &&
      // Don't clobber an in-progress manual edit with the silent refresh.
      !editing
    ) {
      void loadDetail(selectedSlug, true);
    }
  }, [latestJob?.status, selectedSlug, loadDetail, editing]);

  // Leave edit mode whenever the selected bundle changes so an open edit
  // session can't carry over to a different row.
  useEffect(() => {
    setEditing(false);
  }, [selectedSlug]);

  // Dirty state — true when form differs from the loaded detail.
  const isDirty = useMemo(() => {
    if (!detail || !form) return false;
    return (
      form.title !== detail.title ||
      form.description !== detail.description ||
      form.sourceUrl !== (detail.sourceUrl ?? "") ||
      form.designMd !== (detail.designMd ?? "") ||
      form.companionPrompt !== (detail.companionPrompt ?? "") ||
      form.license !== (detail.license ?? "") ||
      form.attributionStatement !== (detail.attributionStatement ?? "") ||
      form.isFeatured !== detail.isFeatured ||
      form.isCurated !== detail.isCurated ||
      form.primaryCategoryId !== detail.primaryCategoryId ||
      form.designStyle.join("|") !== (detail.designStyle ?? []).join("|") ||
      form.compatibleTools.join("|") !== (detail.compatibleTools ?? []).join("|")
    );
  }, [detail, form]);

  const onToggleStatus = (status: BundleStatus) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
  };

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveQuery(searchInput);
  };

  const onSave = async () => {
    if (!detail || !form) return;
    setActionState("saving");
    setActionError(null);
    try {
      const body = {
        title: form.title,
        description: form.description,
        designStyle: form.designStyle,
        compatibleTools: form.compatibleTools,
        primaryCategoryId: form.primaryCategoryId,
        license: form.license,
        attributionStatement: form.attributionStatement.trim() || null,
        isFeatured: form.isFeatured,
        isCurated: form.isCurated,
        // Only send these when changed — sourceUrl recomputes the dedup key,
        // designMd triggers a re-lint, and companionPrompt bumps its version,
        // so we don't want a title-only edit to fire those side-effects.
        ...(form.sourceUrl !== (detail.sourceUrl ?? "")
          ? { sourceUrl: form.sourceUrl }
          : {}),
        ...(form.designMd !== (detail.designMd ?? "")
          ? { designMd: form.designMd }
          : {}),
        ...(form.companionPrompt !== (detail.companionPrompt ?? "")
          ? { companionPrompt: form.companionPrompt }
          : {}),
      };
      const res = await fetch(`/api/admin/bundles/${encodeURIComponent(detail.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const respBody = await res.json().catch(() => ({ error: res.statusText }));
        setActionError(respBody.error || `Save failed (${res.status})`);
        return;
      }
      const respBody = (await res.json()) as { data: DetailRow };
      setDetail(respBody.data);
      setEditing(false);
      setForm({
        title: respBody.data.title,
        description: respBody.data.description,
        sourceUrl: respBody.data.sourceUrl ?? "",
        designMd: respBody.data.designMd ?? "",
        companionPrompt: respBody.data.companionPrompt ?? "",
        designStyle: respBody.data.designStyle ?? [],
        compatibleTools: respBody.data.compatibleTools ?? [],
        primaryCategoryId: respBody.data.primaryCategoryId,
        license: respBody.data.license ?? "",
        attributionStatement: respBody.data.attributionStatement ?? "",
        isFeatured: respBody.data.isFeatured,
        isCurated: respBody.data.isCurated,
      });
      // Reflect changes in the list row in-place.
      setRows((prev) =>
        prev.map((r) =>
          r.slug === respBody.data.slug
            ? {
                ...r,
                title: respBody.data.title,
                description: respBody.data.description,
                designStyle: respBody.data.designStyle ?? [],
                compatibleTools: respBody.data.compatibleTools ?? [],
                primaryCategorySlug: respBody.data.primaryCategorySlug,
                primaryCategoryName: respBody.data.primaryCategoryName,
                license: respBody.data.license ?? r.license,
                isFeatured: respBody.data.isFeatured,
                isCurated: respBody.data.isCurated,
                updatedAt: respBody.data.updatedAt,
              }
            : r,
        ),
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    } finally {
      setActionState("idle");
    }
  };

  // Discard edits: re-seed the form from the loaded detail and exit edit mode.
  const onCancelEdit = () => {
    if (detail) {
      setForm({
        title: detail.title,
        description: detail.description,
        sourceUrl: detail.sourceUrl ?? "",
        designMd: detail.designMd ?? "",
        companionPrompt: detail.companionPrompt ?? "",
        designStyle: detail.designStyle ?? [],
        compatibleTools: detail.compatibleTools ?? [],
        primaryCategoryId: detail.primaryCategoryId,
        license: detail.license ?? "",
        attributionStatement: detail.attributionStatement ?? "",
        isFeatured: detail.isFeatured,
        isCurated: detail.isCurated,
      });
    }
    setActionError(null);
    setEditing(false);
  };

  const onDelete = async () => {
    if (!detail) return;
    // Two-step confirmation: window.confirm + slug typing. Permanent
    // delete shouldn't be a single accidental click.
    const ok = window.confirm(
      `PERMANENTLY DELETE "${detail.title}"?\n\n` +
        "This removes the bundle row, its votes, its job history, its " +
        "screenshot blob, and any collection membership. The slug becomes " +
        "available for reuse.\n\n" +
        "Use Archive if you only want to hide it from /library.",
    );
    if (!ok) return;
    const typed = window.prompt(
      `Type the slug "${detail.slug}" to confirm permanent deletion:`,
    );
    if (typed !== detail.slug) {
      setActionError("Delete cancelled — slug did not match.");
      return;
    }
    setActionState("deleting");
    setActionError(null);
    try {
      const res = await fetch(
        `/api/admin/bundles/${encodeURIComponent(detail.slug)}/delete`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        setActionError(body.error || `Delete failed (${res.status})`);
        return;
      }
      setSelectedSlug(null);
      setDetail(null);
      setForm(null);
      await loadList();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    } finally {
      setActionState("idle");
    }
  };

  const onArchive = async () => {
    if (!detail) return;
    if (!window.confirm(`Archive "${detail.title}"? It will be hidden from /library.`)) return;
    setActionState("archiving");
    setActionError(null);
    try {
      const res = await fetch(
        `/api/admin/bundles/${encodeURIComponent(detail.slug)}/archive`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        setActionError(body.error || `Archive failed (${res.status})`);
        return;
      }
      await loadDetail(detail.slug);
      await loadList();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    } finally {
      setActionState("idle");
    }
  };

  const onRestore = async (target: "published" | "pending_review") => {
    if (!detail) return;
    setActionState("restoring");
    setActionError(null);
    try {
      const res = await fetch(
        `/api/admin/bundles/${encodeURIComponent(detail.slug)}/restore`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetStatus: target }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        setActionError(body.error || `Restore failed (${res.status})`);
        return;
      }
      await loadDetail(detail.slug);
      await loadList();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    } finally {
      setActionState("idle");
    }
  };

  const onPublish = async () => {
    if (!detail) return;
    setActionState("publishing");
    setActionError(null);
    try {
      const res = await fetch(
        `/api/admin/bundles/${encodeURIComponent(detail.slug)}/publish`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        setActionError(body.error || `Publish failed (${res.status})`);
        return;
      }
      await loadDetail(detail.slug);
      await loadList();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    } finally {
      setActionState("idle");
    }
  };

  const onRegenerateCompanion = async () => {
    if (!detail) return;
    setActionState("regenerating-companion");
    setActionError(null);
    try {
      const res = await fetch(
        `/api/admin/bundles/${encodeURIComponent(detail.slug)}/regenerate-companion`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        setActionError(body.error || `Regenerate failed (${res.status})`);
        return;
      }
      await loadDetail(detail.slug);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    } finally {
      setActionState("idle");
    }
  };

  const onBulkRerun = async () => {
    const confirmed = window.confirm(
      "Re-run the full pipeline for ALL bundles that have a source URL?\n\n" +
        "Up to 50 will be enqueued per call, staggered 20s apart. " +
        "Already-in-flight bundles are skipped automatically. " +
        "Call again if remaining > 0.",
    );
    if (!confirmed) return;
    setBulkRerunEnqueuing(true);
    setBulkRerunCounts(null);
    try {
      const res = await fetch("/api/admin/bundles/bulk-rerun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        enqueued?: number;
        remaining?: number;
        etaSeconds?: number;
        error?: string;
      };
      if (!res.ok) {
        alert(body.error || `Bulk re-run failed (${res.status})`);
        return;
      }
      const enqueued = body.enqueued ?? 0;
      if (enqueued > 0) {
        // Persist the trigger time so the button lock survives page reloads.
        const since = new Date().toISOString();
        localStorage.setItem(BULK_RERUN_LS_KEY, since);
        setBulkRerunSince(since);
      }
      setBulkRerunCounts({ queued: enqueued, running: 0, completed: 0, failed: 0 });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Network error");
    } finally {
      setBulkRerunEnqueuing(false);
    }
  };

  // Returns true on successful enqueue, false on any error. The caller (the
  // re-run panel in DetailEditor) uses this to decide whether to close + clear
  // the feedback box — on failure it keeps the panel open so typed feedback
  // survives a transient 409 / network error (the error surfaces via actionError).
  const onRerunPipeline = async (feedback?: string): Promise<boolean> => {
    if (!detail) return false;

    setActionState("rerunning-pipeline");
    setActionError(null);
    setRerunStep(null);
    setRerunStatus("queued");

    let jobId: string | null = null;
    try {
      const res = await fetch(
        `/api/admin/bundles/${encodeURIComponent(detail.slug)}/rerun-pipeline`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback: feedback?.trim() || undefined }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        setActionError(body.error || `Re-run failed (${res.status})`);
        setActionState("idle");
        setRerunStatus(null);
        return false;
      }
      const body = (await res.json()) as { jobId?: string };
      jobId = body.jobId ?? null;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
      setActionState("idle");
      setRerunStatus(null);
      return false;
    }

    // Pipeline enqueued. From here, the persistent useEffect-driven polling
    // (loadJobStatus + loadDetail every 3s, gated on latestJob.status) takes
    // over and runs forever until the server reports `completed` or `failed`.
    // That gives us a status indicator that survives page reloads — no need
    // for the old in-session timer + 2-min timeout fallback.
    void jobId; // discard — server is the source of truth via /job-status
    setActionState("idle");
    setRerunStep(null);
    setRerunStatus(null);
    await loadJobStatus(detail.slug);
    return true;
  };

  const toggleSlug = (slug: string) =>
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });

  const toggleAll = () =>
    setSelectedSlugs((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.slug)),
    );

  const onBulkRerunSelected = async () => {
    const slugsArr = Array.from(selectedSlugs);
    if (!window.confirm(`Re-run the pipeline for ${slugsArr.length} bundle(s)?`)) return;
    setBulkRerunEnqueuing(true);
    setBulkRerunCounts(null);
    try {
      const res = await fetch('/api/admin/bundles/bulk-rerun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slugs: slugsArr }),
      });
      const body = (await res.json()) as { ok?: boolean; enqueued?: number; error?: string };
      if (!res.ok) {
        alert(body.error || `Bulk re-run failed (${res.status})`);
        return;
      }
      const enqueued = body.enqueued ?? 0;
      if (enqueued > 0) {
        const since = new Date().toISOString();
        localStorage.setItem(BULK_RERUN_LS_KEY, since);
        setBulkRerunSince(since);
      }
      setBulkRerunCounts({ queued: enqueued, running: 0, completed: 0, failed: 0 });
      setSelectedSlugs(new Set());
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBulkRerunEnqueuing(false);
    }
  };

  const onBulkDeleteSelected = async () => {
    const slugsArr = Array.from(selectedSlugs);
    const matchedRows = rows.filter((r) => selectedSlugs.has(r.slug));
    const preview = matchedRows
      .slice(0, 5)
      .map((r) => `• ${r.title}`)
      .join('\n');
    const extra = matchedRows.length > 5 ? `\n+ ${matchedRows.length - 5} more` : '';
    if (
      !window.confirm(
        `Permanently delete ${slugsArr.length} bundle(s)?\n\n${preview}${extra}`,
      )
    )
      return;
    setBulkDeleteState('deleting');
    try {
      const res = await fetch('/api/admin/bundles/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slugs: slugsArr }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        deleted?: number;
        notFound?: string[];
        error?: string;
      };
      if (!res.ok) {
        alert(body.error || `Delete failed (${res.status})`);
        return;
      }
      const deletedSet = new Set(
        slugsArr.filter((s) => !(body.notFound ?? []).includes(s)),
      );
      setRows((prev) => prev.filter((r) => !deletedSet.has(r.slug)));
      if (selectedSlug && deletedSet.has(selectedSlug)) {
        setSelectedSlug(null);
        setDetail(null);
        setForm(null);
      }
      setSelectedSlugs(new Set());
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBulkDeleteState('idle');
    }
  };

  // True while the bulk re-run button should stay disabled: during the
  // enqueue API call, or while polled jobs are still queued / running.
  const bulkRerunActive =
    bulkRerunEnqueuing ||
    (bulkRerunSince !== null &&
      (bulkRerunCounts === null ||
        bulkRerunCounts.queued > 0 ||
        bulkRerunCounts.running > 0));

  // ─── Render states ─────────────────────────────────────────

  if (loadState === "loading") {
    return (
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-20 flex items-center gap-3" style={{ color: SUB }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-[13px]" style={{ fontFamily: MONO }}>
          loading bundles…
        </span>
      </div>
    );
  }

  if (loadState === "forbidden") {
    return (
      <div className="mx-auto max-w-2xl px-6 lg:px-8 py-20 text-center">
        <ShieldCheck className="h-8 w-8 mx-auto mb-4" style={{ color: PEACH }} />
        <h1 className="text-[28px] font-medium tracking-[-0.018em]">Editor access required</h1>
        <p className="mt-3 text-[14px] leading-[1.6]" style={{ color: SUB }}>
          This page is restricted to verified editors.
        </p>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="mx-auto max-w-2xl px-6 lg:px-8 py-20 text-center">
        <h1 className="text-[22px] font-medium">Couldn&apos;t load bundles</h1>
        <p className="mt-2 text-[13px]" style={{ color: SUB, fontFamily: MONO }}>
          {errorMsg ?? "Unknown error"}
        </p>
        <button
          type="button"
          onClick={() => void loadList()}
          className="mt-5 h-9 rounded-full px-4 text-[12.5px] inline-flex items-center gap-2"
          style={{ background: INK, color: INK_ON_LIGHT }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-8 py-10">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <SectionLabel t="Library management" />
          <h1 className="mt-3 text-[28px] font-medium tracking-[-0.018em]">
            Bundles · {rows.length}
            {nextCursor ? "+" : ""}
          </h1>
          <p className="mt-2 text-[12.5px]" style={{ color: SUB }}>
            All bundles across every status. Edit metadata, archive, restore, or jump to the reviewer queue for pending items.
          </p>
        </div>
      </div>

      {/* Selection toolbar — visible when one or more rows are checked */}
      {selectedSlugs.size > 0 && (
        <div
          className="mb-5 rounded-xl border px-4 py-2.5 flex items-center gap-3 flex-wrap"
          style={{ borderColor: `${CYAN}66`, background: `${CYAN}0D` }}
        >
          <span
            className="text-[12px] flex items-center gap-1.5"
            style={{ color: CYAN, fontFamily: MONO }}
          >
            <span className="font-medium">{selectedSlugs.size}</span> selected
          </span>
          <button
            type="button"
            onClick={() => setSelectedSlugs(new Set())}
            className="h-5 w-5 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: MUTED }}
            aria-label="Clear selection"
          >
            <X className="h-3 w-3" />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onBulkRerunSelected()}
              disabled={bulkRerunActive || bulkDeleteState === 'deleting'}
              className="h-8 rounded-full border px-3 text-[12px] inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: `${VIOLET}66`, color: VIOLET, fontFamily: MONO }}
            >
              <RotateCw className="h-3 w-3" />
              Re-run selected
            </button>
            <button
              type="button"
              onClick={() => void onBulkDeleteSelected()}
              disabled={bulkDeleteState === 'deleting' || bulkRerunActive}
              className="h-8 rounded-full border px-3 text-[12px] inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: '#ff5a5a66', color: '#ff7070', fontFamily: MONO }}
            >
              {bulkDeleteState === 'deleting' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
              Delete selected
            </button>
          </div>
        </div>
      )}

      {/* Bulk re-run live status panel — visible while active and after completion */}
      {(bulkRerunSince !== null || bulkRerunCounts !== null) && (
        <div
          className="mb-5 rounded-xl border px-4 py-3"
          style={{ borderColor: BORDER, background: SURFACE_2 }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              {bulkRerunSince !== null ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" style={{ color: CYAN }} />
              ) : (
                <Check className="h-3.5 w-3.5 shrink-0" style={{ color: LIME }} />
              )}
              <span
                className="text-[11.5px]"
                style={{ color: bulkRerunSince !== null ? CYAN : LIME, fontFamily: MONO }}
              >
                {bulkRerunSince !== null ? "bulk re-run in progress" : "bulk re-run complete"}
              </span>
              {bulkRerunCounts !== null ? (
                <div className="flex items-center gap-2 text-[11px]" style={{ fontFamily: MONO }}>
                  {bulkRerunCounts.queued > 0 && (
                    <span style={{ color: SUB }}>queued: {bulkRerunCounts.queued}</span>
                  )}
                  {bulkRerunCounts.running > 0 && (
                    <span style={{ color: CYAN }}>running: {bulkRerunCounts.running}</span>
                  )}
                  <span style={{ color: LIME }}>done: {bulkRerunCounts.completed}</span>
                  {bulkRerunCounts.failed > 0 && (
                    <span style={{ color: PEACH }}>failed: {bulkRerunCounts.failed}</span>
                  )}
                </div>
              ) : (
                <span className="text-[11px]" style={{ color: MUTED, fontFamily: MONO }}>
                  checking status…
                </span>
              )}
            </div>
            {/* Dismiss is only available once polling has stopped (terminal state) */}
            {bulkRerunSince === null && (
              <button
                type="button"
                onClick={() => { setBulkRerunCounts(null); setBulkRerunFailures([]); }}
                className="h-6 w-6 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 shrink-0 transition-opacity"
                style={{ color: MUTED }}
                aria-label="Dismiss bulk re-run status"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {bulkRerunFailures.length > 0 && (
            <details className="mt-2.5">
              <summary
                className="cursor-pointer text-[10.5px] uppercase tracking-[0.18em] list-none flex items-center gap-1.5"
                style={{ color: PEACH, fontFamily: MONO }}
              >
                <span>▸</span>
                {bulkRerunFailures.length} failure{bulkRerunFailures.length !== 1 ? "s" : ""}
              </summary>
              <ul className="mt-2 flex flex-col gap-1.5 pl-1">
                {bulkRerunFailures.map((f) => (
                  <li
                    key={f.jobId}
                    className="text-[11px] leading-tight"
                    style={{ fontFamily: MONO }}
                  >
                    <span style={{ color: INK }}>{f.slug ?? f.jobId}</span>
                    {f.errorStep && (
                      <span style={{ color: MUTED }}> · {f.errorStep}</span>
                    )}
                    {f.errorMessage && (
                      <span
                        className="block truncate pl-3 mt-0.5"
                        style={{ color: MUTED }}
                        title={f.errorMessage}
                      >
                        {f.errorMessage}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div
        className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-px rounded-xl overflow-hidden"
        style={{ background: BORDER }}
      >
        {/* List + filters pane */}
        <div className="flex flex-col" style={{ background: BG, minHeight: 540 }}>
          {/* Filters */}
          <div className="p-3 border-b" style={{ borderColor: BORDER_SOFT }}>
            <form onSubmit={onSearchSubmit} className="flex items-center gap-2">
              <div className="flex-1 h-9 rounded-full border flex items-center gap-2 px-3" style={{ borderColor: BORDER, background: SURFACE }}>
                <Search className="h-3.5 w-3.5" style={{ color: MUTED }} />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="search title or description"
                  className="flex-1 bg-transparent text-[12.5px] outline-none"
                  style={{ color: INK, fontFamily: MONO }}
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      setActiveQuery("");
                    }}
                    className="opacity-60 hover:opacity-100"
                    style={{ color: SUB }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </form>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {ALL_STATUSES.map((s) => {
                const active = statusFilter.includes(s);
                const color = statusColor(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onToggleStatus(s)}
                    className="text-[10.5px] uppercase tracking-[0.18em] rounded-full px-2 py-1"
                    style={{
                      fontFamily: MONO,
                      background: active ? `${color}1A` : "transparent",
                      border: `1px solid ${active ? `${color}55` : BORDER}`,
                      color: active ? color : MUTED,
                    }}
                  >
                    {statusLabel(s)}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-7 rounded-full border bg-transparent text-[11px] px-2"
                style={{ borderColor: BORDER, color: INK, fontFamily: MONO }}
              >
                <option value="">all categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as "recent" | "top" | "trending")}
                className="h-7 rounded-full border bg-transparent text-[11px] px-2"
                style={{ borderColor: BORDER, color: INK, fontFamily: MONO }}
              >
                <option value="recent">recent</option>
                <option value="top">top (coverage)</option>
                <option value="trending">submitted</option>
              </select>
            </div>
            {rows.length > 0 && (
              <div
                className="mt-2.5 pt-2.5 border-t flex items-center gap-2"
                style={{ borderColor: BORDER_SOFT }}
              >
                <label
                  className="flex items-center gap-2 cursor-pointer text-[10.5px]"
                  style={{ color: MUTED, fontFamily: MONO }}
                >
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={selectedSlugs.size === rows.length && rows.length > 0}
                    onChange={toggleAll}
                    className="cursor-pointer"
                    style={{ accentColor: CYAN }}
                  />
                  {selectedSlugs.size > 0
                    ? `${selectedSlugs.size} of ${rows.length} selected`
                    : "select all"}
                </label>
              </div>
            )}
          </div>

          {/* List rows */}
          <div className="flex-1 overflow-y-auto p-2" style={{ maxHeight: 720 }}>
            {rows.length === 0 ? (
              <div
                className="h-full flex items-center justify-center text-[12px] py-20"
                style={{ color: MUTED, fontFamily: MONO }}
              >
                no bundles match these filters
              </div>
            ) : (
              <ul className="flex flex-col gap-1">
                {rows.map((row) => {
                  const isActive = row.slug === selectedSlug;
                  const hasActiveJob = activeJobSlugs.has(row.slug);
                  const isChecked = selectedSlugs.has(row.slug);
                  return (
                    <li
                      key={row.id}
                      className="group flex items-stretch rounded-lg transition-colors"
                      style={{
                        background: isActive ? SURFACE_2 : "transparent",
                        border: `1px solid ${isActive ? BORDER : "transparent"}`,
                      }}
                    >
                      {/* Checkbox — independent click target; doesn't open detail pane */}
                      <label
                        className={`flex items-center justify-center w-7 shrink-0 cursor-pointer transition-opacity${selectedSlugs.size > 0 ? '' : ' opacity-0 group-hover:opacity-100'}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSlug(row.slug)}
                          className="h-3 w-3 cursor-pointer"
                          style={{ accentColor: CYAN }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setSelectedSlug(row.slug)}
                        className="flex-1 text-left px-3 py-2.5 min-w-0"
                        style={{ background: "transparent" }}
                      >
                        <div className="flex items-center gap-2">
                          {/* Active pipeline indicator */}
                          {hasActiveJob ? (
                            <span
                              className="h-1.5 w-1.5 rounded-full animate-pulse shrink-0"
                              style={{ background: CYAN }}
                              title="Pipeline re-run in progress"
                            />
                          ) : null}
                          <span
                            className="text-[13px] truncate flex-1"
                            style={{ color: INK, fontWeight: isActive ? 600 : 400 }}
                          >
                            {row.title}
                          </span>
                          {row.isFeatured ? (
                            <Star className="h-3 w-3 shrink-0" style={{ color: CYAN }} aria-label="Featured" />
                          ) : null}
                          {isActive ? (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: SUB }} />
                          ) : null}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <StatusPill status={row.status} />
                          {row.coverageScore !== null ? (
                            <span
                              className="text-[10px] rounded px-1.5 py-0.5"
                              style={{
                                fontFamily: MONO,
                                color: row.coverageScore >= 70 ? LIME : row.coverageScore >= 40 ? PEACH : MUTED,
                                border: `1px solid ${(row.coverageScore >= 70 ? LIME : row.coverageScore >= 40 ? PEACH : MUTED)}55`,
                              }}
                            >
                              {row.coverageScore}
                            </span>
                          ) : null}
                          {hasActiveJob ? (
                            <span
                              className="text-[9.5px] uppercase tracking-[0.18em]"
                              style={{ color: CYAN, fontFamily: MONO }}
                            >
                              running
                            </span>
                          ) : (
                            <span className="text-[10px] truncate" style={{ color: MUTED, fontFamily: MONO }}>
                              {row.sourceDomain ?? "—"}
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex gap-1">
                          {row.paletteColors?.slice(0, 6).map((c, i) => (
                            <span
                              key={`${row.id}-${c}-${i}`}
                              className="h-2.5 w-2.5 rounded-sm"
                              style={{ background: c, border: `1px solid ${BORDER_SOFT}` }}
                            />
                          ))}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {nextCursor ? (
              <button
                type="button"
                onClick={() => void loadMore()}
                className="w-full mt-2 h-9 rounded-md border text-[11.5px]"
                style={{ borderColor: BORDER, color: SUB, fontFamily: MONO }}
              >
                load more
              </button>
            ) : null}
          </div>
        </div>

        {/* Detail / edit pane */}
        <div className="p-6" style={{ background: BG, minHeight: 540 }}>
          {!selectedSlug ? (
            <div
              className="h-full flex items-center justify-center text-[12px]"
              style={{ color: MUTED, fontFamily: MONO }}
            >
              select a bundle from the list to view or edit
            </div>
          ) : detailLoading || !detail || !form ? (
            <div className="flex items-center gap-2 text-[12px]" style={{ color: SUB, fontFamily: MONO }}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              loading {selectedSlug}…
            </div>
          ) : (
            <DetailEditor
              detail={detail}
              form={form}
              setForm={setForm}
              editing={editing}
              onEnterEdit={() => setEditing(true)}
              onCancelEdit={onCancelEdit}
              categories={categories}
              isDirty={isDirty}
              actionState={actionState}
              actionError={actionError}
              rerunStep={rerunStep}
              rerunStatus={rerunStatus}
              latestJob={latestJob}
              onSave={onSave}
              onArchive={onArchive}
              onRestore={onRestore}
              onPublish={onPublish}
              onRegenerateCompanion={onRegenerateCompanion}
              onRerunPipeline={onRerunPipeline}
              onDelete={onDelete}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Detail editor ───────────────────────────────────────────

interface DetailEditorProps {
  detail: DetailRow;
  form: EditFormState;
  setForm: (form: EditFormState) => void;
  editing: boolean;
  onEnterEdit: () => void;
  onCancelEdit: () => void;
  categories: Category[];
  isDirty: boolean;
  actionState: ActionState;
  actionError: string | null;
  rerunStep: string | null;
  rerunStatus: "queued" | "running" | "completed" | "failed" | null;
  latestJob: {
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
  } | null;
  onSave: () => void | Promise<void>;
  onArchive: () => void | Promise<void>;
  onRestore: (target: "published" | "pending_review") => void | Promise<void>;
  onPublish: () => void | Promise<void>;
  onRegenerateCompanion: () => void | Promise<void>;
  onRerunPipeline: (feedback?: string) => Promise<boolean>;
  onDelete: () => void | Promise<void>;
}

function fmtElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}

// Compact 4-phase progress strip rendered inside the sticky action bar
// while a Re-run pipeline job is in flight. Mirrors /generate's phase
// model so editors and end-users see the same machine.
function RerunProgress({
  step,
  status,
  createdAt,
  firecrawlDoneAt,
  geminiExtractDoneAt,
  designMdDoneAt,
  lintDoneAt,
}: {
  step: string | null;
  status: "queued" | "running" | "completed" | "failed" | null;
  createdAt: string | null;
  firecrawlDoneAt: string | null;
  geminiExtractDoneAt: string | null;
  designMdDoneAt: string | null;
  lintDoneAt: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status !== "queued" && status !== "running") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status]);

  const phaseIdx = rerunPhaseIndex(step);
  const failed = status === "failed";

  // Boundaries: jobStart, firecrawlDone, geminiDone, designMdDone, lintDone
  const boundaries: (number | null)[] = [
    createdAt ? new Date(createdAt).getTime() : null,
    firecrawlDoneAt ? new Date(firecrawlDoneAt).getTime() : null,
    geminiExtractDoneAt ? new Date(geminiExtractDoneAt).getTime() : null,
    designMdDoneAt ? new Date(designMdDoneAt).getTime() : null,
    lintDoneAt ? new Date(lintDoneAt).getTime() : null,
  ];

  const phaseElapsed = RERUN_PHASES.map((_, i) => {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    if (start === null) return null;
    if (end !== null) return fmtElapsed(end - start);
    if (i === phaseIdx) return fmtElapsed(now - start) + " ↑";
    return null;
  });

  const totalElapsed = boundaries[0] !== null ? fmtElapsed(now - boundaries[0]) : null;

  return (
    <div
      className="rounded-md border px-3 py-2.5"
      style={{ borderColor: BORDER, background: SURFACE_2 }}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[10.5px] uppercase tracking-[0.22em]"
          style={{ color: MUTED, fontFamily: MONO }}
        >
          {failed ? "pipeline failed" : status === "completed" ? "pipeline complete" : "re-running pipeline"}
        </span>
        <span className="text-[10.5px]" style={{ color: SUB, fontFamily: MONO }}>
          {totalElapsed ?? step ?? "queued"}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {RERUN_PHASES.map((phase, i) => {
          const state =
            failed && i === phaseIdx
              ? "failed"
              : i < phaseIdx
                ? "done"
                : i === phaseIdx
                  ? "active"
                  : "pending";
          const fill =
            state === "done"
              ? LIME
              : state === "active"
                ? CYAN
                : state === "failed"
                  ? PEACH
                  : BORDER;
          return (
            <div key={phase.id} className="flex flex-col gap-1">
              <div
                className="h-1 rounded-full overflow-hidden"
                style={{ background: BORDER_SOFT }}
              >
                <div
                  className={state === "active" ? "h-full animate-pulse" : "h-full"}
                  style={{
                    background: fill,
                    width: state === "done" ? "100%" : state === "active" ? "55%" : "0%",
                    transition: "width 400ms ease, background 200ms ease",
                  }}
                />
              </div>
              <div
                className="text-[10.5px] leading-tight truncate"
                style={{
                  color: state === "pending" ? MUTED : INK,
                  fontFamily: state === "pending" ? MONO : undefined,
                }}
              >
                {phase.label}
              </div>
              <div
                className="text-[9.5px] uppercase tracking-[0.16em] truncate"
                style={{ color: MUTED, fontFamily: MONO }}
              >
                {phase.tool}
              </div>
              {phaseElapsed[i] ? (
                <div
                  className="text-[9.5px] tabular-nums"
                  style={{ color: state === "active" ? CYAN : MUTED, fontFamily: MONO }}
                >
                  {phaseElapsed[i]}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetailEditor(props: DetailEditorProps) {
  const { detail, form, setForm, editing, onEnterEdit, onCancelEdit, categories, isDirty, actionState, actionError, rerunStep, rerunStatus, latestJob } = props;
  // `categories` is reserved for the (still-scaffolded) category picker; the
  // current manual-edit surface covers title, URL, description, design.md,
  // and the companion prompt.
  void categories;
  const status = detail.status as BundleStatus;
  const busy = actionState !== "idle";

  // Effective progress source: click-driven state takes priority while a
  // re-run is actively initiated this session; otherwise fall back to the
  // server-truth latestJob so the indicator survives page reloads.
  const effectiveStatus = rerunStatus ?? latestJob?.status ?? null;
  const effectiveStep = rerunStep ?? latestJob?.currentStep ?? null;
  const showProgress = effectiveStatus === "queued" || effectiveStatus === "running";
  const showFailureBanner =
    !showProgress && latestJob?.status === "failed" && rerunStatus !== "completed";
  const isStuck =
    latestJob?.status === "running" &&
    Date.now() - new Date(latestJob.updatedAt).getTime() > 12 * 60 * 1000;

  const [showRerunPanel, setShowRerunPanel] = useState(false);
  const [rerunFeedback, setRerunFeedback] = useState("");

  // Reset the panel when the editor switches to a different bundle so feedback
  // typed for one bundle can't leak into another. DetailEditor isn't keyed by
  // slug, so its local state otherwise persists across row selections.
  useEffect(() => {
    setShowRerunPanel(false);
    setRerunFeedback("");
  }, [detail.slug]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusPill status={status} />
            <span className="text-[10.5px]" style={{ color: MUTED, fontFamily: MONO }}>
              slug: {detail.slug}
            </span>
          </div>
          {editing ? (
            <div className="mt-3 flex flex-col gap-3">
              <FieldGroup label="title">
                <input
                  type="text"
                  value={form.title}
                  maxLength={200}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-md border px-2.5 py-2 text-[14px] outline-none"
                  style={{ color: INK, background: SURFACE_2, borderColor: BORDER }}
                />
              </FieldGroup>
              <FieldGroup label="description">
                <textarea
                  value={form.description}
                  rows={3}
                  maxLength={2000}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full resize-y rounded-md border px-2.5 py-2 text-[13px] outline-none"
                  style={{ color: INK, background: SURFACE_2, borderColor: BORDER }}
                />
              </FieldGroup>
              <FieldGroup label="source url">
                <input
                  type="url"
                  value={form.sourceUrl}
                  maxLength={2000}
                  placeholder="https://example.com"
                  onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
                  className="w-full rounded-md border px-2.5 py-2 text-[12px] outline-none"
                  style={{ color: INK, background: SURFACE_2, borderColor: BORDER, fontFamily: MONO }}
                />
              </FieldGroup>
            </div>
          ) : (
            <>
              <h1
                className="mt-3 text-[24px] font-medium tracking-[-0.014em]"
                style={{ color: INK }}
              >
                {detail.title}
              </h1>
              <p
                className="mt-2 text-[13px] leading-[1.55]"
                style={{ color: SUB }}
              >
                {detail.description}
              </p>
              {detail.sourceUrl ? (
                <a
                  href={detail.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-3 inline-flex items-center gap-1.5 text-[11px] underline underline-offset-4"
                  style={{ color: SUB, fontFamily: MONO }}
                >
                  {detail.sourceUrl}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </>
          )}
        </div>
        {detail.coverageScore !== null ? (
          <div
            className="rounded-lg border px-3 py-2.5 shrink-0"
            style={{ borderColor: BORDER, background: SURFACE_2, minWidth: 196 }}
          >
            {/* Overall score */}
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <div className="text-[9.5px] uppercase tracking-[0.22em]" style={{ color: MUTED, fontFamily: MONO }}>
                coverage
              </div>
              <div
                className="text-[18px] font-medium leading-none"
                style={{
                  color: detail.coverageScore >= 70 ? LIME : detail.coverageScore >= 40 ? PEACH : MUTED,
                  fontFamily: MONO,
                }}
              >
                {detail.coverageScore}
                <span className="text-[10px]" style={{ color: MUTED }}> / 100</span>
              </div>
            </div>
            {/* Section breakdown */}
            <div
              className="flex flex-col gap-1.5 pt-2 border-t"
              style={{ borderColor: BORDER_SOFT }}
            >
              {(
                [
                  { label: "colors",     score: detail.coverageColors },
                  { label: "typography", score: detail.coverageTypography },
                  { label: "layout",     score: detail.coverageLayout },
                  { label: "elevation",  score: detail.coverageElevation },
                  { label: "shapes",     score: detail.coverageShapes },
                  { label: "components", score: detail.coverageComponents },
                  { label: "dos/don'ts", score: detail.coverageDosDonts },
                ] as { label: string; score: number | null }[]
              ).map(({ label, score }) => {
                const c =
                  score === null ? MUTED
                  : score >= 70 ? LIME
                  : score >= 40 ? PEACH
                  : "#ff7070";
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span
                      className="text-[9.5px] shrink-0"
                      style={{ color: MUTED, fontFamily: MONO, width: 68 }}
                    >
                      {label}
                    </span>
                    <div
                      className="flex-1 h-1 rounded-full overflow-hidden"
                      style={{ background: BORDER_SOFT }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${score ?? 0}%`, background: c }}
                      />
                    </div>
                    <span
                      className="text-[9.5px] tabular-nums shrink-0"
                      style={{ color: c, fontFamily: MONO, width: 20, textAlign: "right" }}
                    >
                      {score ?? "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* Palette + source meta */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-4">
        <div className="rounded-lg border p-4" style={{ borderColor: BORDER, background: SURFACE }}>
          <div
            className="text-[10px] uppercase tracking-[0.22em] mb-3"
            style={{ color: MUTED, fontFamily: MONO }}
          >
            palette · system-managed
          </div>
          {detail.paletteColors?.length ? (
            <div className="flex h-7 rounded overflow-hidden">
              {detail.paletteColors.map((c, i) => (
                <span key={`${c}-${i}`} className="flex-1" style={{ background: c }} title={c} />
              ))}
            </div>
          ) : (
            <div className="text-[11px]" style={{ color: MUTED, fontFamily: MONO }}>
              no palette
            </div>
          )}
        </div>
        <div
          className="rounded-lg border p-4 flex flex-col gap-1.5"
          style={{ borderColor: BORDER, background: SURFACE }}
        >
          <div
            className="text-[10px] uppercase tracking-[0.22em]"
            style={{ color: MUTED, fontFamily: MONO }}
          >
            meta
          </div>
          <MetaRow k="author" v={detail.authorName ?? "—"} />
          <MetaRow k="votes" v={`${detail.voteCount} (${detail.positiveVoteRate}%)`} />
          <MetaRow k="companion" v={detail.companionStatus} />
        </div>
      </div>

      {/* design.md / companion — read-only until the editor enters edit mode */}
      <details
        className="rounded-lg border"
        style={{ borderColor: BORDER, background: SURFACE }}
        open={editing || undefined}
      >
        <summary
          className="cursor-pointer p-3 text-[11.5px] uppercase tracking-[0.22em]"
          style={{ color: SUB, fontFamily: MONO }}
        >
          design.md {editing ? "(editing — re-lints on save)" : "(read-only)"}
        </summary>
        {editing ? (
          <textarea
            value={form.designMd}
            rows={24}
            maxLength={200_000}
            onChange={(e) => setForm({ ...form, designMd: e.target.value })}
            className="w-full resize-y px-4 py-3 text-[11px] leading-[1.55] outline-none border-t"
            style={{ color: INK, fontFamily: MONO, background: SURFACE_2, borderColor: BORDER_SOFT }}
          />
        ) : (
          <pre
            className="px-4 py-3 text-[11px] leading-[1.55] whitespace-pre-wrap overflow-x-auto max-h-[360px] border-t"
            style={{ color: INK, fontFamily: MONO, borderColor: BORDER_SOFT }}
          >
            {detail.designMd ?? "(empty)"}
          </pre>
        )}
      </details>
      <details
        className="rounded-lg border"
        style={{ borderColor: BORDER, background: SURFACE }}
        open={editing || undefined}
      >
        <summary
          className="cursor-pointer p-3 text-[11.5px] uppercase tracking-[0.22em]"
          style={{ color: SUB, fontFamily: MONO }}
        >
          companion prompt {editing ? "(editing — bumps version)" : "(read-only)"} · {detail.companionStatus}
        </summary>
        {editing ? (
          <textarea
            value={form.companionPrompt}
            rows={20}
            maxLength={200_000}
            onChange={(e) => setForm({ ...form, companionPrompt: e.target.value })}
            className="w-full resize-y px-4 py-3 text-[11px] leading-[1.55] outline-none border-t"
            style={{ color: INK, fontFamily: MONO, background: SURFACE_2, borderColor: BORDER_SOFT }}
          />
        ) : (
          <pre
            className="px-4 py-3 text-[11px] leading-[1.55] whitespace-pre-wrap overflow-x-auto max-h-[360px] border-t"
            style={{ color: INK, fontFamily: MONO, borderColor: BORDER_SOFT }}
          >
            {detail.companionPrompt || "(empty)"}
          </pre>
        )}
      </details>
      {detail.reviewNotes ? (
        <details className="rounded-lg border" style={{ borderColor: BORDER, background: SURFACE_2 }}>
          <summary
            className="cursor-pointer p-3 text-[11.5px] uppercase tracking-[0.22em]"
            style={{ color: SUB, fontFamily: MONO }}
          >
            linter / review notes
          </summary>
          <pre
            className="px-4 py-3 text-[11px] leading-[1.55] whitespace-pre-wrap"
            style={{ color: SUB, fontFamily: MONO }}
          >
            {detail.reviewNotes}
          </pre>
        </details>
      ) : null}

      {/* Sticky action bar */}
      <div
        className="sticky bottom-4 rounded-xl border p-4 flex flex-col gap-3"
        style={{ borderColor: BORDER, background: SURFACE, boxShadow: "0 12px 36px -12px rgba(0,0,0,0.6)" }}
      >
        {actionError ? (
          <div
            className="rounded-md border px-3 py-2 text-[11.5px]"
            style={{ borderColor: PEACH, background: `${PEACH}10`, color: INK, fontFamily: MONO }}
          >
            {actionError}
          </div>
        ) : null}
        {showProgress ? (
          <RerunProgress
            step={effectiveStep}
            status={effectiveStatus}
            createdAt={latestJob?.createdAt ?? null}
            firecrawlDoneAt={latestJob?.firecrawlDoneAt ?? null}
            geminiExtractDoneAt={latestJob?.geminiExtractDoneAt ?? null}
            designMdDoneAt={latestJob?.designMdDoneAt ?? null}
            lintDoneAt={latestJob?.lintDoneAt ?? null}
          />
        ) : null}
        {isStuck ? (
          <div
            className="rounded-md border px-3 py-2 text-[11.5px]"
            style={{ borderColor: PEACH, background: `${PEACH}10`, color: INK, fontFamily: MONO }}
          >
            Job appears stuck — no update in over 12 min. You can re-run again to replace it.
          </div>
        ) : null}
        {showFailureBanner && latestJob ? (
          <div
            className="rounded-md border px-3 py-2.5 text-[12px]"
            style={{ borderColor: PEACH, background: `${PEACH}10`, color: INK, fontFamily: MONO }}
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className="text-[10.5px] uppercase tracking-[0.22em]"
                style={{ color: PEACH }}
              >
                last re-run failed
              </span>
              <span className="text-[10.5px]" style={{ color: SUB }}>
                {new Date(latestJob.updatedAt).toLocaleString()}
              </span>
            </div>
            <div className="mb-0.5">
              <span style={{ color: SUB }}>step:</span>{" "}
              <span style={{ color: INK }}>{latestJob.errorStep ?? "unknown"}</span>
            </div>
            {latestJob.errorMessage ? (
              <div className="truncate" style={{ color: SUB }} title={latestJob.errorMessage}>
                {latestJob.errorMessage}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => void props.onSave()}
                disabled={
                  !isDirty || busy || showProgress || form.companionPrompt.trim() === ""
                }
                title={
                  form.companionPrompt.trim() === ""
                    ? "Companion prompt can't be empty"
                    : !isDirty
                      ? "No changes to save"
                      : "Save your manual edits"
                }
                className="h-9 rounded-full px-4 text-[12.5px] font-medium inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: INK,
                  color: INK_ON_LIGHT,
                  boxShadow: `0 0 0 1px ${LIME}55, 0 10px 28px -12px ${LIME}66`,
                }}
              >
                {actionState === "saving" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" style={{ color: LIME }} />
                    Save
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => props.onCancelEdit()}
                disabled={busy}
                className="h-9 rounded-full px-4 text-[12.5px] inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: SURFACE_2, color: SUB, border: `1px solid ${BORDER}` }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => props.onEnterEdit()}
              disabled={busy || showProgress}
              title={
                showProgress
                  ? "A re-run is in flight — wait for it to finish before editing"
                  : "Manually edit title, URL, description, design.md, and companion prompt"
              }
              className="h-9 rounded-full px-4 text-[12.5px] inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: SURFACE_2, color: INK, border: `1px solid ${BORDER}` }}
            >
              <Pencil className="h-3.5 w-3.5" style={{ color: SUB }} />
              Edit
            </button>
          )}

          {!editing && (status === "personal" || status === "pending_review") ? (() => {
            // Pre-publish guards. Each blocks the click with a tooltip
            // explaining why, instead of letting the editor publish a
            // broken bundle that needs immediate revert.
            const missingDesignMd = !detail.designMd;
            const companionNotReady = detail.companionStatus !== "ready";
            const blocker = missingDesignMd
              ? "design.md isn't generated yet — re-run the pipeline first"
              : companionNotReady
                ? `Companion prompt is ${detail.companionStatus} — wait for it to finish (or re-run) before publishing`
                : isDirty
                  ? "Save your metadata edits first — Publish doesn't persist form changes"
                  : null;
            const disabled = busy || showProgress || blocker !== null;
            return (
              <button
                type="button"
                onClick={() => void props.onPublish()}
                disabled={disabled}
                title={
                  blocker ??
                  (status === "personal"
                    ? "Publish directly — overrides the lint gate that kept this out of the reviewer queue"
                    : "Approve and publish this bundle to the public library")
                }
                className="h-9 rounded-full px-4 text-[12.5px] font-medium inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: INK,
                  color: INK_ON_LIGHT,
                  boxShadow: `0 0 0 1px ${LIME}55, 0 10px 28px -12px ${LIME}66`,
                }}
              >
                {actionState === "publishing" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Publishing
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" style={{ color: LIME }} />
                    {status === "personal" ? "Publish" : "Approve & publish"}
                  </>
                )}
              </button>
            );
          })() : null}

          {!editing && detail.sourceUrl && !detail.sourceUrl.startsWith("upload://") ? (
            <button
              type="button"
              onClick={() => setShowRerunPanel((v) => !v)}
              disabled={busy || (showProgress && !isStuck)}
              title={
                isStuck
                  ? "Job is stuck — open the panel to replace it with a fresh re-run"
                  : showProgress
                    ? "A re-run is already in flight for this bundle"
                    : "Re-run the full extraction pipeline (scrape + brand + design.md + companion)"
              }
              className="h-9 rounded-full px-4 text-[12.5px] inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: SURFACE_2,
                color: INK,
                border: `1px solid ${isStuck ? PEACH : CYAN}66`,
              }}
            >
              {actionState === "rerunning-pipeline" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isStuck ? (
                <RotateCw className="h-3.5 w-3.5" style={{ color: PEACH }} />
              ) : showProgress ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCw className="h-3.5 w-3.5" style={{ color: CYAN }} />
              )}
              {isStuck ? "Re-run (replace stuck)" : showProgress ? "Re-run in progress…" : "Re-run pipeline"}
            </button>
          ) : null}

          {!editing ? (
            <button
              type="button"
              onClick={() => void props.onDelete()}
              disabled={busy}
              title="Permanently delete this bundle (use Archive to soft-delete)"
              className="h-9 rounded-full px-4 text-[12.5px] inline-flex items-center gap-2"
              style={{ background: SURFACE_2, color: INK, border: `1px solid #ff5a5a66` }}
            >
              {actionState === "deleting" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" style={{ color: "#ff7070" }} />
              )}
              Delete
            </button>
          ) : null}

          {!editing && status !== "archived" ? (
            <a
              href={`/library/${detail.slug}`}
              target="_blank"
              rel="noreferrer noopener"
              className="h-9 rounded-full px-4 text-[12.5px] inline-flex items-center gap-2 ml-auto"
              style={{ background: SURFACE_2, color: INK, border: `1px solid ${BORDER}` }}
            >
              Open in library
              <ExternalLink className="h-3.5 w-3.5" style={{ color: SUB }} />
            </a>
          ) : null}
        </div>

        {showRerunPanel && detail.sourceUrl && !detail.sourceUrl.startsWith("upload://") ? (
          <div
            className="rounded-lg border p-3 flex flex-col gap-2.5"
            style={{ borderColor: `${CYAN}55`, background: SURFACE_2 }}
          >
            <div className="flex items-center gap-2">
              <RotateCw className="h-3.5 w-3.5" style={{ color: CYAN }} />
              <span
                className="text-[10.5px] uppercase tracking-[0.22em]"
                style={{ color: CYAN, fontFamily: MONO }}
              >
                re-run pipeline
              </span>
            </div>
            <p className="text-[11.5px] leading-[1.55]" style={{ color: SUB }}>
              Editor metadata (title, description, license, attribution, featured, curated) is
              preserved. design.md, companion prompt, palette, accessibility notes, and coverage
              scores are overwritten with fresh extraction output.
            </p>
            <textarea
              value={rerunFeedback}
              onChange={(e) => setRerunFeedback(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="What was rendered incorrectly? e.g. 'The primary color is wrong — it should be the orange accent, not the off-white.' Leave blank for a standard re-run."
              className="w-full resize-y rounded-md border px-2.5 py-2 text-[12px] outline-none"
              style={{ color: INK, background: SURFACE, borderColor: BORDER, fontFamily: MONO }}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const ok = await props.onRerunPipeline(rerunFeedback);
                  if (ok) {
                    setShowRerunPanel(false);
                    setRerunFeedback("");
                  }
                }}
                title={
                  isStuck
                    ? "Replace the stuck job with a fresh re-run"
                    : "Start the re-run with this feedback (leave blank for a standard re-run)"
                }
                className="h-8 rounded-full px-3.5 text-[12px] font-medium inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: INK,
                  color: INK_ON_LIGHT,
                  boxShadow: `0 0 0 1px ${CYAN}55, 0 10px 28px -12px ${CYAN}66`,
                }}
              >
                {actionState === "rerunning-pipeline" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCw className="h-3.5 w-3.5" />
                )}
                {isStuck ? "Start re-run (replace stuck)" : "Start re-run"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setShowRerunPanel(false);
                  setRerunFeedback("");
                }}
                className="h-8 rounded-full px-3.5 text-[12px] inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: SURFACE_2, color: SUB, border: `1px solid ${BORDER}` }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] uppercase tracking-[0.22em]" style={{ color: MUTED, fontFamily: MONO }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[11.5px]" style={{ fontFamily: MONO }}>
      <span style={{ color: MUTED }}>{k}</span>
      <span className="truncate" style={{ color: INK }}>
        {v}
      </span>
    </div>
  );
}

function ChipMultiSelect({
  options,
  value,
  onChange,
  disabled,
}: {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (opt: string) => {
    if (disabled) return;
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            disabled={disabled}
            className="text-[10.5px] rounded-full px-2 py-1 disabled:opacity-50"
            style={{
              fontFamily: MONO,
              background: active ? `${VIOLET}1A` : "transparent",
              border: `1px solid ${active ? `${VIOLET}66` : BORDER}`,
              color: active ? INK : SUB,
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="inline-flex items-center gap-2 text-[12px] disabled:opacity-50"
      style={{ color: INK, fontFamily: MONO }}
      aria-pressed={checked}
    >
      <span
        className="inline-flex h-4 w-7 items-center rounded-full transition-colors"
        style={{
          background: checked ? LIME : BORDER,
          padding: 1,
        }}
      >
        <span
          className="inline-block h-3 w-3 rounded-full transition-transform"
          style={{
            background: checked ? INK_ON_LIGHT : SUB,
            transform: checked ? "translateX(12px)" : "translateX(0)",
          }}
        />
      </span>
      {label}
    </button>
  );
}
