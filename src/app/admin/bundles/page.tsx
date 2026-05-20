"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowUpRight,
  Check,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCw,
  Save,
  Search,
  ShieldCheck,
  Star,
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
  | "regenerating-companion";

const DESIGN_STYLES = [
  "dark-mode",
  "minimal",
  "bold",
  "playful",
  "enterprise",
  "accessible",
];
const TOOLS = ["claude", "cursor", "lovable", "figma-make"];

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
      setRows((prev) => [...prev, ...body.items]);
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

  const loadDetail = useCallback(async (slug: string) => {
    setDetailLoading(true);
    setDetail(null);
    setForm(null);
    setActionError(null);
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

  // Dirty state — true when form differs from the loaded detail.
  const isDirty = useMemo(() => {
    if (!detail || !form) return false;
    return (
      form.title !== detail.title ||
      form.description !== detail.description ||
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
      setForm({
        title: respBody.data.title,
        description: respBody.data.description,
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
        <div className="flex items-center gap-2">
          <a
            href="/admin/queue"
            className="h-9 rounded-full border px-3 text-[12px] inline-flex items-center gap-2"
            style={{ borderColor: BORDER, color: SUB, fontFamily: MONO }}
          >
            reviewer queue
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={() => void loadList()}
            className="h-9 rounded-full border px-3 text-[12px] inline-flex items-center gap-2"
            style={{ borderColor: BORDER, color: SUB, fontFamily: MONO }}
          >
            <RefreshCw className="h-3.5 w-3.5" /> refresh
          </button>
        </div>
      </div>

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
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedSlug(row.slug)}
                        className="w-full text-left rounded-lg px-3 py-2.5 transition-colors"
                        style={{
                          background: isActive ? SURFACE_2 : "transparent",
                          border: `1px solid ${isActive ? BORDER : "transparent"}`,
                        }}
                      >
                        <div className="flex items-center gap-2">
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
                          <span className="text-[10px] truncate" style={{ color: MUTED, fontFamily: MONO }}>
                            {row.sourceDomain ?? "—"}
                          </span>
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
              categories={categories}
              isDirty={isDirty}
              actionState={actionState}
              actionError={actionError}
              onSave={onSave}
              onArchive={onArchive}
              onRestore={onRestore}
              onPublish={onPublish}
              onRegenerateCompanion={onRegenerateCompanion}
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
  categories: Category[];
  isDirty: boolean;
  actionState: ActionState;
  actionError: string | null;
  onSave: () => void | Promise<void>;
  onArchive: () => void | Promise<void>;
  onRestore: (target: "published" | "pending_review") => void | Promise<void>;
  onPublish: () => void | Promise<void>;
  onRegenerateCompanion: () => void | Promise<void>;
}

function DetailEditor(props: DetailEditorProps) {
  const { detail, form, setForm, categories, isDirty, actionState, actionError } = props;
  const status = detail.status as BundleStatus;
  const busy = actionState !== "idle";

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
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            disabled={busy}
            maxLength={200}
            className="mt-3 text-[24px] font-medium tracking-[-0.014em] bg-transparent w-full outline-none"
            style={{ color: INK }}
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            disabled={busy}
            maxLength={2000}
            rows={2}
            className="mt-2 text-[13px] leading-[1.55] bg-transparent w-full outline-none border-b focus:border-b"
            style={{ color: SUB, borderColor: BORDER_SOFT }}
          />
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
        </div>
        {detail.coverageScore !== null ? (
          <div
            className="rounded-lg border px-3 py-2 text-center"
            style={{ borderColor: BORDER, background: SURFACE_2 }}
          >
            <div className="text-[9.5px] uppercase tracking-[0.22em]" style={{ color: MUTED, fontFamily: MONO }}>
              coverage
            </div>
            <div
              className="mt-1 text-[18px] font-medium"
              style={{
                color: detail.coverageScore >= 70 ? LIME : detail.coverageScore >= 40 ? PEACH : MUTED,
                fontFamily: MONO,
              }}
            >
              {detail.coverageScore}
              <span className="text-[11px]" style={{ color: MUTED }}>
                {" "}
                / 100
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Editable metadata grid */}
      <div
        className="rounded-lg border p-4 grid grid-cols-1 md:grid-cols-2 gap-4"
        style={{ borderColor: BORDER, background: SURFACE }}
      >
        <FieldGroup label="category">
          <select
            value={form.primaryCategoryId ?? ""}
            onChange={(e) => setForm({ ...form, primaryCategoryId: e.target.value || null })}
            disabled={busy}
            className="h-9 rounded-md border bg-transparent text-[12.5px] px-2 w-full"
            style={{ borderColor: BORDER, color: INK, fontFamily: MONO }}
          >
            <option value="">(none)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FieldGroup>
        <FieldGroup label="license">
          <input
            type="text"
            value={form.license}
            onChange={(e) => setForm({ ...form, license: e.target.value })}
            disabled={busy}
            maxLength={100}
            placeholder="MIT, review-required, etc."
            className="h-9 rounded-md border bg-transparent text-[12.5px] px-2 w-full"
            style={{ borderColor: BORDER, color: INK, fontFamily: MONO }}
          />
        </FieldGroup>
        <FieldGroup label="design style">
          <ChipMultiSelect
            options={DESIGN_STYLES}
            value={form.designStyle}
            onChange={(next) => setForm({ ...form, designStyle: next })}
            disabled={busy}
          />
        </FieldGroup>
        <FieldGroup label="compatible tools">
          <ChipMultiSelect
            options={TOOLS}
            value={form.compatibleTools}
            onChange={(next) => setForm({ ...form, compatibleTools: next })}
            disabled={busy}
          />
        </FieldGroup>
        <FieldGroup label="attribution statement (optional)">
          <textarea
            value={form.attributionStatement}
            onChange={(e) => setForm({ ...form, attributionStatement: e.target.value })}
            disabled={busy}
            maxLength={2000}
            rows={2}
            placeholder="© Brand 2024 · used with permission"
            className="rounded-md border bg-transparent text-[12.5px] p-2 w-full"
            style={{ borderColor: BORDER, color: INK, fontFamily: MONO }}
          />
        </FieldGroup>
        <FieldGroup label="flags">
          <div className="flex items-center gap-4">
            <ToggleRow
              checked={form.isFeatured}
              onChange={(v) => setForm({ ...form, isFeatured: v })}
              label="featured"
              disabled={busy}
            />
            <ToggleRow
              checked={form.isCurated}
              onChange={(v) => setForm({ ...form, isCurated: v })}
              label="curated"
              disabled={busy}
            />
          </div>
        </FieldGroup>
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

      {/* Read-only design.md / companion + lint notes */}
      <details className="rounded-lg border" style={{ borderColor: BORDER, background: SURFACE }}>
        <summary
          className="cursor-pointer p-3 text-[11.5px] uppercase tracking-[0.22em]"
          style={{ color: SUB, fontFamily: MONO }}
        >
          design.md (read-only)
        </summary>
        <pre
          className="px-4 py-3 text-[11px] leading-[1.55] whitespace-pre-wrap overflow-x-auto max-h-[360px] border-t"
          style={{ color: INK, fontFamily: MONO, borderColor: BORDER_SOFT }}
        >
          {detail.designMd ?? "(empty)"}
        </pre>
      </details>
      <details className="rounded-lg border" style={{ borderColor: BORDER, background: SURFACE }}>
        <summary
          className="cursor-pointer p-3 text-[11.5px] uppercase tracking-[0.22em]"
          style={{ color: SUB, fontFamily: MONO }}
        >
          companion prompt (read-only) · {detail.companionStatus}
        </summary>
        <pre
          className="px-4 py-3 text-[11px] leading-[1.55] whitespace-pre-wrap overflow-x-auto max-h-[360px] border-t"
          style={{ color: INK, fontFamily: MONO, borderColor: BORDER_SOFT }}
        >
          {detail.companionPrompt || "(empty)"}
        </pre>
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void props.onSave()}
            disabled={busy || !isDirty}
            className="h-9 rounded-full px-4 text-[12.5px] font-medium inline-flex items-center gap-2 disabled:opacity-40"
            style={{
              background: INK,
              color: INK_ON_LIGHT,
              boxShadow: isDirty ? `0 0 0 1px ${VIOLET}55, 0 10px 28px -12px ${VIOLET}66` : "none",
            }}
          >
            {actionState === "saving" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save edits
            {isDirty ? (
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: PEACH }} aria-label="unsaved changes" />
            ) : null}
          </button>

          {status === "personal" ? (
            <button
              type="button"
              onClick={() => void props.onPublish()}
              disabled={busy}
              className="h-9 rounded-full px-4 text-[12.5px] inline-flex items-center gap-2"
              style={{
                background: SURFACE_2,
                color: INK,
                border: `1px solid ${LIME}66`,
              }}
            >
              {actionState === "publishing" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" style={{ color: LIME }} />
              )}
              Publish
            </button>
          ) : null}

          {detail.designMd && detail.companionStatus !== "ready" ? (
            <button
              type="button"
              onClick={() => void props.onRegenerateCompanion()}
              disabled={busy}
              title={`Re-run companion prompt worker (current status: ${detail.companionStatus})`}
              className="h-9 rounded-full px-4 text-[12.5px] inline-flex items-center gap-2"
              style={{ background: SURFACE_2, color: INK, border: `1px solid ${CYAN}66` }}
            >
              {actionState === "regenerating-companion" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" style={{ color: CYAN }} />
              )}
              Re-run companion
            </button>
          ) : null}

          {(status === "archived" || status === "rejected") ? (
            <>
              <button
                type="button"
                onClick={() => void props.onRestore("published")}
                disabled={busy}
                className="h-9 rounded-full px-4 text-[12.5px] inline-flex items-center gap-2"
                style={{ background: SURFACE_2, color: INK, border: `1px solid ${LIME}66` }}
              >
                {actionState === "restoring" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCw className="h-3.5 w-3.5" style={{ color: LIME }} />
                )}
                Restore (publish)
              </button>
              <button
                type="button"
                onClick={() => void props.onRestore("pending_review")}
                disabled={busy}
                className="h-9 rounded-full px-4 text-[12.5px] inline-flex items-center gap-2"
                style={{ background: SURFACE_2, color: INK, border: `1px solid ${VIOLET}66` }}
              >
                <RotateCw className="h-3.5 w-3.5" style={{ color: VIOLET }} />
                Restore to queue
              </button>
            </>
          ) : null}

          {status !== "archived" ? (
            <button
              type="button"
              onClick={() => void props.onArchive()}
              disabled={busy}
              className="h-9 rounded-full px-4 text-[12.5px] inline-flex items-center gap-2"
              style={{ background: SURFACE_2, color: INK, border: `1px solid ${PEACH}66` }}
            >
              {actionState === "archiving" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Archive className="h-3.5 w-3.5" style={{ color: PEACH }} />
              )}
              Archive
            </button>
          ) : null}

          {status === "published" ? (
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
