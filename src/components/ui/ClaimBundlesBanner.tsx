"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { BORDER, INK, LIME, MONO, MUTED, SURFACE, SUB } from "@/lib/ui-data/tokens";
import { useAuth } from "@/lib/ui-data/mockAuth";

interface ClaimableBundle {
  id: string;
  slug: string;
  title: string;
  brandLogoUrl: string | null;
}

const DISMISSED_KEY = "uiuxskills.claimBannerDismissed";

export function ClaimBundlesBanner() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [bundles, setBundles] = useState<ClaimableBundle[] | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Hide on welcome page — it has its own focus flow.
  const isWelcome = pathname?.startsWith("/welcome");

  useEffect(() => {
    if (!user || isWelcome) return;
    if (typeof window !== "undefined" && sessionStorage.getItem(DISMISSED_KEY)) return;

    (async () => {
      try {
        const res = await fetch("/api/me/claim-bundles");
        if (!res.ok) return;
        const json = (await res.json()) as { data: ClaimableBundle[] };
        if (json.data.length > 0) setBundles(json.data);
      } catch {
        // non-critical — fail silently
      }
    })();
  }, [user, isWelcome]);

  async function handleClaim() {
    if (claiming) return;
    setClaiming(true);
    try {
      await fetch("/api/me/claim-bundles", { method: "POST" });
      setClaimed(true);
      // Small delay so the success state is readable before dismissing.
      setTimeout(() => setBundles(null), 2000);
    } catch {
      setClaiming(false);
    }
  }

  function handleDismiss() {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    }
    setDismissed(true);
  }

  if (!user || isWelcome || dismissed || !bundles || bundles.length === 0) return null;

  const count = bundles.length;

  return (
    <div
      className="w-full border-b text-[12.5px]"
      style={{ background: SURFACE, borderColor: BORDER, color: SUB, fontFamily: MONO }}
    >
      <div className="mx-auto flex h-10 max-w-6xl items-center justify-between gap-4 px-6 lg:px-8">
        <span>
          {claimed ? (
            <span style={{ color: LIME }}>
              {count} bundle{count > 1 ? "s" : ""} claimed — now in Your bundles.
            </span>
          ) : (
            <>
              You generated{" "}
              <span style={{ color: INK }}>
                {count} bundle{count > 1 ? "s" : ""}
              </span>{" "}
              before signing in.{" "}
              <button
                onClick={handleClaim}
                disabled={claiming}
                className="underline underline-offset-2 disabled:opacity-50"
                style={{ color: LIME }}
              >
                {claiming ? "Claiming…" : "Claim them →"}
              </button>
            </>
          )}
        </span>
        {!claimed && (
          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            style={{ color: MUTED }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
