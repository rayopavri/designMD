"use client";

import { useEffect, useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { LIME, MUTED, MONO, SUB, BORDER, SURFACE } from "@/lib/ui-data/tokens";
import { openAuthModal, useAuth } from "@/lib/ui-data/mockAuth";

const REASON_TAGS = [
  { id: "colors_off", label: "Colors off" },
  { id: "typography_ignored", label: "Typography ignored" },
  { id: "spacing_wrong", label: "Spacing wrong" },
  { id: "too_generic", label: "Too generic" },
  { id: "components_missing", label: "Components missing" },
] as const;

type TagId = (typeof REASON_TAGS)[number]["id"];

interface Props {
  bundleSlug: string;
  initialVoteCount: number;
  initialPositiveVoteRate: number | string;
}

interface VoteState {
  worked: boolean;
  reasonTags: TagId[];
}

export function VoteWidget({ bundleSlug, initialVoteCount, initialPositiveVoteRate }: Props) {
  const { user } = useAuth();
  const [userVote, setUserVote] = useState<VoteState | null>(null);
  const [voteCount, setVoteCount] = useState(initialVoteCount);
  const [positiveVoteRate, setPositiveVoteRate] = useState(Number(initialPositiveVoteRate));
  const [pending, setPending] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [selectedTags, setSelectedTags] = useState<TagId[]>([]);

  useEffect(() => {
    if (!user || !bundleSlug) return;
    let cancelled = false;
    fetch(`/api/bundles/${bundleSlug}/vote`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { vote: VoteState | null; voteCount: number; positiveVoteRate: string } | null) => {
        if (cancelled || !data) return;
        setUserVote(data.vote);
        setVoteCount(data.voteCount);
        setPositiveVoteRate(Number(data.positiveVoteRate));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, bundleSlug]);

  function openAuth() {
    openAuthModal(typeof window !== "undefined" ? window.location.pathname : null);
  }

  async function handleUp() {
    if (!user) { openAuth(); return; }
    if (pending) return;

    const wasUp = userVote?.worked === true;
    const prevVote = userVote;
    const prevCount = voteCount;
    const prevRate = positiveVoteRate;

    // Optimistic update
    if (wasUp) {
      setUserVote(null);
      setVoteCount((c) => Math.max(0, c - 1));
    } else {
      const wasDown = userVote?.worked === false;
      setUserVote({ worked: true, reasonTags: [] });
      setVoteCount((c) => wasDown ? c : c + 1);
    }
    setShowTagPicker(false);

    setPending(true);
    try {
      const method = wasUp ? "DELETE" : "POST";
      const body = wasUp ? undefined : JSON.stringify({ worked: true, reasonTags: [] });
      const res = await fetch(`/api/bundles/${bundleSlug}/vote`, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body,
      });
      if (!res.ok) throw new Error("failed");
      // Refresh live counts from server
      const check = await fetch(`/api/bundles/${bundleSlug}/vote`);
      if (check.ok) {
        const d = await check.json();
        setVoteCount(d.voteCount);
        setPositiveVoteRate(Number(d.positiveVoteRate));
      }
    } catch {
      setUserVote(prevVote);
      setVoteCount(prevCount);
      setPositiveVoteRate(prevRate);
    } finally {
      setPending(false);
    }
  }

  function handleDown() {
    if (!user) { openAuth(); return; }
    if (pending) return;

    if (userVote?.worked === false) {
      // Toggle off — same as delete
      void handleDownDelete();
      return;
    }

    // Show tag picker
    setSelectedTags([]);
    setShowTagPicker(true);
  }

  async function handleDownDelete() {
    const prevVote = userVote;
    const prevCount = voteCount;
    const prevRate = positiveVoteRate;

    setUserVote(null);
    setVoteCount((c) => Math.max(0, c - 1));
    setShowTagPicker(false);

    setPending(true);
    try {
      const res = await fetch(`/api/bundles/${bundleSlug}/vote`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      const check = await fetch(`/api/bundles/${bundleSlug}/vote`);
      if (check.ok) {
        const d = await check.json();
        setVoteCount(d.voteCount);
        setPositiveVoteRate(Number(d.positiveVoteRate));
      }
    } catch {
      setUserVote(prevVote);
      setVoteCount(prevCount);
      setPositiveVoteRate(prevRate);
    } finally {
      setPending(false);
    }
  }

  async function submitDownvote() {
    if (selectedTags.length === 0 || pending) return;

    const prevVote = userVote;
    const prevCount = voteCount;
    const prevRate = positiveVoteRate;

    const wasDown = userVote?.worked === false;
    setUserVote({ worked: false, reasonTags: selectedTags });
    setVoteCount((c) => wasDown ? c : c + 1);
    setShowTagPicker(false);

    setPending(true);
    try {
      const res = await fetch(`/api/bundles/${bundleSlug}/vote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ worked: false, reasonTags: selectedTags }),
      });
      if (!res.ok) throw new Error("failed");
      const check = await fetch(`/api/bundles/${bundleSlug}/vote`);
      if (check.ok) {
        const d = await check.json();
        setVoteCount(d.voteCount);
        setPositiveVoteRate(Number(d.positiveVoteRate));
      }
    } catch {
      setUserVote(prevVote);
      setVoteCount(prevCount);
      setPositiveVoteRate(prevRate);
    } finally {
      setPending(false);
    }
  }

  function toggleTag(id: TagId) {
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  const isUp = userVote?.worked === true;
  const isDown = userVote?.worked === false;
  const rateDisplay = voteCount === 0 ? "–" : `${Math.round(positiveVoteRate)}%`;

  return (
    <div className="inline-flex flex-col gap-2" style={{ fontFamily: MONO }}>
      <div className="flex items-center gap-3">
        {/* Thumbs up */}
        <button
          onClick={handleUp}
          disabled={pending}
          aria-label={user ? (isUp ? "Remove vote" : "This worked for me") : "Sign in to vote"}
          className="inline-flex items-center gap-1.5 text-[12px] transition-colors disabled:opacity-50"
          style={{ color: isUp ? LIME : SUB }}
        >
          <ThumbsUp
            className="h-3.5 w-3.5"
            style={{ fill: isUp ? LIME : "none", stroke: isUp ? LIME : "currentColor" }}
          />
          <span>{voteCount > 0 ? voteCount.toLocaleString() : "0"}</span>
        </button>

        {/* Thumbs down */}
        <button
          onClick={handleDown}
          disabled={pending}
          aria-label={user ? (isDown ? "Remove vote" : "This didn't work") : "Sign in to vote"}
          className="inline-flex items-center gap-1 text-[12px] transition-colors disabled:opacity-50"
          style={{ color: isDown ? MUTED : SUB }}
        >
          <ThumbsDown
            className="h-3.5 w-3.5"
            style={{ fill: isDown ? MUTED : "none", stroke: isDown ? MUTED : "currentColor" }}
          />
        </button>

        {/* Rate */}
        {voteCount > 0 && (
          <span className="text-[11px]" style={{ color: MUTED }}>
            {rateDisplay} helpful
          </span>
        )}
      </div>

      {/* Inline tag picker */}
      {showTagPicker && (
        <div
          className="rounded-lg border p-3 text-[11.5px]"
          style={{ borderColor: BORDER, background: SURFACE, color: SUB }}
        >
          <p className="mb-2" style={{ color: MUTED }}>What was wrong?</p>
          <div className="flex flex-col gap-1.5 mb-3">
            {REASON_TAGS.map((tag) => (
              <label key={tag.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTags.includes(tag.id)}
                  onChange={() => toggleTag(tag.id)}
                  className="h-3 w-3 accent-current"
                />
                <span>{tag.label}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={submitDownvote}
              disabled={selectedTags.length === 0 || pending}
              className="text-[11px] px-2.5 py-1 rounded disabled:opacity-40"
              style={{ background: MUTED + "33", color: SUB }}
            >
              Submit
            </button>
            <button
              onClick={() => setShowTagPicker(false)}
              className="text-[11px]"
              style={{ color: MUTED }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
