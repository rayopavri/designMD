import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { BORDER, INK, LIME, MONO, MUTED, PEACH, SUB, SURFACE, VIOLET } from "../lib/tokens";

type Highlight = { tag?: "add" | "mod"; text: React.ReactNode };

function renderLine(raw: string): React.ReactNode {
  // Tiny YAML-flavored colorizer for the demo: comments, keys, quoted strings, numbers
  // We split by simple regex; safe enough for our seed data.
  const parts: React.ReactNode[] = [];
  let rest = raw;
  let key = 0;

  // Comment
  const commentIdx = rest.indexOf("#");
  let commentPart: React.ReactNode = null;
  if (commentIdx >= 0 && !/["'].*#/.test(rest.slice(0, commentIdx))) {
    commentPart = (
      <span key={`c-${key++}`} style={{ color: MUTED }}>
        {rest.slice(commentIdx)}
      </span>
    );
    rest = rest.slice(0, commentIdx);
  }

  // Tokenize the remaining text by quoted strings, numbers, keys-with-colon
  const tokenRe = /("[^"]*"|'[^']*'|\b#?[0-9A-Fa-f]{3,8}\b|\b\d+(?:\.\d+)?\b|^\s*[A-Za-z_][\w-]*\s*:)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(rest)) !== null) {
    const t = m[0];
    if (m.index > lastIndex) {
      parts.push(<span key={`p-${key++}`}>{rest.slice(lastIndex, m.index)}</span>);
    }
    if (/^".*"$|^'.*'$/.test(t)) {
      parts.push(
        <span key={`s-${key++}`} style={{ color: VIOLET }}>
          {t}
        </span>,
      );
    } else if (/^#?[0-9A-Fa-f]{3,8}$/.test(t) && /[A-Fa-f]/.test(t)) {
      parts.push(
        <span key={`h-${key++}`} style={{ color: VIOLET }}>
          {t}
        </span>,
      );
    } else if (/^\d/.test(t)) {
      parts.push(
        <span key={`n-${key++}`} style={{ color: PEACH }}>
          {t}
        </span>,
      );
    } else if (/:$/.test(t.trim())) {
      parts.push(
        <span key={`k-${key++}`} style={{ color: INK }}>
          {t}
        </span>,
      );
    } else {
      parts.push(<span key={`x-${key++}`}>{t}</span>);
    }
    lastIndex = m.index + t.length;
  }
  if (lastIndex < rest.length) {
    parts.push(<span key={`tail-${key++}`}>{rest.slice(lastIndex)}</span>);
  }
  if (commentPart) parts.push(commentPart);
  return <>{parts.length > 0 ? parts : raw}</>;
}

export function CodePanel({
  title,
  language = "yaml",
  source,
  rightMeta,
  highlights,
}: {
  title: string;
  language?: string;
  source: string;
  rightMeta?: React.ReactNode;
  highlights?: Record<number, Highlight["tag"]>;
}) {
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => source.split("\n"), [source]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore — clipboard may be restricted in iframe
    }
  };

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: BORDER, background: SURFACE }}>
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{ borderColor: BORDER, background: "#0C0C0E" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#2A2A2E" }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#2A2A2E" }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#2A2A2E" }} />
          </div>
          <span
            className="text-[11px] uppercase tracking-[0.18em] truncate"
            style={{ fontFamily: MONO, color: SUB }}
          >
            {title}
          </span>
          <span
            className="text-[9.5px] px-1.5 py-0.5 rounded uppercase tracking-[0.18em] shrink-0"
            style={{ fontFamily: MONO, color: VIOLET, border: `1px solid ${VIOLET}55` }}
          >
            {language}
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px]" style={{ fontFamily: MONO, color: SUB }}>
          {rightMeta}
          <button
            className="inline-flex items-center gap-1.5 hover:text-[color:var(--ink)]"
            onClick={onCopy}
            style={{ color: copied ? LIME : SUB }}
            aria-label="Copy"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? "copied" : "copy"}</span>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-[44px_1fr] font-mono max-h-[520px] overflow-auto">
        <div
          className="text-right text-[11.5px] leading-[1.85] py-5 pr-3 border-r select-none"
          style={{ borderColor: BORDER, color: "#37373C", background: "#0D0D10" }}
        >
          {lines.map((_, i) => {
            const tag = highlights?.[i + 1];
            return (
              <div
                key={i}
                className="px-1.5"
                style={{
                  background: tag === "add" ? "#15201A" : tag === "mod" ? "#1F1A14" : undefined,
                  color: tag ? INK : undefined,
                }}
              >
                {i + 1}
              </div>
            );
          })}
        </div>
        <pre
          className="py-5 px-5 text-[12.5px] leading-[1.85] overflow-x-auto"
          style={{ color: INK, fontFamily: MONO, margin: 0 }}
        >
          {lines.map((l, i) => {
            const tag = highlights?.[i + 1];
            return (
              <div
                key={i}
                className="flex items-start gap-2"
                style={{
                  background: tag === "add" ? "#0E1812" : tag === "mod" ? "#181308" : undefined,
                  marginLeft: -20,
                  paddingLeft: 20,
                }}
              >
                <span
                  className="w-3 inline-block shrink-0"
                  style={{ color: tag === "add" ? LIME : tag === "mod" ? PEACH : "transparent" }}
                >
                  {tag === "add" ? "+" : tag === "mod" ? "~" : " "}
                </span>
                <span style={{ whiteSpace: "pre" }}>{renderLine(l)}</span>
              </div>
            );
          })}
        </pre>
      </div>
      <div
        className="flex items-center justify-between px-4 py-2 border-t text-[10.5px]"
        style={{ borderColor: BORDER, background: "#0C0C0E", fontFamily: MONO, color: MUTED }}
      >
        <div className="flex items-center gap-4">
          <span>UTF-8</span>
          <span>LF</span>
          <span>{language.toUpperCase()}</span>
          <span style={{ color: SUB }}>last verified · 4h ago</span>
        </div>
        <div className="flex items-center gap-3">
          <span>{lines.length} lines</span>
          <span style={{ color: SUB }}>·</span>
          <span>open in claude</span>
        </div>
      </div>
    </div>
  );
}
