import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How UIUXskills collects, uses, and protects your data.',
  alternates: { canonical: 'https://uiuxskills.com/legal/privacy' },
  openGraph: {
    title: 'Privacy Policy',
    description: 'How UIUXskills collects, uses, and protects your data.',
    url: 'https://uiuxskills.com/legal/privacy',
  },
};

import { SectionLabel } from "@/components/ui/Shell";
import { BORDER_SOFT, INK, MUTED, MONO, SUB } from "@/lib/ui-data/tokens";

const THIRD_PARTIES = [
  { name: "Firebase Auth", role: "Authentication — stores your email and auth tokens." },
  { name: "Supabase / Postgres", role: "Database — stores design skills, accounts, and usage data." },
  { name: "Upstash Redis", role: "Rate limiting — transiently stores IP addresses to enforce request limits." },
  { name: "Vercel", role: "Hosting and edge delivery — processes all requests." },
  { name: "Anthropic Claude API", role: "AI processing — submitted URLs and their scraped content are sent to generate design skills." },
  { name: "Google Gemini API", role: "AI processing — same as above; used in the generation pipeline." },
  { name: "Firecrawl", role: "Web scraping — submitted URLs are crawled to extract content for generation." },
];

export default function PrivacyPage() {
  return (
    <>
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-3xl px-6 lg:px-8 pt-16 pb-12">
          <SectionLabel t="Legal" />
          <h1
            className="mt-4 text-[44px] sm:text-[54px] leading-[1.02] font-medium tracking-[-0.022em]"
            style={{ color: INK }}
          >
            Privacy Policy
          </h1>
          <p className="mt-6 text-[15px] leading-[1.65]" style={{ color: SUB }}>
            This policy describes how UIUXskills collects and uses information when you use{" "}
            <span style={{ color: INK }}>uiuxskills.com</span>.
            Last updated: May 2026.
          </p>
        </div>
      </section>

      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-3xl px-6 lg:px-8 py-10">
          <h2 className="text-[18px] font-medium tracking-[-0.012em]" style={{ color: INK }}>
            What we collect
          </h2>
          <p className="mt-3 text-[14px] leading-[1.7]" style={{ color: SUB }}>
            We collect your email address when you sign in, URLs you submit for design skill generation,
            and basic usage data (pages visited, actions taken). We do not sell your data.
          </p>
        </div>
      </section>

      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-3xl px-6 lg:px-8 py-10">
          <h2 className="text-[18px] font-medium tracking-[-0.012em]" style={{ color: INK }}>
            How we use it
          </h2>
          <p className="mt-3 text-[14px] leading-[1.7]" style={{ color: SUB }}>
            Your email is used to authenticate you and associate generated design skills with your account.
            Submitted URLs are processed through our AI pipeline to produce design skills.
            Usage data helps us improve the service.
          </p>
        </div>
      </section>

      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-3xl px-6 lg:px-8 py-10">
          <h2 className="text-[18px] font-medium tracking-[-0.012em]" style={{ color: INK }}>
            Third-party services
          </h2>
          <p className="mt-3 text-[14px] leading-[1.7]" style={{ color: SUB }}>
            UIUXskills uses the following third-party services. Each has its own privacy policy.
          </p>
          <ul className="mt-5 space-y-4">
            {THIRD_PARTIES.map((t) => (
              <li key={t.name} className="flex gap-3">
                <span
                  className="shrink-0 text-[12px] font-medium pt-0.5"
                  style={{ color: INK, fontFamily: MONO, minWidth: "180px" }}
                >
                  {t.name}
                </span>
                <span className="text-[13.5px] leading-[1.6]" style={{ color: SUB }}>
                  {t.role}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-3xl px-6 lg:px-8 py-10">
          <h2 className="text-[18px] font-medium tracking-[-0.012em]" style={{ color: INK }}>
            Data retention
          </h2>
          <p className="mt-3 text-[14px] leading-[1.7]" style={{ color: SUB }}>
            Account data is retained until you delete your account. Generated design skills may remain
            after account deletion if they have been published. Contact us to
            request deletion.
          </p>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-3xl px-6 lg:px-8 py-10">
          <h2 className="text-[18px] font-medium tracking-[-0.012em]" style={{ color: INK }}>
            Contact
          </h2>
          <p className="mt-3 text-[14px] leading-[1.7]" style={{ color: SUB }}>
            Privacy questions or deletion requests:{" "}
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
