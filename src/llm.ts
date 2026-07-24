import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import type { Page } from 'playwright';
import { PatchSchema, type FlaggedItem, type Patch, type Violation, type ViolationNode } from './types';

/**
 * LLM tier of the planner (spec §5b) + Fireworks model routing (§7.5).
 *
 * Deterministic tier (plan.ts) handles zero-judgment fixes with zero model calls.
 * Everything here needs semantic judgment: image-alt, label, button-name, link-name,
 * aria-*, heading-order. Routing is real, not a swap-and-stop:
 *   - image-alt / input-image-alt / label / button-name / link-name -> small model
 *   - aria-* / heading-order                                         -> large model
 *
 * Alt-text is the highest-risk output in this project (FTC v. accessiBe: AI-generated
 * alt text describing a filet mignon photo as "brown bread on white ceramic plate").
 * The prompt always carries surrounding text, any <figcaption>, and the link target —
 * pulled live from the page, not from the narration (tracker D2 drops /url: there for
 * a different consumer: Grader B must hear exactly what a screen reader hears).
 */

const BASE_URL = process.env.FIREWORKS_BASE_URL ?? 'https://api.fireworks.ai/inference/v1';
// Verified live against GET /v1/models with the real account key — deepseek-v3p1
// (tracker D5's old default) is no longer deployed and 404s. deepseek-v4-pro is
// the largest model currently deployed on this account.
const LARGE_MODEL = process.env.FIREWORKS_LARGE_MODEL ?? 'accounts/fireworks/models/deepseek-v4-pro';
// Smallest chat-capable model currently deployed on this account (of kimi-k2p6,
// glm-5p1, gpt-oss-120b, deepseek-v4-pro, glm-5p2) — there's no true small/8B model
// available, so "small tier" here means smallest of what's actually deployed.
const SMALL_MODEL = process.env.FIREWORKS_SMALL_MODEL ?? 'accounts/fireworks/models/gpt-oss-120b';

const SMALL_RULES = new Set(['image-alt', 'input-image-alt', 'label', 'button-name', 'link-name']);
const LARGE_RULES = new Set([
  'aria-valid-attr-value',
  'aria-required-attr',
  'aria-required-children',
  'aria-required-parent',
  'heading-order',
]);

function modelFor(violationId: string): string | null {
  if (SMALL_RULES.has(violationId)) return SMALL_MODEL;
  if (LARGE_RULES.has(violationId)) return LARGE_MODEL;
  return null;
}

// Structural fixes the LLM tier can propose. Deliberately NOT the full PatchSchema —
// the model never supplies violationId/html/selector; those come from ground truth
// (the axe node we're already iterating), never from model output.
const LLMResponseSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('setAttribute'), attribute: z.string(), value: z.string(), reasoning: z.string() }),
  z.object({ action: z.literal('setText'), value: z.string(), reasoning: z.string() }),
  z.object({ action: z.literal('flag_for_human'), reason: z.string(), reasoning: z.string() }),
]);

const CACHE_PATH = '.cache/llm-patches.json';
type CacheEntry = z.infer<typeof LLMResponseSchema>;
let cache: Record<string, CacheEntry> | null = null;

function loadCache(): Record<string, CacheEntry> {
  if (cache) return cache;
  try {
    cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, 'utf8')) : {};
  } catch {
    cache = {};
  }
  return cache!;
}

