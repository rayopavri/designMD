import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { ArrowRight, Check } from "lucide-react";
import {
  BG,
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
} from "../lib/tokens";
import { hasSeenWelcome, markWelcomeSeen, updateProfile, useAuth } from "../lib/auth";

const TOOLS = [
  { id: "claude", label: "Claude" },
  { id: "cursor", label: "Cursor" },
  { id: "lovable", label: "Lovable" },
  { id: "figma-make", label: "Figma Make" },
  { id: "replit", label: "Replit" },
  { id: "v0", label: "v0" },
];

export function Welcome() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const returnTo = useMemo(() => new URLSearchParams(search).get("returnTo") ?? "/generate", [search]);
  const { user } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [handle, setHandle] = useState(user?.handle ?? "");
  const [tools, setTools] = useState<string[]>(user?.preferredTools ?? []);

  useEffect(() => {
    if (!user) {
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    // Onboarding is strictly first-run. Returning users skip straight through.
    if (hasSeenWelcome(user.id)) navigate(returnTo);
  }, [user, navigate, returnTo]);

  function toggleTool(id: string) {
    setTools((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  function persistAndGo(save: boolean) {
    if (save && user) {
      updateProfile({
        displayName: displayName.trim() || user.displayName,
        handle: handle.trim() ? handle.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-") : null,
        preferredTools: tools,
      });
    }
    markWelcomeSeen();
    navigate(returnTo);
  }

  const handleValid = handle.trim() === "" || /^[a-z0-9-]{3,30}$/i.test(handle.trim());

  if (!user) return null;

  return (
    <section className="flex-1" style={{ background: BG }}>
      <div className="mx-auto max-w-xl px-6 lg:px-8 py-16">
        <div
          className="text-[10.5px] uppercase tracking-[0.22em] mb-4"
          style={{ fontFamily: MONO, color: MUTED }}
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIME }} />
            <span style={{ color: SUB }}>signed in as {user.email}</span>
          </span>
        </div>
        <h1
          className="text-[36px] leading-[1.06] font-medium tracking-[-0.022em] mb-3"
          style={{ color: INK }}
        >
          Welcome.{" "}
          <span style={{ color: SUB }}>A few optional details.</span>
        </h1>
        <p className="text-[14px] leading-[1.6]" style={{ color: SUB }}>
          These power your byline when you submit a bundle to the library, and they tune your
          recommendations. Everything here is optional — you can skip and add it later.
        </p>

        <form
          className="mt-10 space-y-7"
          onSubmit={(e) => {
            e.preventDefault();
            if (handleValid) persistAndGo(true);
          }}
        >
          {/* Display name */}
          <label className="block">
            <span
              className="text-[10.5px] uppercase tracking-[0.22em] block mb-2"
              style={{ fontFamily: MONO, color: MUTED }}
            >
              Display name
            </span>
            <input
              type="text"
              maxLength={50}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Marisol Chen"
              className="w-full h-11 rounded-md border px-3 text-[13.5px] outline-none"
              style={{ background: SURFACE_2, borderColor: BORDER, color: INK }}
            />
          </label>

          {/* Handle */}
          <label className="block">
            <span
              className="text-[10.5px] uppercase tracking-[0.22em] block mb-2 inline-flex items-center gap-2"
              style={{ fontFamily: MONO, color: MUTED }}
            >
              Handle <span style={{ color: SUB }}>· uiuxofai.com/@</span>
            </span>
            <input
              type="text"
              maxLength={30}
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="marisol"
              className="w-full h-11 rounded-md border px-3 text-[13.5px] outline-none lowercase"
              style={{
                background: SURFACE_2,
                borderColor: handleValid ? BORDER : "#4A2226",
                color: INK,
                fontFamily: MONO,
              }}
              aria-invalid={!handleValid}
            />
            {!handleValid && (
              <span className="block mt-1.5 text-[11.5px]" style={{ color: "#E89B9F" }}>
                3–30 characters, letters/numbers/hyphens only.
              </span>
            )}
          </label>

          {/* Preferred tools */}
          <div>
            <div
              className="text-[10.5px] uppercase tracking-[0.22em] mb-2 flex items-center justify-between"
              style={{ fontFamily: MONO, color: MUTED }}
            >
              <span>Tools you use · pick up to 3</span>
              <span style={{ color: tools.length === 3 ? VIOLET : SUB }}>{tools.length}/3</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {TOOLS.map((t) => {
                const active = tools.includes(t.id);
                const atCap = tools.length >= 3 && !active;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTool(t.id)}
                    disabled={atCap}
                    className="inline-flex items-center gap-1.5 h-8 rounded-full border px-3 text-[12.5px] disabled:opacity-40"
                    style={{
                      borderColor: active ? VIOLET : BORDER,
                      background: active ? `${VIOLET}1A` : SURFACE,
                      color: active ? INK : SUB,
                    }}
                  >
                    {active && <Check className="h-3 w-3" style={{ color: VIOLET }} strokeWidth={3} />}
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div
            className="pt-5 mt-3 border-t flex items-center justify-between gap-3 flex-wrap"
            style={{ borderColor: BORDER_SOFT }}
          >
            <button
              type="button"
              onClick={() => persistAndGo(false)}
              className="text-[12.5px]"
              style={{ color: SUB, fontFamily: MONO }}
            >
              Skip for now
            </button>
            <button
              type="submit"
              disabled={!handleValid}
              className="h-10 rounded-full px-5 text-[12.5px] font-medium inline-flex items-center gap-2 disabled:opacity-50"
              style={{ background: INK, color: INK_ON_LIGHT }}
            >
              Continue to generate <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default Welcome;
