"use client";

import Link from "next/link";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Mail } from "lucide-react";
import {
  BORDER,
  BORDER_SOFT,
  INK,
  INK_ON_LIGHT,
  LIME,
  MONO,
  MUTED,
  SUB,
  SURFACE,
  SURFACE_2,
  VIOLET,
} from "@/lib/ui-data/tokens";
import { mockSignInEmail, mockSignInGoogle, type AuthUser } from "@/lib/ui-data/mockAuth";

type Step = "providers" | "email" | "sent";

export type AuthCardProps = {
  /** Compact = used in modal. Full = used on /login page. */
  variant?: "compact" | "full";
  onSuccess: (user: AuthUser) => void;
  /** Extra heading copy used in modal to explain *why* the prompt appeared. */
  intent?: string | null;
  /** When provided, renders a "Skip for now" link below the provider
   * buttons. Used by the modal to let users dismiss the prompt and
   * continue anonymously. */
  onSkip?: () => void;
  /** Override the default heading. Defaults to "Sign in to UIUXskills"
   * (variant=full) or "Sign in" (variant=compact). */
  title?: string;
};

const GoogleMark = () => (
  <svg viewBox="0 0 18 18" className="h-4 w-4" aria-hidden="true">
    <path fill="#EA4335" d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.58 5.05 6.62 3.48 9 3.48z" />
    <path fill="#4285F4" d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.62z" />
    <path fill="#FBBC05" d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A8.94 8.94 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.42-1.57-5.13-3.74L.96 13.04C2.44 15.98 5.48 18 9 18z" />
  </svg>
);

