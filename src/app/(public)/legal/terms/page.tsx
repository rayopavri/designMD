import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms governing your use of UIUXskills at uiuxskills.com.',
  alternates: { canonical: 'https://uiuxskills.com/legal/terms' },
  openGraph: {
    title: 'Terms of Service',
    description: 'Terms governing your use of UIUXskills at uiuxskills.com.',
    url: 'https://uiuxskills.com/legal/terms',
  },
};

import { SectionLabel } from "@/components/ui/Shell";
import { BORDER_SOFT, INK, MUTED, MONO, SUB } from "@/lib/ui-data/tokens";

const SECTIONS = [
  {
    heading: "Acceptance",
    body: "By accessing or using UIUXskills, you agree to these terms. If you do not agree, please do not use the service.",
  },
  {
    heading: "Use of Service",
    body: "UIUXskills is provided for personal and professional use. You may not use the service for unlawful purposes or in ways that harm others.",
  },
  {
    heading: "Accounts",
    body: "You are responsible for maintaining the security of your account and for all activity that occurs under it.",
  },
  {
    heading: "Content",
    body: "Generated design bundles are provided as-is. We make no warranties about their accuracy or fitness for a particular purpose.",
  },
  {
    heading: "Limitation of Liability",
    body: "UIUXskills is provided “as is” without warranties of any kind. We are not liable for any damages arising from your use of the service.",
  },
  {
    heading: "Changes",
    body: "We may update these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.",
  },
];

export default function TermsPage() {
  return (
    <>
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-3xl px-6 lg:px-8 pt-16 pb-12">
          <SectionLabel t="Legal" />
          <h1
            className="mt-4 text-[44px] sm:text-[54px] leading-[1.02] font-medium tracking-[-0.022em]"
            style={{ color: INK }}
          >
            Terms of Service
          </h1>
          <p className="mt-6 text-[15px] leading-[1.65]" style={{ color: SUB }}>
            These terms govern your use of UIUXskills at{" "}
            <span style={{ color: INK }}>uiuxskills.com</span>.
            Last updated: May 2026.
          </p>
        </div>
      </section>

      {SECTIONS.map((s) => (
        <section key={s.heading} className="border-b" style={{ borderColor: BORDER_SOFT }}>
          <div className="mx-auto max-w-3xl px-6 lg:px-8 py-10">
            <h2
              className="text-[18px] font-medium tracking-[-0.012em]"
              style={{ color: INK }}
            >
              {s.heading}
            </h2>
            <p className="mt-3 text-[14px] leading-[1.7]" style={{ color: SUB }}>
              {s.body}
            </p>
          </div>
        </section>
      ))}

      <section>
        <div className="mx-auto max-w-3xl px-6 lg:px-8 py-10">
          <h2
            className="text-[18px] font-medium tracking-[-0.012em]"
            style={{ color: INK }}
          >
            Contact
          </h2>
          <p className="mt-3 text-[14px] leading-[1.7]" style={{ color: SUB }}>
            Questions about these terms?{" "}
            <a
              href="mailto:uiuxofai@gmail.com"
              className="underline"
              style={{ color: INK, fontFamily: MONO }}
            >
              uiuxofai@gmail.com
            </a>
          </p>
          <p className="mt-2 text-[11px]" style={{ color: MUTED, fontFamily: MONO }}>
            Last updated: May 2026
          </p>
        </div>
      </section>
    </>
  );
}
