import { MONO } from "@/lib/ui-data/tokens";
import { statusColor, statusLabel } from "./constants";
import type { BundleStatus } from "./types";

export function StatusPill({ status }: { status: BundleStatus }) {
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
