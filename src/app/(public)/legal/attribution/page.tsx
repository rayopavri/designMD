import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Attribution',
  description: 'Open-source credits for the libraries and tools used in building UIUXskills.',
  alternates: { canonical: 'https://uiuxskills.com/legal/attribution' },
  openGraph: {
    title: 'Attribution',
    description: 'Open-source credits for the libraries and tools used in building UIUXskills.',
    url: 'https://uiuxskills.com/legal/attribution',
  },
};

import { SectionLabel } from "@/components/ui/Shell";
import { BORDER_SOFT, INK, MUTED, MONO, SUB } from "@/lib/ui-data/tokens";

const CREDITS = [
  {
    name: "@google/design.md",
    role: "The open-source design.md format that powers every bundle in this library.",
    license: "Apache 2.0",
  },
  {
    name: "Firecrawl",
    role: "Web scraping and content extraction used in the bundle generation pipeline.",
    license: "AGPL-3.0",
  },
  {
    name: "Tailwind CSS",
    role: "Utility-first CSS framework used throughout the UI.",
    license: "MIT",
  },
  {
    name: "Next.js",
    role: "React framework for the web application.",
    license: "MIT",
  },
  {
    name: "Radix UI",
    role: "Accessible, unstyled UI primitives.",
    license: "MIT",
  },
  {
    name: "Lucide",
    role: "Icon library.",
    license: "ISC",
  },
  {
    name: "Drizzle ORM",
    role: "TypeScript ORM for database access.",
    license: "Apache 2.0",
  },
  {
    name: "Orama",
    role: "Full-text search engine.",
    license: "Apache 2.0",
  },
];

export default function AttributionPage() {
  return (
    <>
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-3xl px-6 lg:px-8 pt-16 pb-12">
          <SectionLabel t="Legal" />
          <h1
            className="mt-4 text-[44px] sm:text-[54px] leading-[1.02] font-medium tracking-[-0.022em]"
            style={{ color: INK }}
          >
            Attribution
          </h1>
          <p className="mt-6 text-[15px] leading-[1.65]" style={{ color: SUB }}>
            UIUXskills is built on open-source software. Thank you to every maintainer below.
          </p>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-3xl px-6 lg:px-8 py-10">
          <ul className="space-y-5">
            {CREDITS.map((c) => (
              <li key={c.name} className="flex gap-4">
                <div className="shrink-0" style={{ minWidth: "180px" }}>
                  <span
                    className="text-[12px] font-medium"
                    style={{ color: INK, fontFamily: MONO }}
                  >
                    {c.name}
                  </span>
                  <div className="text-[10.5px] mt-0.5" style={{ color: MUTED, fontFamily: MONO }}>
                    {c.license}
                  </div>
                </div>
                <p className="text-[13.5px] leading-[1.6]" style={{ color: SUB }}>
                  {c.role}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
