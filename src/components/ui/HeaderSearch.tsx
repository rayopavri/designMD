"use client";

import { useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Command, CornerDownLeft, Loader2, Search, X } from "lucide-react";
import { BG_SOFT_HEADER } from "@/lib/ui-data/constants";
import { BORDER, INK, MONO, MUTED, SUB, SURFACE, VIOLET } from "@/lib/ui-data/tokens";
import { useSearchHits, type SearchHit } from "@/hooks/useSearchHits";

const MIN_CHARS = 2;
const MAX_VISIBLE = 8;
const HOVER_BG = "#16161A"; // matches UserMenu row hover

export interface HeaderSearchHandle {
  focus: () => void;
}

interface SearchCoreProps {
  variant: "inline" | "sheet";
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** Called after navigating to a result/all-results (sheet uses it to close). */
  onAfterNavigate?: () => void;
  /** Sheet-only: Escape with the dropdown already closed requests a sheet close. */
  onRequestClose?: () => void;
}

/**
 * Input + results list + keyboard engine shared by the desktop inline combobox
 * and the mobile sheet. `variant` controls presentation only: `inline` renders
 * an absolutely-positioned popover gated on `open`; `sheet` renders the list
 * inline below the input.
 */
function SearchCore({ variant, inputRef, onAfterNavigate, onRequestClose }: SearchCoreProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false); // inline popover visibility
  const [active, setActive] = useState(-1); // highlighted option; -1 = none → Enter goes to all results
  const [focused, setFocused] = useState(false);
  const { hits, loading, hasQuery } = useSearchHits(query);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);
  const listId = useId();

  const q = query.trim();
  const shown = hits.slice(0, MAX_VISIBLE);
  const showList = variant === "inline" ? open : q.length > 0;

  // Close the inline popover on a pointer press outside the component.
  useEffect(() => {
    if (variant !== "inline" || !open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setActive(-1);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [variant, open]);

  // Keep the highlighted row scrolled into view during keyboard nav.
  useEffect(() => {
    if (active < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const afterSelect = () => {
    justSelectedRef.current = true;
    setOpen(false);
    setActive(-1);
    setQuery("");
    onAfterNavigate?.();
  };

  const navigateToAll = (raw: string) => {
    const t = raw.trim();
    if (t) router.push(`/library?q=${encodeURIComponent(t)}`);
  };

  const goToHit = (hit: SearchHit) => {
    afterSelect();
    router.push(`/library/${hit.slug}`);
  };

  const clearQuery = () => {
    setQuery("");
    setActive(-1);
    setOpen(false);
    inputRef.current?.focus();
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    justSelectedRef.current = false;
    setQuery(v);
    setActive(-1);
    if (variant === "inline") setOpen(v.trim().length >= MIN_CHARS);
  };

  const onFocus = () => {
    setFocused(true);
    if (variant === "inline" && !justSelectedRef.current && q.length >= MIN_CHARS) setOpen(true);
    justSelectedRef.current = false;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (variant === "inline" && !open && hasQuery) {
        setOpen(true);
        setActive(0);
      } else if (shown.length) {
        setActive((a) => (a < 0 ? 0 : (a + 1) % shown.length));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (shown.length) setActive((a) => (a < 0 ? shown.length - 1 : (a - 1 + shown.length) % shown.length));
    } else if (e.key === "Enter") {
      if (active >= 0 && shown[active]) {
        e.preventDefault();
        goToHit(shown[active]);
      } else if (hasQuery) {
        e.preventDefault();
        navigateToAll(query);
        afterSelect();
      }
    } else if (e.key === "Escape") {
      if (variant === "inline") {
        e.preventDefault();
        if (open) {
          setOpen(false);
          setActive(-1);
        } else {
          inputRef.current?.blur();
        }
      }
      // sheet: let Escape bubble to the sheet's document listener, which closes it.
    } else if (e.key === "Tab") {
      if (variant === "inline") setOpen(false);
    }
  };

  const renderResults = () => {
    if (!hasQuery) {
      return (
        <div className="px-3 py-3 text-[11.5px]" style={{ color: MUTED, fontFamily: MONO }}>
          Type at least 2 characters…
        </div>
      );
    }
    return (
      <>
        <div
          ref={listRef}
          role="listbox"
          id={listId}
          aria-label="Design skill results"
          className={`${variant === "inline" ? "max-h-[60vh]" : "max-h-[70vh]"} overflow-y-auto`}
        >
          {shown.map((hit, i) => (
            <Link
              key={hit.slug}
              href={`/library/${hit.slug}`}
              role="option"
              id={`${listId}-opt-${i}`}
              data-idx={i}
              aria-selected={i === active}
              onMouseMove={() => setActive(i)}
              onClick={afterSelect}
              className="flex flex-col gap-0.5 px-3 py-2"
              style={{ background: i === active ? HOVER_BG : "transparent" }}
            >
              <span className="text-[13px] truncate" style={{ color: INK }}>
                {hit.title}
              </span>
              {hit.description ? (
                <span className="text-[11.5px] truncate" style={{ color: MUTED }}>
                  {hit.description}
                </span>
              ) : null}
            </Link>
          ))}
          {loading && shown.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-4 text-[11.5px]" style={{ color: SUB, fontFamily: MONO }}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: VIOLET }} aria-hidden="true" />
              Searching…
            </div>
          ) : null}
          {!loading && shown.length === 0 ? (
            <div className="px-3 py-4">
              <div className="text-[13px]" style={{ color: INK }}>
                No design skills match “{q}”.
              </div>
              <div className="mt-1 text-[11.5px]" style={{ color: MUTED }}>
                Try another brand name, or:
              </div>
              <div className="mt-2 flex items-center gap-4 text-[11.5px]">
                <Link href="/library" onClick={afterSelect} style={{ color: VIOLET }}>
                  Browse all
                </Link>
                <Link
                  href="/generate"
                  onClick={afterSelect}
                  className="inline-flex items-center gap-0.5"
                  style={{ color: VIOLET }}
                >
                  Generate from a URL <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => {
            navigateToAll(query);
            afterSelect();
          }}
          className="w-full flex items-center gap-1.5 px-3 py-2 border-t text-[11px] text-left"
          style={{ borderColor: BORDER, color: SUB, fontFamily: MONO }}
        >
          <CornerDownLeft className="h-3 w-3" aria-hidden="true" />
          <span className="truncate">Enter → all results for “{q.length > 24 ? `${q.slice(0, 24)}…` : q}”</span>
          {loading && shown.length > 0 ? (
            <Loader2 className="h-3 w-3 animate-spin ml-auto" style={{ color: VIOLET }} aria-hidden="true" />
          ) : null}
        </button>
      </>
    );
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <Search
        className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: MUTED }}
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        placeholder="Search design skills"
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-label="Search design skills"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        className={
          variant === "inline"
            ? "w-full h-8 rounded-md border pl-9 pr-14 text-[12px] outline-none"
            : "w-full h-10 rounded-md border pl-9 pr-10 text-[13px] outline-none"
        }
        style={{ borderColor: BORDER, background: SURFACE, color: INK }}
      />

      {variant === "inline" ? (
        query !== "" ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={clearQuery}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-5 w-5 items-center justify-center rounded"
            style={{ color: MUTED }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : !focused ? (
          <span
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 rounded border px-1 text-[10.5px] pointer-events-none"
            style={{ borderColor: BORDER, color: MUTED, fontFamily: MONO }}
            aria-hidden="true"
          >
            <Command className="h-2.5 w-2.5" /> K
          </span>
        ) : null
      ) : (
        <button
          type="button"
          aria-label="Close search"
          onClick={() => onRequestClose?.()}
          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded"
          style={{ color: MUTED }}
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {variant === "inline"
        ? open && (
            <div
              className="absolute left-0 right-0 top-[calc(100%+6px)] rounded-lg border shadow-2xl overflow-hidden"
              style={{ background: SURFACE, borderColor: BORDER, zIndex: 60 }}
            >
              {renderResults()}
            </div>
          )
        : q.length > 0 && (
            <div className="mt-2 rounded-lg border overflow-hidden" style={{ background: SURFACE, borderColor: BORDER }}>
              {renderResults()}
            </div>
          )}
    </div>
  );
}

/** Desktop inline combobox. Exposes `focus()` so Cmd/Ctrl+K can focus the input. */
export function HeaderSearch({ controlRef }: { controlRef?: React.Ref<HeaderSearchHandle> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(controlRef, () => ({ focus: () => inputRef.current?.focus() }), []);
  return (
    <div className="hidden lg:block relative w-[260px]">
      <SearchCore variant="inline" inputRef={inputRef} />
    </div>
  );
}

/** Small search icon button shown below the `lg` breakpoint. */
export function MobileSearchTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Search design skills"
      className="lg:hidden inline-flex h-8 w-8 items-center justify-center rounded-md border"
      style={{ borderColor: BORDER, background: SURFACE, color: SUB }}
    >
      <Search className="h-4 w-4" />
    </button>
  );
}

/** Full-width search sheet anchored under the header for small screens. */
export function MobileSearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      lastFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Search" className="fixed inset-0 z-[100]">
      <button
        type="button"
        aria-label="Close search"
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: "rgba(4, 4, 6, 0.78)", backdropFilter: "blur(6px)" }}
      />
      <div className="absolute inset-x-0 top-0 border-b p-3" style={{ background: BG_SOFT_HEADER, borderColor: BORDER }}>
        <div className="mx-auto max-w-6xl">
          <SearchCore variant="sheet" inputRef={inputRef} onAfterNavigate={onClose} onRequestClose={onClose} />
        </div>
      </div>
    </div>
  );
}
