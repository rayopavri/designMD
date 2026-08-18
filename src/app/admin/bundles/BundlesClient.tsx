"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { SectionLabel } from "@/components/ui/Shell";
import {
  BG,
  BORDER,
  INK,
  INK_ON_LIGHT,
  MONO,
  MUTED,
  PEACH,
  SUB,
} from "@/lib/ui-data/tokens";
import { ALL_STATUSES, BULK_RERUN_LS_KEY } from "./constants";
import { BundleDetailPanel } from "./BundleDetailPanel";
import { BundleEditForm } from "./BundleEditForm";
import { BundleList } from "./BundleList";
import { BulkActionBar } from "./BulkActionBar";
import type {
  ActionState,
  BundleStatus,
  Category,
  DetailRow,
  EditFormState,
  LatestJob,
  ListRow,
  LoadState,
} from "./types";

export default function AdminBundlesPage({ modelLabel }: { modelLabel: string }) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [rows, setRows] = useState<ListRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<BundleStatus[]>(ALL_STATUSES);
  const [searchInput, setSearchInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [sort, setSort] = useState<"recent" | "top" | "trending" | "alpha">("recent");

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
  const [bulkDeleteState, setBulkDeleteState] = useState<"idle" | "deleting">("idle");
  const [bulkRejectState, setBulkRejectState] = useState<"idle" | "rejecting">("idle");
  const [showBulkRejectPanel, setShowBulkRejectPanel] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("");

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
  const [bulkRerunFailures, setBulkRerunFailures] = useState<
    Array<{
      jobId: string;
      slug: string | null;
      errorStep: string | null;
      errorMessage: string | null;
      updatedAt: string;
    }>
  >([]);

  // Live progress for the Re-run pipeline button. `rerunStep` is the raw
  // `currentStep` polled from /api/generate/[jobId]; `rerunStatus` mirrors
  // job.status so we know when to stop the polling loops.
  const [rerunStep, setRerunStep] = useState<string | null>(null);
  const [rerunStatus, setRerunStatus] = useState<
    "queued" | "running" | "completed" | "failed" | null
  >(null);

  // Server-truth latest job for the selected bundle.
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
      sp.set("limit", "60");
      if (cursor) sp.set("cursor", cursor);
      return `/api/admin/bundles?${sp.toString()}`;
    },
    [statusFilter, activeQuery, categoryFilter, sort]
  );

  const loadList = useCallback(async () => {
    setLoadState("loading");
    setErrorMsg(null);
    try {
      const all: ListRow[] = [];
      let cursor: string | null = null;
      do {
        const res = await fetch(buildListUrl(cursor));
        if (res.status === 401 || res.status === 403) {
          setLoadState("forbidden");
          return;
        }
        if (!res.ok) {
          setErrorMsg(`Failed to load (${res.status})`);
          setLoadState("error");
          return;
        }
        const body = (await res.json()) as {
          items: ListRow[];
          nextCursor: string | null;
        };
        const seen = new Set(all.map((r) => r.id));
        all.push(...body.items.filter((r) => !seen.has(r.id)));
        cursor = body.nextCursor;
      } while (cursor);
      setRows(all);
      setLoadState("ready");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
      setLoadState("error");
    }
  }, [buildListUrl]);

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
          `/api/admin/bundles/bulk-rerun/status?since=${encodeURIComponent(bulkRerunSince)}`
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
        const res = await fetch("/api/admin/bundles/active-jobs");
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
        brandLogoUrl: body.data.brandLogoUrl ?? "",
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
  // stuck (no updatedAt change) for more than 4 minutes — workers cap at 60s on
  // Hobby and the supervisor reaps stalled rows at 3 min, so older = dead.
  // loadDetail is NOT called here — see the completion effect below.
  useEffect(() => {
    if (!selectedSlug) return;
    if (!latestJob) return;
    if (latestJob.status !== "queued" && latestJob.status !== "running") return;
    if (latestJob.status === "running") {
      const ageMs = Date.now() - new Date(latestJob.updatedAt).getTime();
      if (ageMs > 4 * 60 * 1000) return;
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
      form.brandLogoUrl !== (detail.brandLogoUrl ?? "") ||
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
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const onSearchSubmit = () => {
    setActiveQuery(searchInput);
  };

  const onClearSearch = () => {
    setSearchInput("");
    setActiveQuery("");
  };

  const onSave = async () => {
    if (!detail || !form) return;
    setActionState("saving");
    setActionError(null);
    try {
      // Send only fields that actually changed (mirrors `isDirty`). This keeps
      // a title-only edit from re-validating untouched fields — e.g. a bundle
      // with no license would otherwise fail the `license` min(1) check — and
      // avoids needless side-effects: sourceUrl recomputes the dedup key,
      // designMd triggers a re-lint, and companionPrompt bumps its version.
      const body: Record<string, unknown> = {};
      if (form.title !== detail.title) body.title = form.title;
      if (form.description !== detail.description) body.description = form.description;
      if (form.sourceUrl !== (detail.sourceUrl ?? "")) body.sourceUrl = form.sourceUrl;
      // Send null (not "") when cleared so the PATCH .url() check isn't tripped.
      if (form.brandLogoUrl !== (detail.brandLogoUrl ?? ""))
        body.brandLogoUrl = form.brandLogoUrl.trim() || null;
      if (form.designMd !== (detail.designMd ?? "")) body.designMd = form.designMd;
      if (form.companionPrompt !== (detail.companionPrompt ?? ""))
        body.companionPrompt = form.companionPrompt;
      // Metadata fields below have no dedicated input yet, so they won't change
      // through this UI — but keep them diff-guarded for the scaffolded editor.
      if (form.license !== (detail.license ?? "") && form.license.trim())
        body.license = form.license;
      if (form.attributionStatement !== (detail.attributionStatement ?? ""))
        body.attributionStatement = form.attributionStatement.trim() || null;
      if (form.designStyle.join("|") !== (detail.designStyle ?? []).join("|"))
        body.designStyle = form.designStyle;
      if (form.compatibleTools.join("|") !== (detail.compatibleTools ?? []).join("|"))
        body.compatibleTools = form.compatibleTools;
      if (form.primaryCategoryId !== detail.primaryCategoryId)
        body.primaryCategoryId = form.primaryCategoryId;
      if (form.isFeatured !== detail.isFeatured) body.isFeatured = form.isFeatured;
      if (form.isCurated !== detail.isCurated) body.isCurated = form.isCurated;
      const res = await fetch(`/api/admin/bundles/${encodeURIComponent(detail.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const respBody = await res.json().catch(() => ({ error: res.statusText }));
        const detailMsg = respBody.details ? `: ${respBody.details}` : "";
        setActionError((respBody.error || `Save failed (${res.status})`) + detailMsg);
        return;
      }
      const respBody = (await res.json()) as { data: DetailRow };
      setDetail(respBody.data);
      setEditing(false);
      setForm({
        title: respBody.data.title,
        description: respBody.data.description,
        sourceUrl: respBody.data.sourceUrl ?? "",
        brandLogoUrl: respBody.data.brandLogoUrl ?? "",
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
            : r
        )
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
        brandLogoUrl: detail.brandLogoUrl ?? "",
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
        "Use Archive if you only want to hide it from /library."
    );
    if (!ok) return;
    const typed = window.prompt(
      `Type the slug "${detail.slug}" to confirm permanent deletion:`
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
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
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
        }
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
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
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

  // Reject a submission: moves it to `rejected` (out of the public library &
  // search, but still visible to the creator in /account/bundles). The reject
  // endpoint requires a reason, collected via the inline panel in DetailEditor.
  // Returns true on success so the panel can close and clear its input.
  const onReject = async (reason: string): Promise<boolean> => {
    if (!detail) return false;
    setActionState("rejecting");
    setActionError(null);
    try {
      const res = await fetch(
        `/api/admin/bundles/${encodeURIComponent(detail.slug)}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewNotes: reason }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        setActionError(body.error || `Reject failed (${res.status})`);
        return false;
      }
      await loadDetail(detail.slug);
      await loadList();
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
      return false;
    } finally {
      setActionState("idle");
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
        }
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
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });

  const toggleAll = () =>
    setSelectedSlugs((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.slug))
    );

  const onBulkRerunSelected = async () => {
    const slugsArr = Array.from(selectedSlugs);
    if (!window.confirm(`Re-run the pipeline for ${slugsArr.length} bundle(s)?`)) return;
    setBulkRerunEnqueuing(true);
    setBulkRerunCounts(null);
    try {
      const res = await fetch("/api/admin/bundles/bulk-rerun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: slugsArr }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        enqueued?: number;
        error?: string;
      };
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
      alert(err instanceof Error ? err.message : "Network error");
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
      .join("\n");
    const extra = matchedRows.length > 5 ? `\n+ ${matchedRows.length - 5} more` : "";
    if (
      !window.confirm(
        `Permanently delete ${slugsArr.length} bundle(s)?\n\n${preview}${extra}`
      )
    )
      return;
    setBulkDeleteState("deleting");
    try {
      const res = await fetch("/api/admin/bundles/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      const deletedSet = new Set(slugsArr.filter((s) => !(body.notFound ?? []).includes(s)));
      setRows((prev) => prev.filter((r) => !deletedSet.has(r.slug)));
      if (selectedSlug && deletedSet.has(selectedSlug)) {
        setSelectedSlug(null);
        setDetail(null);
        setForm(null);
      }
      setSelectedSlugs(new Set());
    } catch (err) {
      alert(err instanceof Error ? err.message : "Network error");
    } finally {
      setBulkDeleteState("idle");
    }
  };

  const onBulkRejectSelected = async () => {
    if (!bulkRejectReason.trim()) return;
    const slugsArr = Array.from(selectedSlugs);
    if (!window.confirm(`Reject ${slugsArr.length} bundle(s)?`)) return;
    setBulkRejectState("rejecting");
    try {
      const res = await fetch("/api/admin/bundles/bulk-reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: slugsArr, reviewNotes: bulkRejectReason.trim() }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        rejected?: number;
        skipped?: number;
        notFound?: string[];
        error?: string;
      };
      if (!res.ok) {
        alert(body.error || `Reject failed (${res.status})`);
        return;
      }
      setShowBulkRejectPanel(false);
      setBulkRejectReason("");
      const rejectedSet = new Set(slugsArr.filter((s) => !(body.notFound ?? []).includes(s)));
      if (selectedSlug && rejectedSet.has(selectedSlug)) {
        await loadDetail(selectedSlug);
      }
      setSelectedSlugs(new Set());
      await loadList();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Network error");
    } finally {
      setBulkRejectState("idle");
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
          </h1>
          <p className="mt-2 text-[12.5px]" style={{ color: SUB }}>
            All bundles across every status. Edit metadata, archive, restore, or jump to the reviewer queue for pending items.
          </p>
        </div>
      </div>

      <BulkActionBar
        selectedCount={selectedSlugs.size}
        bulkDeleteState={bulkDeleteState}
        bulkRejectState={bulkRejectState}
        showBulkRejectPanel={showBulkRejectPanel}
        bulkRejectReason={bulkRejectReason}
        bulkRerunSince={bulkRerunSince}
        bulkRerunCounts={bulkRerunCounts}
        bulkRerunFailures={bulkRerunFailures}
        bulkRerunActive={bulkRerunActive}
        onClearSelection={() => {
          setSelectedSlugs(new Set());
          setShowBulkRejectPanel(false);
          setBulkRejectReason("");
        }}
        onBulkRerunSelected={onBulkRerunSelected}
        onBulkDeleteSelected={onBulkDeleteSelected}
        onToggleBulkRejectPanel={() => setShowBulkRejectPanel((v) => !v)}
        onBulkRejectReasonChange={setBulkRejectReason}
        onBulkRejectSelected={onBulkRejectSelected}
        onDismissBulkRerunStatus={() => {
          setBulkRerunCounts(null);
          setBulkRerunFailures([]);
        }}
      />

      <div
        className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-px rounded-xl overflow-hidden"
        style={{ background: BORDER }}
      >
        {/* List + filters pane */}
        <BundleList
          rows={rows}
          categories={categories}
          selectedSlug={selectedSlug}
          selectedSlugs={selectedSlugs}
          activeJobSlugs={activeJobSlugs}
          statusFilter={statusFilter}
          searchInput={searchInput}
          categoryFilter={categoryFilter}
          sort={sort}
          selectAllRef={selectAllRef}
          onToggleStatus={onToggleStatus}
          onSearchInputChange={setSearchInput}
          onSearchSubmit={onSearchSubmit}
          onClearSearch={onClearSearch}
          onCategoryFilterChange={setCategoryFilter}
          onSortChange={setSort}
          onSelectSlug={setSelectedSlug}
          onToggleSlug={toggleSlug}
          onToggleAll={toggleAll}
        />

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
          ) : editing ? (
            <BundleEditForm
              detail={detail}
              form={form}
              categories={categories}
              isDirty={isDirty}
              actionState={actionState}
              actionError={actionError}
              onFormChange={setForm}
              onSave={onSave}
              onCancelEdit={onCancelEdit}
              onScreenshotUpdate={(url) =>
                setDetail((prev) => (prev ? { ...prev, previewImageUrl: url } : prev))
              }
              onCategoryCreated={(cat) =>
                setCategories((prev) =>
                  [...prev, cat].sort((a, b) => a.name.localeCompare(b.name))
                )
              }
            />
          ) : (
            <BundleDetailPanel
              modelLabel={modelLabel}
              detail={detail}
              actionState={actionState}
              actionError={actionError}
              rerunStep={rerunStep}
              rerunStatus={rerunStatus}
              latestJob={latestJob}
              onEnterEdit={() => setEditing(true)}
              onPublish={onPublish}
              onReject={onReject}
              onRestore={onRestore}
              onRerunPipeline={onRerunPipeline}
              onDelete={onDelete}
            />
          )}
        </div>
      </div>
    </div>
  );
}
