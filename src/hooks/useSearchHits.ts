'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A single hit from `GET /api/search`. Declared locally (rather than imported
 * from `@/lib/search`) so no server-only Orama/DB code is pulled into the
 * client bundle — the shape matches `SearchHit` there exactly.
 */
export interface SearchHit {
  slug: string;
  title: string;
  description: string;
  score: number;
}

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

export interface UseSearchHitsResult {
  hits: SearchHit[];
  loading: boolean;
  /** True once the trimmed query is long enough to search (>= 2 chars). */
  hasQuery: boolean;
}

/**
 * Debounced full-text search against `/api/search`, mirroring the inline
 * pattern in `LibraryClient` but returning full hits (title/description/slug)
 * so a dropdown can render them. Cancels in-flight requests on every keystroke
 * and ignores out-of-order responses, so a slow cold-start response can't
 * clobber a newer query.
 */
export function useSearchHits(query: string): UseSearchHitsResult {
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const q = query.trim();
  const hasQuery = q.length >= MIN_CHARS;
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (q.length < MIN_CHARS) {
      setHits([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    const myId = ++reqIdRef.current;
    // Set synchronously so the spinner covers both the debounce and the
    // multi-second Orama cold start on the first request.
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (myId !== reqIdRef.current) return; // superseded by a newer query
        if (!res.ok) {
          setHits([]);
          setLoading(false);
          return;
        }
        const json = (await res.json()) as { data: SearchHit[] };
        if (myId !== reqIdRef.current) return; // re-check after the await
        setHits(json.data ?? []);
        setLoading(false);
      } catch {
        // Aborted or network error. If a newer effect has taken over it owns
        // `loading`; otherwise clear it so the spinner doesn't hang.
        if (myId === reqIdRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]); // trimmed → "linear" vs " linear " don't trigger a refetch

  return { hits, loading, hasQuery };
}
