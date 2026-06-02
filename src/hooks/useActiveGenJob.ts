"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "gen_job";
const POLL_MS = 3000;
// On Vercel Hobby each phase caps at 60s; with QStash hops plus one retry per
// phase a healthy run still finishes well under ~5 min.
// MAX_AGE_MS gates cold page-load recovery from localStorage.
// MAX_POLL_MS stops an in-progress polling loop so it never runs forever.
const MAX_AGE_MS = 10 * 60 * 1000;
const MAX_POLL_MS = 8 * 60 * 1000;

export interface ActiveGenJob {
  jobId: string;
  url: string;
  status: "queued" | "running" | "completed" | "failed";
  currentStep: string | null;
  resultBundleSlug: string | null;
}

interface StoredJob {
  jobId: string;
  url: string;
  startedAt: number;
}

export function saveActiveGenJob(jobId: string, url: string): void {
  if (typeof window === "undefined") return;
  const entry: StoredJob = { jobId, url, startedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
}

export function clearActiveGenJob(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function readStoredJob(): StoredJob | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as StoredJob;
    if (!entry.jobId || !entry.url || !entry.startedAt) return null;
    if (Date.now() - entry.startedAt > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

export function useActiveGenJob(): ActiveGenJob | null {
  const [job, setJob] = useState<ActiveGenJob | null>(null);

  useEffect(() => {
    const stored = readStoredJob();
    if (!stored) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    async function poll() {
      if (cancelled) return;

      // Client-side safety net: if the job has been running longer than
      // MAX_POLL_MS, give up regardless of what the server says. The server
      // also detects stuck rows via its own staleness check, but this ensures
      // the UI never loops forever even if both checks race.
      if (Date.now() - stored!.startedAt > MAX_POLL_MS) {
        clearActiveGenJob();
        setJob((prev) =>
          prev
            ? { ...prev, status: "failed", currentStep: "Generation timed out — please try again." }
            : null
        );
        return;
      }

      try {
        const res = await fetch(`/api/generate/${stored!.jobId}`);
        if (res.status === 404) {
          clearActiveGenJob();
          setJob(null);
          return;
        }
        if (!res.ok) {
          if (!cancelled) timeoutId = setTimeout(poll, POLL_MS);
          return;
        }
        const data = (await res.json()) as {
          status: "queued" | "running" | "completed" | "failed";
          currentStep: string | null;
          resultBundleSlug: string | null;
        };
        const next: ActiveGenJob = {
          jobId: stored!.jobId,
          url: stored!.url,
          status: data.status,
          currentStep: data.currentStep,
          resultBundleSlug: data.resultBundleSlug,
        };
        setJob(next);
        if (data.status === "completed" || data.status === "failed") {
          clearActiveGenJob();
          return;
        }
        if (!cancelled) timeoutId = setTimeout(poll, POLL_MS);
      } catch {
        if (!cancelled) timeoutId = setTimeout(poll, POLL_MS);
      }
    }

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return job;
}
