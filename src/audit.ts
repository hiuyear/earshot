import AxeBuilder from '@axe-core/playwright';
import type { Page } from 'playwright';
import { HTML_TRUNCATE, type Violation } from './types';

const IMPACTS = ['minor', 'moderate', 'serious', 'critical'] as const;

function normalizeImpact(impact: string | null | undefined): Violation['impact'] {
  return (IMPACTS as readonly string[]).includes(impact ?? '')
    ? (impact as Violation['impact'])
    : 'unknown';
}

/**
 * GRADER A — the cheap, mechanical grader.
 *
 * Deterministic and fast, but it only catches the obvious ~30% of real barriers.
 * It will happily pass `alt="image123"`. That ceiling is exactly why Grader B
 * (narration comprehension) exists.
 *
 * The reduction is not an optimisation, it is a correctness measure: raw AxeResults
 * carries the full check tree and un-truncated outerHTML per node, which blows the
 * token budget the moment it reaches an LLM prompt (spec §13, failure mode #1).
 * We reduce at the boundary so no raw axe object ever escapes this function.
 */
export async function audit(page: Page): Promise<Violation[]> {
  const results = await new AxeBuilder({ page }).analyze();

  return results.violations.map((v) => ({
    id: v.id,
    impact: normalizeImpact(v.impact),
    help: v.help,
    nodes: v.nodes.map((n) => ({
      target: String(n.target[0] ?? ''),
      html: (n.html ?? '').slice(0, HTML_TRUNCATE),
      failureSummary: n.failureSummary ?? '',
    })),
  }));
}

/** Total failing elements, not rule count — one rule can fail on 40 nodes. */
export function countNodes(violations: Violation[]): number {
  return violations.reduce((sum, v) => sum + v.nodes.length, 0);
}

export function byImpact(violations: Violation[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of violations) {
    out[v.impact] = (out[v.impact] ?? 0) + v.nodes.length;
  }
  return out;
}

/**
 * Stable identity for a single failing element: `ruleId::selector`.
 *
 * Phase 2 compares full violation SETS, not counts — a fix that removes two
 * violations while introducing one is a net win by count but may have broken
 * something. Set comparison catches that; counts hide it.
 */
export function violationKeys(violations: Violation[]): Set<string> {
  const keys = new Set<string>();
  for (const v of violations) {
    for (const n of v.nodes) keys.add(`${v.id}::${n.target}`);
  }
  return keys;
}
