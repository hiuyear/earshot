import { JudgmentSchema, type Judgment, type Narration } from './types';

/**
 * GRADER B — the contribution.
 *
 * We hand a model ONLY the linear narration a screen reader would produce and ask
 * whether a blind user could accomplish the page's task from that alone. The model
 * never sees the visual page — that is the entire methodology. A high score has to be
 * earned from the same impoverished input a screen-reader user actually gets.
 *
 * Provider: Fireworks, OpenAI-compatible (verified against docs, not assumed):
 *   POST https://api.fireworks.ai/inference/v1/chat/completions
 *   Authorization: Bearer <key>
 *   model: accounts/fireworks/models/<id>
 *   response_format: { type: 'json_object' }
 * Model id is env-overridable; the default is a confirmed serverless id, not invented.
 */

const BASE_URL = process.env.FIREWORKS_BASE_URL ?? 'https://api.fireworks.ai/inference/v1';
const JUDGE_MODEL =
  process.env.FIREWORKS_JUDGE_MODEL ?? 'accounts/fireworks/models/deepseek-v3p1';

const SYSTEM = `You are given the complete linear output a screen reader would produce for a web page. You cannot see the page. Answer only from this text. Return JSON only.`;

function userPrompt(transcript: string): string {
  return `Here is the screen reader output:

"""
${transcript}
"""

1. What is this page for?
2. What actions can a user take?
3. List every element whose purpose is unclear or unlabeled.
4. Comprehension score 1-5: could a blind user accomplish this page's primary task using only what you were given? 1 = impossible, 5 = fully usable.

Return JSON only, exactly this shape:
{ "purpose": string, "actions": string[], "unclear": string[], "score": integer 1-5, "reasoning": string }`;
}

export type JudgeOutcome =
  | { ok: true; judgment: Judgment }
  | { ok: false; error: string };

/**
 * One LLM call, validated with Zod's safeParse — raw model output is never trusted.
 * A model that returns prose, an out-of-range score, or the wrong shape must fail
 * loudly here rather than silently poisoning the before/after scoreboard.
 */
export async function judge(narration: Narration): Promise<JudgeOutcome> {
  const key = process.env.FIREWORKS_API_KEY;
  if (!key) return { ok: false, error: 'FIREWORKS_API_KEY not set' };
  if (!narration.transcript.trim()) return { ok: false, error: 'empty narration' };

  let raw: string;
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: JUDGE_MODEL,
        temperature: 0,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: userPrompt(narration.transcript) },
        ],
      }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      return { ok: false, error: `HTTP ${res.status}: ${detail}` };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    raw = data.choices?.[0]?.message?.content ?? '';
  } catch (err) {
    return { ok: false, error: `request failed: ${err instanceof Error ? err.message : err}` };
  }

  if (!raw.trim()) return { ok: false, error: 'model returned empty content' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Models sometimes wrap JSON in prose or fences despite json_object mode.
    const match = /\{[\s\S]*\}/.exec(raw);
    if (!match) return { ok: false, error: `non-JSON output: ${raw.slice(0, 120)}` };
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return { ok: false, error: `unparseable JSON: ${raw.slice(0, 120)}` };
    }
  }

  const result = JudgmentSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: `schema mismatch: ${result.error.issues[0]?.message ?? 'unknown'}` };
  }

  return { ok: true, judgment: result.data };
}
