/**
 * Custom lint rules layered on top of the official @google/design.md linter.
 *
 * The official linter enforces structural correctness (broken refs, WCAG,
 * section order, etc.). These rules add curation-grade quality checks
 * that the canonical spec doesn't mandate but our library demands.
 */
import type { DesignSystemState, Finding } from '@google/design.md/linter';

// ─── Rule: component-coverage ────────────────────────────────
// Every bundle in our library must define at least one variant of these
// primitives. AI tools consuming the spec need them to assemble real UIs.

const REQUIRED_PRIMITIVES = [
  'button',
  'card',
  'input',
  'link',
  'badge',
] as const;

export const componentCoverage = (state: DesignSystemState): Finding[] => {
  const names = Array.from(state.components.keys()).map((n) => n.toLowerCase());
  const findings: Finding[] = [];
  for (const required of REQUIRED_PRIMITIVES) {
    const hit = names.some((n) => n === required || n.startsWith(`${required}-`));
    if (!hit) {
      findings.push({
        severity: 'warning',
        path: `components.${required}`,
        message: `No '${required}' component variant defined. Bundles in the curated library are expected to ship the 5 core primitives: button, card, input, link, badge.`,
      });
    }
  }
  return findings;
};

// ─── Rule: typography-usage ─────────────────────────────────
// Every typography token should be referenced by a component (or the
// reviewer should justify why an unused level exists).

export const typographyUsage = (state: DesignSystemState): Finding[] => {
  const used = new Set<string>();
  for (const c of state.components.values()) {
    const typo = c.properties.get('typography');
    if (typeof typo === 'string') {
      const m = typo.match(/^\{typography\.([^}]+)\}$/);
      if (m) used.add(m[1]);
    }
  }
  const findings: Finding[] = [];
  for (const name of state.typography.keys()) {
    if (!used.has(name)) {
      // Info-only: typography tokens are also used directly by AI tools in
      // rendered layouts, not always through component definitions. Surfacing
      // for reviewer awareness without penalising the score.
      findings.push({
        severity: 'info',
        path: `typography.${name}`,
        message: `Typography token '${name}' is defined but not referenced by any component (may still be used directly in layouts).`,
      });
    }
  }
  return findings;
};

// ─── Export bundle ───────────────────────────────────────────
// Pass these into lint() via the rules option to layer them onto the
// default rule set.

export const CUSTOM_RULES = [componentCoverage, typographyUsage];