function saveCache(): void {
  if (!cache) return;
  mkdirSync('.cache', { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

function cacheKey(violationId: string, html: string): string {
  return `${violationId}::${createHash('sha1').update(html).digest('hex')}`;
}

export type LLMStats = {
  calls: number;
  cacheHits: number;
  promptTokens: number;
  completionTokens: number;
  costPerFix: Array<{ selector: string; violationId: string; tokens: number; cached: boolean }>;
};

function newStats(): LLMStats {
  return { calls: 0, cacheHits: 0, promptTokens: 0, completionTokens: 0, costPerFix: [] };
}

type PageContext = { surroundingText: string; figcaption: string; linkHref: string };

async function extractContext(page: Page, selector: string): Promise<PageContext | null> {
  try {
    return await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const surroundingText = (el.parentElement?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
      const figure = el.closest('figure');
      const figcaption = figure?.querySelector('figcaption')?.textContent?.trim().slice(0, 200) ?? '';
      const anchor = el.closest('a') as HTMLAnchorElement | null;
      const linkHref = anchor?.getAttribute('href') ?? '';
      return { surroundingText, figcaption, linkHref };
    }, selector);
  } catch {
    return null;
  }
}

const SYSTEM = `You fix web accessibility violations, one at a time. You get the axe-core rule id, its help text, the offending HTML, and page context: nearby text, a <figcaption> if present, and the link target if the element sits inside a link.

Return JSON only, exactly one of these shapes:
{"action":"setAttribute","attribute":"...","value":"...","reasoning":"one sentence"}
{"action":"setText","value":"...","reasoning":"one sentence"}
{"action":"flag_for_human","reason":"one sentence","reasoning":"one sentence"}

Rules:
- image-alt / input-image-alt: setAttribute attribute="alt". Describe only what the surrounding text/figcaption/context actually establishes. If you cannot confidently determine what the image shows from the given context, return flag_for_human — never invent plausible-sounding specifics (a wrong but confident alt text is worse than a flag).
- label / button-name / link-name: setAttribute attribute="aria-label" with a short accessible name derived from context (including the link target, if present). If the purpose is genuinely unclear, return flag_for_human.
- aria-* rules: setAttribute with the correct ARIA attribute per the help text. If the correct value isn't unambiguous, return flag_for_human.
- heading-order: this needs document restructuring, not a single attribute. Always return flag_for_human unless there is a truly unambiguous single-attribute fix.

Never guess. A good flag rate is a feature, not a failure.`;

function userPrompt(violationId: string, help: string, node: ViolationNode, ctx: PageContext | null): string {
  const context = ctx
    ? [
        ctx.surroundingText && `Surrounding text: "${ctx.surroundingText}"`,
        ctx.figcaption && `Figcaption: "${ctx.figcaption}"`,
        ctx.linkHref && `Link target: ${ctx.linkHref}`,
      ]
        .filter(Boolean)
        .join('\n')
    : '(no additional context available)';

  return `Rule: ${violationId}
Help: ${help}
HTML: ${node.html}
Failure: ${node.failureSummary}

Context:
${context || '(none found)'}

Return JSON only.`;
}

async function callFireworks(
  model: string,
  prompt: string,
): Promise<{ ok: true; raw: string; promptTokens: number; completionTokens: number } | { ok: false; error: string }> {
  const key = process.env.FIREWORKS_API_KEY;
  if (!key) return { ok: false, error: 'FIREWORKS_API_KEY not set' };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 1500,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!res.ok) {
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        return { ok: false, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      return {
        ok: true,
        raw: data.choices?.[0]?.message?.content ?? '',
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
      };
    } catch (err) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      return { ok: false, error: `request failed: ${err instanceof Error ? err.message : err}` };
    }
  }
  return { ok: false, error: 'unreachable' };
}

