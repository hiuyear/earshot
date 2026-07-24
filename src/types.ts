import { z } from 'zod';

/**
 * Reduced axe-core output.
 *
 * Raw AxeResults is enormous — every violation carries the full `any`/`all`/`none`
 * check tree, related nodes, and un-truncated outerHTML. Feeding that to an LLM
 * (or even holding five sites' worth in memory) blows the token budget for no gain.
 * We keep only what the planner actually needs to write a patch.
 */
export type ViolationNode = {
  /** CSS selector — axe gives `nodes[].target[]`; we take the first entry. */
  target: string;
  /** Offending element markup, truncated to HTML_TRUNCATE chars. */
  html: string;
  failureSummary: string;
};

export type Violation = {
  /** axe rule id, e.g. "image-alt" */
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical' | 'unknown';
  help: string;
  nodes: ViolationNode[];
};

export const HTML_TRUNCATE = 300;

/** One line of the linear narration a screen reader would produce. */
export type NarrationLine = {
  /** ARIA role, e.g. "heading", "link", "img" */
  role: string;
  /** Accessible name, or '' when the element has none. */
  name: string;
  /** Heading level, when role === 'heading'. */
  level?: number;
  /** State suffixes surfaced by ariaSnapshot, e.g. ['checked', 'disabled']. */
  states: string[];
  /** True when this element is interactive/informative but has no accessible name. */
  isGap: boolean;
  /** The rendered screen-reader phrasing, e.g. `image, unlabeled`. */
  text: string;
};

export type Narration = {
  lines: NarrationLine[];
  /** The lines joined by \n — this is what Grader B and ElevenLabs consume. */
  transcript: string;
  /** Count of interactive/informative elements with no accessible name. */
  gapCount: number;
  /** True when the cap was hit and lines were dropped. */
  truncated: boolean;
};

/**
 * Grader B output. Zod-validated because raw model output is never trusted —
 * a model that returns prose instead of JSON must fail loudly, not poison the
 * scoreboard with a silently-coerced value.
 */
export const JudgmentSchema = z.object({
  purpose: z.string(),
  actions: z.array(z.string()),
  unclear: z.array(z.string()),
  score: z.number().int().min(1).max(5),
  reasoning: z.string(),
});

export type Judgment = z.infer<typeof JudgmentSchema>;

export type Target = {
  id: string;
  url: string;
  label: string;
};

/** Everything Phase 1 produces for a single URL. */
export type SiteReport = {
  target: Target;
  fetchedAt: string;
  /** Grader A */
  violations: Violation[];
  violationCount: number;
  violationsByImpact: Record<string, number>;
  /** Grader B inputs + output */
  narration: Narration;
  judgment: Judgment | null;
  judgeError: string | null;
};
