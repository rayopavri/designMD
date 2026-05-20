/**
 * Thin wrapper over the official @google/design.md linter.
 *
 * Returns a normalised report we use for:
 *   - coverage scoring
 *   - reviewer-facing summary
 *   - derived "don't" rules that get woven back into the design.md
 */
// Dynamic import — @google/design.md is ESM-only and the rest of our toolchain
// (tsx scripts, Next.js bundling) needs the lazy load to resolve cleanly.
import type { LintReport, Finding, LintOptions } from '@google/design.md/linter';
import { CUSTOM_RULES } from './custom-rules';

let _lintFn: ((content: string, opts?: LintOptions) => LintReport) | null = null;
let _defaultRules: unknown[] | null = null;

async function getLint() {
  if (_lintFn && _defaultRules) return { lint: _lintFn, defaultRules: _defaultRules };
  const mod = (await import('@google/design.md/linter')) as {
    lint: (c: string, opts?: LintOptions) => LintReport;
    DEFAULT_RULES: unknown[];
  };
  _lintFn = mod.lint;
  _defaultRules = mod.DEFAULT_RULES;
  return { lint: _lintFn, defaultRules: _defaultRules };
}

export interface LintSummary {
  /** Raw linter report. */
  report: LintReport;
  /** WCAG contrast failures (severity warning, contrast-ratio rule). */
  contrastFailures: ContrastFailure[];
  /** Orphaned-token warnings — tokens defined but never used by a component. */
  orphanTokens: string[];
  /** Other warnings (broken refs, missing typography, etc.). */
  otherWarnings: string[];
  /** True if no error-severity findings AND no contrast failures AND no orphans. */
  passes: boolean;
  /** Section heading names found in the doc. */
  sections: string[];
  /** Counts per severity. */
  counts: { errors: number; warnings: number; infos: number };
  /** Derived donts ready to feed back into the design.md generator. */
  derivedDonts: string[];
}

export interface ContrastFailure {
  componentPath: string;
  message: string;
}

export async function lintDesignMd(content: string): Promise<LintSummary> {
  const { lint, defaultRules } = await getLint();
  // Layer our custom rules on top of the official defaults.
  const report = lint(content, {
    rules: [...(defaultRules as never[]), ...(CUSTOM_RULES as never[])],
  });

  const contrastFailures: ContrastFailure[] = report.findings
    .filter((f) => f.message.toLowerCase().includes('contrast'))
    .filter((f) => f.severity === 'warning' || f.severity === 'error')
    .map((f) => ({
      componentPath: f.path ?? '(unknown)',
      message: f.message,
    }));

  const orphanTokens: string[] = [];
  const otherWarnings: string[] = [];
  for (const f of report.findings) {
    if (f.severity !== 'warning') continue;
    const isContrast = f.message.toLowerCase().includes('contrast');
    if (isContrast) continue;
    const isOrphan =
      f.message.toLowerCase().includes('never referenced') ||
      f.message.toLowerCase().includes('orphan');
    if (isOrphan) {
      orphanTokens.push(f.path ?? f.message);
    } else {
      otherWarnings.push(f.message);
    }
  }

  const errors = report.findings.filter((f) => f.severity === 'error').length;
  const warnings = report.findings.filter((f) => f.severity === 'warning').length;
  const infos = report.findings.filter((f) => f.severity === 'info').length;

  const passes =
    errors === 0 && contrastFailures.length === 0 && orphanTokens.length === 0;

  const derivedDonts = contrastFailures.map(
    (cf) => `Avoid the combination at ${cf.componentPath}: ${cf.message}`,
  );

  return {
    report,
    contrastFailures,
    orphanTokens,
    otherWarnings,
    passes,
    sections: report.sections ?? [],
    counts: { errors, warnings, infos },
    derivedDonts,
  };
}

/**
 * Render a short public-facing accessibility note. Returns null when the
 * brand has no contrast issues. Kept terse — designers can dig deeper if
 * they care. Format: "<count> color combinations don't meet WCAG AA"
 * followed by the raw pair list as plain text (no markdown bold).
 */
export function renderAccessibilityAdvisory(s: LintSummary): string | null {
  if (s.contrastFailures.length === 0) return null;
  const count = s.contrastFailures.length;
  const head = `${count} color combination${count === 1 ? '' : 's'} don't meet WCAG AA. Verify before shipping.`;
  const pairs = s.contrastFailures.map((cf) => `${cf.componentPath}: ${cf.message}`);
  return [head, ...pairs].join('\n');
}

/** Convenience: render a one-page reviewer summary. */
export function renderLintSummary(s: LintSummary): string {
  const lines: string[] = [
    `Linter: ${s.passes ? 'PASS' : 'FAIL'}`,
    `Findings: errors=${s.counts.errors} warnings=${s.counts.warnings} infos=${s.counts.infos}`,
    `Sections: ${s.sections.join(' → ')}`,
  ];
  if (s.contrastFailures.length > 0) {
    lines.push('Contrast failures:');
    for (const cf of s.contrastFailures) {
      lines.push(`  - ${cf.componentPath}: ${cf.message}`);
    }
  }
  const otherFindings = s.report.findings.filter(
    (f: Finding) => !f.message.toLowerCase().includes('contrast'),
  );
  if (otherFindings.length > 0) {
    lines.push('Other findings:');
    for (const f of otherFindings.slice(0, 12)) {
      lines.push(`  [${f.severity}] ${f.path ?? ''} ${f.message}`);
    }
  }
  return lines.join('\n').slice(0, 4000);
}
