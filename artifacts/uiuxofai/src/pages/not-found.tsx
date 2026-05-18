import { Link } from "wouter";
import { ArrowUpRight } from "lucide-react";
import { SectionLabel } from "../components/Shell";
import { MONO, MUTED, SUB, VIOLET } from "../lib/tokens";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-6 lg:px-8 py-32 text-center">
      <SectionLabel n="404" t="Off the index" />
      <h1 className="mt-6 text-[56px] leading-[1.02] font-medium tracking-[-0.022em]">
        That route isn't
        <br />
        <span style={{ color: SUB }}>in the catalog.</span>
      </h1>
      <p className="mt-5 text-[14px]" style={{ color: SUB, fontFamily: MONO }}>
        The bundle, page, or fragment you were looking for is not registered in this index.
      </p>
      <Link
        href="/library"
        className="mt-8 inline-flex items-center gap-2 text-[13px]"
        style={{ color: VIOLET }}
      >
        Back to the library
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
      <div
        className="mt-10 text-[11px] inline-block px-3 py-1 rounded-md"
        style={{ color: MUTED, fontFamily: MONO, border: `1px solid #1F1F23` }}
      >
        ERR_NO_PLATE · 404
      </div>
    </div>
  );
}
