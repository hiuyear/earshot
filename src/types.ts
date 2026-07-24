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

/**
 * Phase 2/3 remediation contract.
 *
 * This is the shared branch boundary: Branch A can generate/apply patches while
 * Branch B can read the resulting reports without importing Playwright code.
 */
const BasePatchSchema = z.object({
  violationId: z.string(),
  selector: z.string(),
  html: z.string().optional(),
  reasoning: z.string(),
});

export const PatchSchema = z.discriminatedUnion('action', [
  BasePatchSchema.extend({
    action: z.literal('setAttribute'),
    attribute: z.string(),
    value: z.string(),
  }),
  BasePatchSchema.extend({
    action: z.literal('setText'),
    value: z.string(),
  }),
  z.object({
    action: z.literal('setLang'),
    violationId: z.string(),
    value: z.string(),
    reasoning: z.string(),
  }),
  z.object({
    action: z.literal('insertSkipLink'),
    violationId: z.string(),
    selector: z.string().default('body'),
    href: z.string().default('#main'),
    text: z.string().default('Skip to main content'),
    reasoning: z.string(),
  }),
  BasePatchSchema.extend({
    action: z.literal('flag_for_human'),
    reason: z.string(),
  }),
]);

export type Patch = z.infer<typeof PatchSchema>;
export type PatchAction = Patch['action'];

export type FlaggedItem = Extract<Patch, { action: 'flag_for_human' }>;

export type PatchResult = {
  patch: Patch;
  ok: boolean;
  reason: string | null;
  reverted: boolean;
  previousValue?: string | null;
  previousText?: string | null;
  inserted?: boolean;
};

export type VerifyResult = {
  beforeViolationCount: number;
  afterViolationCount: number;
  removedViolationKeys: string[];
  addedViolationKeys: string[];
  beforeJudgment: Judgment | null;
  afterJudgment: Judgment | null;
  beforeJudgeError: string | null;
  afterJudgeError: string | null;
};

export type RemediationReport = {
  target: Target;
  fetchedAt: string;
  before: SiteReport;
  after: SiteReport;
  patches: Patch[];
  patchResults: PatchResult[];
  flaggedItems: FlaggedItem[];
  verify: VerifyResult;
};
