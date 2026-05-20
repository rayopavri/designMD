"use client";

import { useEffect, useState } from "react";
import { BORDER, INK, LIME, MONO, MUTED, SUB, SURFACE } from "@/lib/ui-data/tokens";

const KEY = "uiuxskills:pulse";
const REASONS = ["Colors", "Typography", "Spacing", "Components", "Generic"] as const;
type Reason = (typeof REASONS)[number];

type PulseRecord = { bundleId: string; ts: number; result: "yes" | "no"; reason?: Reason };
type Store = Record<string, PulseRecord>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(s: Store) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

export function PulseRow({ bundleId }: { bundleId: string }) {
  const [record, setRecord] = useState<PulseRecord | null>(null);
  const [askingReason, setAskingReason] = useState(false);

  useEffect(() => {
    setRecord(readStore()[bundleId] ?? null);
  }, [bundleId]);

  function record_(result: "yes" | "no", reason?: Reason) {
    const next: PulseRecord = { bundleId, ts: Date.now(), result, reason };
    const store = readStore();
    store[bundleId] = next;
    writeStore(store);
    setRecord(next);
    setAskingReason(false);
  }

  if (record) {
    return (
      <div
        className="mt-4 rounded-xl border p-4 flex items-center gap-3"
        style={{ borderColor: BORDER, background: SURFACE }}
      >
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px]"
          style={{ background: `${LIME}1F`, color: LIME }}
        >
          ✓
        </span>
        <span className="text-[13px]" style={{ color: INK }}>
          Thanks ✓
        </span>
        <span
          className="text-[11px] ml-auto"
          style={{ fontFamily: MONO, color: MUTED }}
        >
          {record.result === "yes" ? "worked" : record.reason ?? "didn't quite"}
        </span>
      </div>
    );
  }

  if (askingReason) {
    return (
      <div
        className="mt-4 rounded-xl border p-4"
        style={{ borderColor: BORDER, background: SURFACE }}
      >
        <div
          className="text-[10.5px] uppercase tracking-[0.22em] mb-3"
          style={{ fontFamily: MONO, color: MUTED }}
        >
          what was off?
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {REASONS.map((r) => (
            <button
              key={r}
              onClick={() => record_("no", r)}
              className="h-7 px-3 rounded-full border text-[11.5px]"
              style={{ borderColor: BORDER, background: SURFACE, color: SUB }}
            >
              {r}
            </button>
          ))}
          <button
            onClick={() => setAskingReason(false)}
            className="text-[11px] ml-2"
            style={{ color: MUTED, fontFamily: MONO }}
          >
            cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mt-4 rounded-xl border p-4 flex items-center gap-3 flex-wrap"
      style={{ borderColor: BORDER, background: SURFACE }}
    >
      <span className="text-[13px]" style={{ color: INK }}>
        Did this work for you?
      </span>
      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={() => record_("yes")}
          className="h-7 px-3 rounded-full border text-[11.5px]"
          style={{ borderColor: `${LIME}88`, background: `${LIME}1A`, color: INK }}
        >
          Yes
        </button>
        <button
          onClick={() => setAskingReason(true)}
          className="h-7 px-3 rounded-full border text-[11.5px]"
          style={{ borderColor: BORDER, background: SURFACE, color: SUB }}
        >
          Not quite
        </button>
      </div>
    </div>
  );
}
