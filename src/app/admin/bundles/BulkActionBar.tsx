import { Check, Loader2, RotateCw, Trash2, X } from "lucide-react";
import {
  BORDER,
  CYAN,
  INK,
  INK_ON_LIGHT,
  LIME,
  MONO,
  MUTED,
  PEACH,
  SUB,
  SURFACE_2,
  VIOLET,
} from "@/lib/ui-data/tokens";

export interface BulkActionBarProps {
  selectedCount: number;
  bulkDeleteState: "idle" | "deleting";
  bulkRejectState: "idle" | "rejecting";
  showBulkRejectPanel: boolean;
  bulkRejectReason: string;
  bulkRerunSince: string | null;
  bulkRerunCounts: {
    queued: number;
    running: number;
    completed: number;
    failed: number;
  } | null;
  bulkRerunFailures: Array<{
    jobId: string;
    slug: string | null;
    errorStep: string | null;
    errorMessage: string | null;
    updatedAt: string;
  }>;
  bulkRerunActive: boolean;
  onClearSelection: () => void;
  onBulkRerunSelected: () => void;
  onBulkDeleteSelected: () => void;
  onToggleBulkRejectPanel: () => void;
  onBulkRejectReasonChange: (value: string) => void;
  onBulkRejectSelected: () => void;
  onDismissBulkRerunStatus: () => void;
}

export function BulkActionBar({
  selectedCount,
  bulkDeleteState,
  bulkRejectState,
  showBulkRejectPanel,
  bulkRejectReason,
  bulkRerunSince,
  bulkRerunCounts,
  bulkRerunFailures,
  bulkRerunActive,
  onClearSelection,
  onBulkRerunSelected,
  onBulkDeleteSelected,
  onToggleBulkRejectPanel,
  onBulkRejectReasonChange,
  onBulkRejectSelected,
  onDismissBulkRerunStatus,
}: BulkActionBarProps) {
  const busy = bulkDeleteState === "deleting" || bulkRejectState === "rejecting";

  return (
    <>
      {/* Selection toolbar — visible when one or more rows are checked */}
      {selectedCount > 0 && (
        <div
          className="mb-5 rounded-xl border px-4 py-2.5 flex items-center gap-3 flex-wrap"
          style={{ borderColor: `${CYAN}66`, background: `${CYAN}0D` }}
        >
          <span
            className="text-[12px] flex items-center gap-1.5"
            style={{ color: CYAN, fontFamily: MONO }}
          >
            <span className="font-medium">{selectedCount}</span> selected
          </span>
          <button
            type="button"
            onClick={onClearSelection}
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
              disabled={bulkRerunActive || busy}
              className="h-8 rounded-full border px-3 text-[12px] inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: `${VIOLET}66`, color: VIOLET, fontFamily: MONO }}
            >
              <RotateCw className="h-3 w-3" />
              Re-run selected
            </button>
            <button
              type="button"
              onClick={onToggleBulkRejectPanel}
              disabled={bulkRejectState === "rejecting" || bulkDeleteState === "deleting" || bulkRerunActive}
              className="h-8 rounded-full border px-3 text-[12px] inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: `${PEACH}66`, color: PEACH, fontFamily: MONO }}
            >
              {bulkRejectState === "rejecting" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
              Reject selected
            </button>
            <button
              type="button"
              onClick={() => void onBulkDeleteSelected()}
              disabled={bulkDeleteState === "deleting" || bulkRerunActive || bulkRejectState === "rejecting"}
              className="h-8 rounded-full border px-3 text-[12px] inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: "#ff5a5a66", color: "#ff7070", fontFamily: MONO }}
            >
              {bulkDeleteState === "deleting" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
              Delete selected
            </button>
          </div>
        </div>
      )}

      {/* Bulk reject reason panel — visible when "Reject selected" is toggled */}
      {showBulkRejectPanel && selectedCount > 0 && (
        <div
          className="mb-5 rounded-xl border p-4 flex flex-col gap-2.5"
          style={{ borderColor: `${PEACH}55`, background: SURFACE_2 }}
        >
          <div className="flex items-center gap-2">
            <X className="h-3.5 w-3.5" style={{ color: PEACH }} />
            <span
              className="text-[10.5px] uppercase tracking-[0.22em]"
              style={{ color: PEACH, fontFamily: MONO }}
            >
              reject {selectedCount} selected bundle{selectedCount !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-[11.5px] leading-[1.55]" style={{ color: SUB }}>
            Each bundle leaves the public library and search but stays in the creator&apos;s
            account. Give a reason the creators can act on.
          </p>
          <textarea
            value={bulkRejectReason}
            onChange={(e) => onBulkRejectReasonChange(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="e.g. The palette doesn't match the source site — re-run with the correct brand colors."
            className="w-full resize-y rounded-md border px-2.5 py-2 text-[12px] outline-none"
            style={{ color: INK, background: SURFACE_2, borderColor: BORDER, fontFamily: MONO }}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={bulkRejectState === "rejecting" || bulkRejectReason.trim() === ""}
              onClick={() => void onBulkRejectSelected()}
              className="h-8 rounded-full px-3.5 text-[12px] font-medium inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: INK,
                color: INK_ON_LIGHT,
                boxShadow: `0 0 0 1px ${PEACH}55, 0 10px 28px -12px ${PEACH}66`,
              }}
            >
              {bulkRejectState === "rejecting" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              Confirm rejection
            </button>
            <button
              type="button"
              disabled={bulkRejectState === "rejecting"}
              onClick={onToggleBulkRejectPanel}
              className="h-8 rounded-full px-3.5 text-[12px] inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: SURFACE_2, color: SUB, border: `1px solid ${BORDER}` }}
            >
              Cancel
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
                onClick={onDismissBulkRerunStatus}
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
                    {f.errorStep && <span style={{ color: MUTED }}> · {f.errorStep}</span>}
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
    </>
  );
}
