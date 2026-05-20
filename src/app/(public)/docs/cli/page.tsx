import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SectionLabel } from "@/components/ui/Shell";
import {
  BORDER,
  BORDER_SOFT,
  INK,
  LIME,
  MONO,
  MUTED,
  SUB,
  SURFACE,
  SURFACE_2,
} from "@/lib/ui-data/tokens";
import { TOOLS } from "@/lib/ui-data/toolPref";
import { INSTALL_STEPS } from "@/lib/ui-data/installSteps";

const COMMANDS: { cmd: string; what: string }[] = [
  { cmd: "npx uiuxofai add <id>", what: "Drop a bundle, skill, agent, or MCP into your project at the right per-tool path." },
  { cmd: "npx uiuxofai list", what: "Print the catalogue of bundles, skills, agents, and MCPs." },
  { cmd: "npx uiuxofai verify", what: "Check that an installed bundle's tokens are wired up." },
];

export function CliDocs() {
  return (
    <>
      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-3xl px-6 lg:px-8 pt-16 pb-12">
          <SectionLabel t="CLI" />
          <h1 className="mt-4 text-[44px] sm:text-[54px] leading-[1.02] font-medium tracking-[-0.022em]">
            One command,
            <br />
            <span style={{ color: SUB }}>any bundle, any tool.</span>
          </h1>
          <p className="mt-6 text-[15px] leading-[1.65]" style={{ color: SUB }}>
            The UIUXofAi CLI installs anything from the library directly into your project. Pick a
            bundle on its detail page, copy the install command, paste it in your terminal.
          </p>
        </div>
      </section>

      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-3xl px-6 lg:px-8 py-14">
          <SectionLabel t="Install" />
          <h2 className="mt-3 text-[28px] leading-[1.08] font-medium tracking-[-0.018em]">
            No global install needed.
          </h2>
          <div
            className="mt-6 rounded-xl border p-5"
            style={{ borderColor: BORDER, background: SURFACE }}
          >
            <div
              className="text-[10.5px] uppercase tracking-[0.22em] mb-2"
              style={{ fontFamily: MONO, color: MUTED }}
            >
              run it once with npx
            </div>
            <div
              className="rounded-md border px-3 py-2 text-[13px]"
              style={{
                borderColor: BORDER,
                background: SURFACE_2,
                color: INK,
                fontFamily: MONO,
              }}
            >
              npx uiuxofai@latest add linear
            </div>
            <div className="text-[11.5px] mt-3" style={{ color: SUB }}>
              Requires Node 18+. No account, no auth — the package fetches files from this site.
            </div>
          </div>
        </div>
      </section>

      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-3xl px-6 lg:px-8 py-14">
          <SectionLabel t="Commands" />
          <h2 className="mt-3 text-[28px] leading-[1.08] font-medium tracking-[-0.018em]">
            Three commands,{" "}
            <span style={{ color: SUB }}>that's the whole surface.</span>
          </h2>
          <ul className="mt-6 space-y-3">
            {COMMANDS.map((c) => (
              <li
                key={c.cmd}
                className="rounded-lg border p-4"
                style={{ borderColor: BORDER, background: SURFACE }}
              >
                <div
                  className="text-[12.5px]"
                  style={{ fontFamily: MONO, color: INK }}
                >
                  {c.cmd}
                </div>
                <div className="text-[12.5px] mt-1.5" style={{ color: SUB }}>
                  {c.what}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-b" style={{ borderColor: BORDER_SOFT }}>
        <div className="mx-auto max-w-3xl px-6 lg:px-8 py-14">
          <SectionLabel t="Per-tool placement" />
          <h2 className="mt-3 text-[28px] leading-[1.08] font-medium tracking-[-0.018em]">
            Where the files land.
          </h2>
          <p className="mt-5 text-[13.5px] leading-[1.6]" style={{ color: SUB }}>
            The CLI mirrors the same per-tool placement the install steps show on every detail page.
          </p>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TOOLS.map((t) => {
              const steps = INSTALL_STEPS[t.id];
              const placement = steps.find((s) => s.cmd)?.cmd ?? steps[0]?.t ?? "";
              return (
                <div
                  key={t.id}
                  className="rounded-lg border p-4"
                  style={{ borderColor: BORDER, background: SURFACE }}
                >
                  <div
                    className="text-[10.5px] uppercase tracking-[0.22em] mb-2 inline-flex items-center gap-1.5"
                    style={{ fontFamily: MONO, color: MUTED }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIME }} />
                    {t.label}
                  </div>
                  <div
                    className="text-[12px]"
                    style={{ fontFamily: MONO, color: SUB }}
                  >
                    {placement}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-3xl px-6 lg:px-8 py-14">
          <Link
            href="/library"
            className="inline-flex items-center gap-1.5 text-[12.5px]"
            style={{ color: INK }}
          >
            Browse the library
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    </>
  );
}

export default CliDocs;
