"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, Heart, LayoutList, LogOut, Settings, User as UserIcon } from "lucide-react";
import { BORDER, INK, MONO, MUTED, SUB, SURFACE, SURFACE_2 } from "@/lib/ui-data/tokens";
import { signOut, useAuth } from "@/lib/ui-data/mockAuth";

export function UserMenu() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const _router = useRouter();
  const navigate = (path: string) => _router.push(path);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 h-8 rounded-full border pl-1 pr-2.5 text-[12.5px]"
        style={{ borderColor: BORDER, background: SURFACE, color: INK }}
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
        ) : (
          <span
            className="h-6 w-6 rounded-full inline-flex items-center justify-center text-[11px] font-medium"
            style={{ background: SURFACE_2, color: INK }}
          >
            {user.displayName.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="hidden sm:inline max-w-[10ch] truncate">{user.displayName}</span>
        <ChevronDown className="h-3 w-3" style={{ color: MUTED }} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 rounded-lg border shadow-xl overflow-hidden z-50"
          style={{ background: SURFACE, borderColor: BORDER, color: INK }}
        >
          <div className="px-3 py-3 border-b" style={{ borderColor: BORDER }}>
            <div className="text-[12.5px] truncate" style={{ color: INK }}>
              {user.displayName}
            </div>
            <div className="text-[11px] truncate" style={{ color: MUTED, fontFamily: MONO }}>
              {user.email}
            </div>
          </div>
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            role="menuitem"
            className="flex items-center gap-2.5 px-3 py-2.5 text-[12.5px] hover:bg-[#16161A]"
            style={{ color: INK }}
          >
            <UserIcon className="h-3.5 w-3.5" style={{ color: SUB }} />
            Account
          </Link>
          <Link
            href="/account/bundles"
            onClick={() => setOpen(false)}
            role="menuitem"
            className="flex items-center gap-2.5 px-3 py-2.5 text-[12.5px] hover:bg-[#16161A]"
            style={{ color: INK }}
          >
            <LayoutList className="h-3.5 w-3.5" style={{ color: SUB }} />
            Your bundles
          </Link>
          <Link
            href="/account/favorites"
            onClick={() => setOpen(false)}
            role="menuitem"
            className="flex items-center gap-2.5 px-3 py-2.5 text-[12.5px] hover:bg-[#16161A]"
            style={{ color: INK }}
          >
            <Heart className="h-3.5 w-3.5" style={{ color: SUB }} />
            Your favorites
          </Link>
          <Link
            href="/account/settings"
            onClick={() => setOpen(false)}
            role="menuitem"
            className="flex items-center gap-2.5 px-3 py-2.5 text-[12.5px] hover:bg-[#16161A]"
            style={{ color: INK }}
          >
            <Settings className="h-3.5 w-3.5" style={{ color: SUB }} />
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              signOut();
              navigate("/");
            }}
            className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 text-[12.5px] hover:bg-[#16161A] border-t"
            style={{ color: INK, borderColor: BORDER }}
          >
            <LogOut className="h-3.5 w-3.5" style={{ color: SUB }} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
