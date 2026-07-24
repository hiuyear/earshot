import type { Page } from 'playwright';
import type { FlaggedItem, Patch, Violation } from './types';
import { planLLMPatches, logLLMStats, type LLMStats } from './llm';

export type PatchPlan = {
  patches: Patch[];
  flaggedItems: FlaggedItem[];
};

const HUMAN_RULES = new Set([
  'image-alt',
  'input-image-alt',
  'label',
  'button-name',
  'link-name',
  'aria-valid-attr-value',
  'aria-required-attr',
  'aria-required-children',
  'aria-required-parent',
  'heading-order',
]);

function flag(v: Violation, reason: string): FlaggedItem[] {
  return v.nodes.map((node) => ({
    action: 'flag_for_human',
    violationId: v.id,
    selector: node.target,
    html: node.html,
    reasoning: `Do not guess a fix for ${v.id}.`,
    reason,
  }));
}

function dedupe(patches: Patch[]): Patch[] {
  const seen = new Set<string>();
  const out: Patch[] = [];

  for (const patch of patches) {
    const key =
      patch.action === 'setAttribute'
        ? `${patch.action}:${patch.selector}:${patch.attribute}:${patch.value}`
        : `${patch.action}:${'selector' in patch ? patch.selector : ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(patch);
  }

  return out;
}

/**
 * Deterministic tier: propose only patches that do not require visual judgment.
 * Anything semantic or content-dependent is flagged for a human/LLM tier.
 */
export function planDeterministicPatches(violations: Violation[]): PatchPlan {
  const patches: Patch[] = [];
  const flaggedItems: FlaggedItem[] = [];

  for (const violation of violations) {
    if (violation.id === 'html-has-lang' || violation.id === 'valid-lang') {
      patches.push({
        action: 'setLang',
        violationId: violation.id,
        value: 'en',
        reasoning: 'The document needs an explicit language for screen-reader pronunciation.',
      });
      continue;
    }

    if (violation.id === 'bypass') {
      patches.push({
        action: 'insertSkipLink',
        violationId: violation.id,
        selector: 'body',
        href: '#main',
        text: 'Skip to main content',
        reasoning: 'A skip link gives keyboard and screen-reader users a path past repeated navigation.',
      });
      continue;
    }

    if (violation.id === 'region') {
      for (const node of violation.nodes) {
        patches.push({
          action: 'setAttribute',
          violationId: violation.id,
          selector: node.target,
          html: node.html,
          attribute: 'role',
          value: 'main',
          reasoning: 'Content outside landmarks needs a navigable region; role=main is the smallest demo fix.',
        });
      }
      continue;
    }

    if (violation.id === 'duplicate-id') {
      for (const [index, node] of violation.nodes.entries()) {
        patches.push({
          action: 'setAttribute',
          violationId: violation.id,
          selector: node.target,
          html: node.html,
          attribute: 'id',
          value: `earshot-deduped-${index + 1}`,
          reasoning: 'Duplicate ids break accessible references; suffixing restores uniqueness for the demo page.',
        });
      }
      continue;
    }

    if (HUMAN_RULES.has(violation.id)) {
      flaggedItems.push(
        ...flag(
          violation,
          'This violation depends on semantic intent or visual context, so the deterministic tier should not guess.',
        ),
      );
    }
  }

  return { patches: dedupe(patches), flaggedItems };
}

/**
 * Full planner: deterministic tier (zero model calls) + LLM tier for everything
 * that needs semantic judgment (spec §5b). The LLM tier supersedes the
 * deterministic tier's HUMAN_RULES flags — it either fixes them with routed
 * Fireworks calls or flags them with a specific reason, so a flagged item here
 * always carries a real "why," never a blanket "not attempted."
 */
export async function planPatches(
  page: Page,
  violations: Violation[],
): Promise<PatchPlan & { stats: LLMStats }> {
  const deterministic = planDeterministicPatches(violations);
  const llm = await planLLMPatches(page, violations);

  logLLMStats('this site', llm.stats, llm.flaggedItems.length, llm.patches.length);

  return {
    patches: dedupe([...deterministic.patches, ...llm.patches]),
    flaggedItems: llm.flaggedItems,
    stats: llm.stats,
  };
}