export function AuthCard({ variant = "compact", onSuccess, intent, onSkip, title }: AuthCardProps) {
  const [step, setStep] = useState<Step>("providers");
  const [email, setEmail] = useState("");
  const [loadingProvider, setLoadingProvider] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    if (step === "email") emailRef.current?.focus();
  }, [step]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  async function handleGoogle() {
    setError(null);
    setLoadingProvider("google");
    try {
      const user = await mockSignInGoogle();
      if (!mountedRef.current) return; // user cancelled — ignore
      onSuccess(user);
    } catch (e) {
      if (!mountedRef.current) return;
      setError("Couldn't sign in. Try again.");
      setLoadingProvider(null);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setLoadingProvider("email");
    try {
      await mockSignInEmail(trimmed);
      if (!mountedRef.current) return;
      setStep("sent");
      setLoadingProvider(null);
      // Global auth subscriber closes the modal once the user clicks the
      // link and `/auth/callback` completes sign-in.
    } catch {
      if (!mountedRef.current) return;
      setError("Couldn't send the link. Try again.");
      setLoadingProvider(null);
    }
  }

  const titleSize = variant === "full" ? "text-[32px]" : "text-[22px]";

  return (
    <div className="w-full">
      {/* Heading */}
      <div className={variant === "full" ? "text-center" : "text-left"}>
        <div
          className="text-[10.5px] uppercase tracking-[0.22em] mb-3"
          style={{ fontFamily: MONO, color: MUTED }}
        >
          {step === "sent" ? "magic link sent" : "sign in to continue"}
        </div>
        <h2 className={`${titleSize} leading-[1.08] font-medium tracking-[-0.018em]`} style={{ color: INK }}>
          {step === "providers" &&
            (title ?? (variant === "full" ? "Sign in to UIUXskills" : "Sign in"))}
          {step === "email" && "Continue with email"}
          {step === "sent" && "Check your inbox"}
        </h2>
        {step === "providers" && (
          <p className="mt-2 text-[13.5px] leading-[1.55]" style={{ color: SUB }}>
            {intent ??
              "Sign in to track the URLs you've generated and save favorites — both coming soon. You can keep using the generator without signing in."}
          </p>
        )}
        {step === "email" && (
          <p className="mt-2 text-[13.5px] leading-[1.55]" style={{ color: SUB }}>
            We&apos;ll email you a one-tap sign-in link. No password.
          </p>
        )}
        {step === "sent" && (
          <p className="mt-2 text-[13.5px] leading-[1.55]" style={{ color: SUB }}>
            We sent a sign-in link to <span style={{ color: INK }}>{email}</span>. Open it on this
            device to finish signing in — this tab will update automatically.
          </p>
        )}
      </div>

      {/* Body */}
      <div className="mt-7">
        {step === "providers" && (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loadingProvider !== null}
              className="w-full h-11 rounded-md border inline-flex items-center justify-center gap-2.5 text-[13px] font-medium disabled:opacity-60"
              style={{ background: SURFACE_2, borderColor: BORDER, color: INK }}
            >
              {loadingProvider === "google" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <GoogleMark />
                  Continue with Google
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStep("email")}
              disabled={loadingProvider !== null}
              className="w-full h-11 rounded-md border inline-flex items-center justify-center gap-2.5 text-[13px] font-medium disabled:opacity-60"
              style={{ background: SURFACE, borderColor: BORDER, color: INK }}
            >
              <Mail className="h-4 w-4" style={{ color: SUB }} />
              Continue with email
            </button>
            {onSkip ? (
              <button
                type="button"
                onClick={onSkip}
                disabled={loadingProvider !== null}
                className="w-full mt-2 text-[12.5px] underline underline-offset-4 disabled:opacity-50"
                style={{ color: SUB, fontFamily: MONO }}
              >
                Skip for now
              </button>
            ) : null}
          </div>
        )}

        {step === "email" && (
          <form onSubmit={handleEmail} className="space-y-3">
            <label className="block">
              <span
                className="text-[10.5px] uppercase tracking-[0.22em] block mb-1.5"
                style={{ fontFamily: MONO, color: MUTED }}
              >
                Email
              </span>
              <input
                ref={emailRef}
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="you@studio.com"
                className="w-full h-11 rounded-md border px-3 text-[13.5px] outline-none"
                style={{ background: SURFACE_2, borderColor: BORDER, color: INK, fontFamily: MONO }}
                disabled={loadingProvider !== null}
              />
            </label>
            <button
              type="submit"
              disabled={loadingProvider !== null}
              className="w-full h-11 rounded-md text-[13px] font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: INK, color: INK_ON_LIGHT }}
            >
              {loadingProvider === "email" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending link…
                </>
              ) : (
                <>
                  Send sign-in link <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("providers");
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 text-[12px]"
              style={{ color: SUB, fontFamily: MONO }}
            >
              <ArrowLeft className="h-3 w-3" />
              back
            </button>
          </form>
        )}

        {step === "sent" && (
          <div
            className="rounded-md border p-4 flex items-start gap-3"
            style={{ background: SURFACE_2, borderColor: BORDER_SOFT }}
          >
            <span
              className="h-7 w-7 rounded-full inline-flex items-center justify-center shrink-0"
              style={{ background: `${LIME}22`, color: LIME }}
            >
              <Check className="h-4 w-4" strokeWidth={3} />
            </span>
            <div className="min-w-0">
              <div className="text-[12.5px]" style={{ color: INK }}>
                Link sent
              </div>
              <div className="text-[11.5px] mt-0.5 inline-flex items-center gap-1.5" style={{ color: SUB }}>
                <Loader2 className="h-3 w-3 animate-spin" style={{ color: VIOLET }} />
                Signing you in…
              </div>
            </div>
          </div>
        )}

        {error && (
          <div
            className="mt-3 text-[12px] rounded-md border px-3 py-2"
            style={{ borderColor: "#4A2226", background: "#1A0E10", color: "#E89B9F" }}
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Footer fine print */}
        {step !== "sent" && (
          <p
            className="mt-6 text-[11px] leading-[1.55] text-center"
            style={{ color: MUTED, fontFamily: MONO }}
          >
            by continuing you agree to our{" "}
            <Link href="/legal/terms" className="underline">terms</Link> and{" "}
            <Link href="/legal/privacy" className="underline">privacy policy</Link>
          </p>
        )}
      </div>
    </div>
  );
}