function parseResponse(raw: string): CacheEntry | null {
  if (!raw.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Reasoning models sometimes emit their chain-of-thought before the JSON
    // despite response_format: json_object — take from the LAST '{' to the last
    // '}', since the final answer comes after any reasoning prose (which can
    // itself contain stray braces earlier in the string).
    const start = raw.lastIndexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) return null;
    try {
      parsed = JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  // Some models emit {"type": "setAttribute", ...} instead of the requested
  // {"action": "setAttribute", ...}. Normalize rather than reject — the schema
  // discriminant is a naming convention, not the model's actual decision.
  if (parsed && typeof parsed === 'object' && !('action' in parsed) && 'type' in parsed) {
    parsed = { ...parsed, action: (parsed as { type: unknown }).type };
  }
  const result = LLMResponseSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

function toPatch(entry: CacheEntry, violationId: string, node: ViolationNode): Patch | null {
  const base = { violationId, selector: node.target, html: node.html };
  const candidate =
    entry.action === 'setAttribute'
      ? { ...base, action: 'setAttribute' as const, attribute: entry.attribute, value: entry.value, reasoning: entry.reasoning }
      : entry.action === 'setText'
        ? { ...base, action: 'setText' as const, value: entry.value, reasoning: entry.reasoning }
        : { ...base, action: 'flag_for_human' as const, reason: entry.reason, reasoning: entry.reasoning };

  // Final defense: never trust constructed output either. Same rule as Grader B —
  // safeParse or drop, never coerce.
  const parsed = PatchSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

const MAX_CALLS_PER_SITE = 40;

/**
 * Route every semantic violation node through the small/large Fireworks tier,
 * cached by `${violationId}::${htmlHash}` on disk so a killed/restarted run
 * (or a rate limit hit late) never re-spends on the same fix.
 */
export async function planLLMPatches(
  page: Page,
  violations: Violation[],
): Promise<{ patches: Patch[]; flaggedItems: FlaggedItem[]; stats: LLMStats }> {
  const store = loadCache();
  const stats = newStats();
  const patches: Patch[] = [];
  const flaggedItems: FlaggedItem[] = [];
  let calls = 0;

  for (const violation of violations) {
    const model = modelFor(violation.id);
    if (!model) continue; // deterministic tier already handled it, or unrouted rule

    for (const node of violation.nodes) {
      if (calls >= MAX_CALLS_PER_SITE) {
        flaggedItems.push({
          action: 'flag_for_human',
          violationId: violation.id,
          selector: node.target,
          html: node.html,
          reasoning: `Skipped: over the ${MAX_CALLS_PER_SITE}-call per-site LLM cap.`,
          reason: 'over per-site cap',
        });
        continue;
      }

      const key = cacheKey(violation.id, node.html);
      let entry = store[key];
      let cached = Boolean(entry);

      if (!entry) {
        calls++;
        stats.calls++;
        const ctx = await extractContext(page, node.target);
        const prompt = userPrompt(violation.id, violation.help, node, ctx);
        const response = await callFireworks(model, prompt);

        if (!response.ok) {
          flaggedItems.push({
            action: 'flag_for_human',
            violationId: violation.id,
            selector: node.target,
            html: node.html,
            reasoning: `Model call failed: ${response.error}`,
            reason: 'model call failed',
          });
          continue;
        }

        stats.promptTokens += response.promptTokens;
        stats.completionTokens += response.completionTokens;
        stats.costPerFix.push({
          selector: node.target,
          violationId: violation.id,
          tokens: response.promptTokens + response.completionTokens,
          cached: false,
        });

        const parsed = parseResponse(response.raw);
        if (!parsed) {
          flaggedItems.push({
            action: 'flag_for_human',
            violationId: violation.id,
            selector: node.target,
            html: node.html,
            reasoning: `Unparseable model output, dropped rather than coerced: ${response.raw.slice(0, 120)}`,
            reason: 'unparseable model output',
          });
          continue;
        }

        entry = parsed;
        store[key] = entry;
        saveCache();
      } else {
        stats.cacheHits++;
        stats.costPerFix.push({ selector: node.target, violationId: violation.id, tokens: 0, cached: true });
      }

      const patch = toPatch(entry, violation.id, node);
      if (!patch) {
        flaggedItems.push({
          action: 'flag_for_human',
          violationId: violation.id,
          selector: node.target,
          html: node.html,
          reasoning: 'Constructed patch failed PatchSchema validation, dropped rather than coerced.',
          reason: 'schema mismatch',
        });
        continue;
      }

      if (patch.action === 'flag_for_human') flaggedItems.push(patch);
      else patches.push(patch);
    }
  }

  return { patches, flaggedItems, stats };
}

export function logLLMStats(label: string, stats: LLMStats, flaggedCount: number, patchCount: number): void {
  const totalTokens = stats.promptTokens + stats.completionTokens;
  const attempted = flaggedCount + patchCount;
  const flagRate = attempted ? Math.round((flaggedCount / attempted) * 100) : 0;
  console.log(
    `\nLLM tier — ${label}: ${stats.calls} call(s), ${stats.cacheHits} cache hit(s), ` +
      `${totalTokens} tokens (${stats.promptTokens} prompt / ${stats.completionTokens} completion), ` +
      `flag rate ${flagRate}% (${flaggedCount}/${attempted})`,
  );
}
