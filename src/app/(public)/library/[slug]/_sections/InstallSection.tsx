"use client";

import { Check, Copy } from "lucide-react";
import { SectionLabel } from "@/components/ui/Shell";
import { PulseRow } from "@/components/ui/PulseRow";
import {
  BORDER,
  BORDER_SOFT,
  INK,
  INK_ON_LIGHT,
  LIME,
  MONO,
  MUTED,
  SUB,
  SURFACE,
  SURFACE_2,
} from "@/lib/ui-data/tokens";
import { INSTALL_STEPS } from "@/lib/ui-data/installSteps";
import { toolLabel, type ToolId } from "@/lib/ui-data/toolPref";
import { type Bundle } from "@/lib/ui-data/bundles";

export function InstallSection({
  bundle,
  tool,
  onHide,
  copyText,
  copiedSpec,
  copiedPrompt,
  n,
}: {
  bundle: Bundle;
  tool: ToolId;
  onHide: () => void;
  copyText: (text: string, kind: "spec" | "prompt") => void;
  copiedSpec: boolean;
  copiedPrompt: boolean;
  n: string;
}) {
  const designLines = bundle.designMd.split("\n").length;

  return (
    <section id="install-steps" className="border-b" style={{ borderColor: BORDER_SOFT }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-8 py-14">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-3">
            <SectionLabel n={n} t={`Install in ${toolLabel(tool)}`} />
            <h2 className="mt-3 text-[28px] leading-[1.08] font-medium tracking-[-0.018em]">
              Four steps,{" "}
              <span style={{ color: SUB }}>then you&apos;re shipping.</span>
            </h2>
            <p className="mt-5 text-[13.5px] leading-[1.6]" style={{ color: SUB }}>
              Copy each file as you go. Switch tools above to see the steps for a different surface.
            </p>
            <button
              onClick={onHide}
              className="mt-6 text-[12.5px] inline-flex items-center gap-1"
              style={{ color: MUTED }}
            >
              ← hide install steps
            </button>
          </div>
          <div className="col-span-12 lg:col-span-9">
            <div className="space-y-5">
              {INSTALL_STEPS[tool].map((s) => (
                <div key={s.n} className="flex items-start gap-4">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full shrink-0 text-[12px] font-medium"
                    style={{ background: INK, color: INK_ON_LIGHT }}
                  >
                    {s.n}
                  </span>
                  <div className="flex-1 pt-0.5">
                    <div className="text-[14px]" style={{ color: INK }}>
                      {s.t}
                    </div>
                    {s.cmd ? (
                      <div
                        className="mt-2 inline-block rounded-md px-2 py-1 text-[11.5px]"
                        style={{
                          background: SURFACE_2,
                          border: `1px solid ${BORDER}`,
                          color: SUB,
                          fontFamily: MONO,
                        }}
                      >
                        {s.cmd}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              <button
                onClick={() => copyText(bundle.designMd, "spec")}
                className="rounded-xl border p-5 text-left transition-colors"
                style={{ borderColor: copiedSpec ? `${LIME}88` : BORDER, background: SURFACE }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-[10.5px] uppercase tracking-[0.22em]"
                    style={{ fontFamily: MONO, color: MUTED }}
                  >
                    spec
                  </span>
                  {copiedSpec ? (
                    <Check className="h-4 w-4" style={{ color: LIME }} />
                  ) : (
                    <Copy className="h-4 w-4" style={{ color: SUB }} />
                  )}
                </div>
                <div className="text-[14px] font-medium" style={{ color: INK }}>
                  {copiedSpec ? "Copied ✓" : "Copy design.md"}
                </div>
                <div className="text-[11.5px] mt-1" style={{ color: SUB }}>
                  {designLines} lines · {bundle.tokens.toLocaleString()} tokens
                </div>
              </button>
              <button
                onClick={() => copyText(bundle.companionPrompt, "prompt")}
                className="rounded-xl border p-5 text-left transition-colors"
                style={{ borderColor: copiedPrompt ? `${LIME}88` : BORDER, background: SURFACE }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-[10.5px] uppercase tracking-[0.22em]"
                    style={{ fontFamily: MONO, color: MUTED }}
                  >
                    prompt
                  </span>
                  {copiedPrompt ? (
                    <Check className="h-4 w-4" style={{ color: LIME }} />
                  ) : (
                    <Copy className="h-4 w-4" style={{ color: SUB }} />
                  )}
                </div>
                <div className="text-[14px] font-medium" style={{ color: INK }}>
                  {copiedPrompt ? "Copied ✓" : "Copy companion prompt"}
                </div>
                <div className="text-[11.5px] mt-1" style={{ color: SUB }}>
                  calibrated for {bundle.worksWith.join(" · ")}
                </div>
              </button>
            </div>
            <PulseRow bundleId={bundle.id} />
          </div>
        </div>
      </div>
    </section>
  );
}
