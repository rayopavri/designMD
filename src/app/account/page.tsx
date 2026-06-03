"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { BG, BORDER_SOFT, INK, MONO, MUTED, SUB } from "@/lib/ui-data/tokens";
import { useAuth } from "@/lib/ui-data/mockAuth";

function Account() {
  const { user } = useAuth();
  const _router = useRouter();
  const location = usePathname();
  const navigate = (path: string) => _router.push(path);

  useEffect(() => {
    if (!user) navigate(`/login?returnTo=${encodeURIComponent(location || "/account")}`);
  }, [user, navigate, location]);

  if (!user) return null;

  return (
    <section className="flex-1" style={{ background: BG }}>
      <div className="mx-auto max-w-3xl px-6 lg:px-8 py-16">
        <div
          className="text-[10.5px] uppercase tracking-[0.22em] mb-4"
          style={{ fontFamily: MONO, color: MUTED }}
        >
          Account · placeholder
        </div>
        <h1
          className="text-[36px] leading-[1.06] font-medium tracking-[-0.022em] mb-3"
          style={{ color: INK }}
        >
          Hello, {user.displayName}.
        </h1>
        <p className="text-[14px] leading-[1.6]" style={{ color: SUB }}>
          The full account section (design skills, submissions, settings, profile) is coming next. For
          now this confirms sign-in is working — your session persists across reloads and you can
          sign out from the menu in the header.
        </p>
        <div
          className="mt-8 pt-6 border-t text-[12.5px] grid grid-cols-1 sm:grid-cols-2 gap-3"
          style={{ borderColor: BORDER_SOFT, color: SUB }}
        >
          <div>
            <div style={{ color: MUTED, fontFamily: MONO }} className="text-[10.5px] uppercase tracking-[0.22em] mb-1">
              Email
            </div>
            <div style={{ color: INK, fontFamily: MONO }}>{user.email}</div>
          </div>
          <div>
            <div style={{ color: MUTED, fontFamily: MONO }} className="text-[10.5px] uppercase tracking-[0.22em] mb-1">
              Handle
            </div>
            <div style={{ color: INK, fontFamily: MONO }}>
              {user.handle ? `@${user.handle}` : "—"}
            </div>
          </div>
          <div>
            <div style={{ color: MUTED, fontFamily: MONO }} className="text-[10.5px] uppercase tracking-[0.22em] mb-1">
              Sign-in method
            </div>
            <div style={{ color: INK, fontFamily: MONO }}>{user.provider}</div>
          </div>
          <div>
            <div style={{ color: MUTED, fontFamily: MONO }} className="text-[10.5px] uppercase tracking-[0.22em] mb-1">
              Preferred tools
            </div>
            <div style={{ color: INK, fontFamily: MONO }}>
              {user.preferredTools.length ? user.preferredTools.join(", ") : "—"}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Account;
