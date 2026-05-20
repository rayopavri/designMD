"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { AuthCard } from "./AuthCard";
import { closeAuthModal, postAuthDestination, useAuthModal } from "@/lib/ui-data/mockAuth";
import { BORDER, INK, MUTED, SURFACE } from "@/lib/ui-data/tokens";

export function AuthModal() {
  const { isOpen, returnTo } = useAuthModal();
  const _router = useRouter();
  const navigate = (path: string) => _router.push(path);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  // Body scroll lock + focus management
  useEffect(() => {
    if (!isOpen) return;
    lastFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the first focusable inside the panel
    const id = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }, 0);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeAuthModal();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const nodes = panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(id);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      lastFocusRef.current?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const intent = returnTo?.startsWith("/generate")
    ? "Generating a design.md from a URL needs an account. Browsing the library doesn't."
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close sign-in"
        onClick={() => closeAuthModal()}
        className="absolute inset-0"
        style={{ background: "rgba(4, 4, 6, 0.78)", backdropFilter: "blur(6px)" }}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-full max-w-[420px] rounded-xl border p-7 shadow-2xl"
        style={{ background: SURFACE, borderColor: BORDER, color: INK }}
      >
        <button
          type="button"
          onClick={() => closeAuthModal()}
          aria-label="Close"
          className="absolute top-3 right-3 h-7 w-7 inline-flex items-center justify-center rounded-md"
          style={{ color: MUTED }}
        >
          <X className="h-4 w-4" />
        </button>
        <AuthCard
          variant="compact"
          intent={intent}
          onSuccess={(_user) => {
            // Auth store closes the modal automatically; route now.
            // postAuthDestination reads the fresh user from the store at call time.
            queueMicrotask(() => navigate(postAuthDestination(returnTo)));
          }}
        />
      </div>
    </div>
  );
}
