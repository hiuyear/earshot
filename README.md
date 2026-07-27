# Earshot

Finds websites blind users can't navigate, generates **reviewable code fixes**, and
verifies each fix by *listening* to the page — the way a screen reader actually
presents it, not the way it looks.

Automated accessibility scanners (axe-core) catch roughly 25–33% of real barriers.
They happily pass `alt="image123"`. They can't tell you the reading order is
incoherent. The rest of the gap needs a human with a screen reader — the expensive,
unscalable bottleneck this project targets.

**Earshot generates reviewable patches with verification evidence. An agent
proposes; a human disposes.** It flags what it cannot determine instead of
guessing, and it never claims a site is "compliant" or "fully accessible."

## The two graders

- **Grader A** (cheap, mechanical) — axe-core violation count. Fast, deterministic,
  catches the obvious ~30%.
- **Grader B** (the contribution) — serialize the page into the linear narration a
  screen reader would produce, then ask an LLM judge whether a person could actually
  understand and navigate the page *from that narration alone*, with no visual
  access. This catches what scanners miss: incoherent reading order, unlabeled
  controls, structure that "passes" but is unusable in practice.

## Pipeline

```
targets.json
    │
    ▼
 CRAWLER ──► AUDITOR ──► PLANNER ──► PATCHER ──► VERIFIER
(playwright)  (axe-core)  (deterministic  (DOM        │
                           + Fireworks)    mutation)   ├─► axe re-scan        (Grader A)
                                                       └─► NARRATOR ─► JUDGE  (Grader B)
                                                             │
                                                        PATCH EMITTER ─► git branch ─► PR
```

1. **Crawl** (`src/scan.ts`) — load each target with Playwright, settle the page.
2. **Audit** (`src/audit.ts`) — run axe-core; reduce raw results to a small
   `Violation` shape so raw axe JSON never reaches an LLM prompt.
3. **Narrate** (`src/narrate.ts`) — walk the accessibility tree with
   `locator.ariaSnapshot()` and render linear screen-reader text:
   `heading level 1, "..."`, `image, unlabeled`, `button, unlabeled`.
   Unlabeled/blank elements are never skipped — **the gaps are the signal**.
4. **Judge** (`src/judge.ts`) — Grader B. One Fireworks call over *only* the
   narration (never the visual page). Returns purpose, actions, unclear items,
   and a 1–5 comprehension score. Zod-validated; bad output is dropped, never
   coerced into a fake score.
5. **Plan** (`src/plan.ts` + `src/llm.ts`) — two tiers:
   - *Deterministic* (zero model calls): `html-has-lang`, skip links, `region`,
     `duplicate-id`.
   - *LLM tier*: `image-alt` / `label` / `button-name` / `link-name` on a small
     model; `aria-*` / `heading-order` on a larger model. The model must return
     `flag_for_human` when uncertain — a high flag rate is a feature. Only
     allow-listed accessibility attributes can be set.
6. **Patch** (`src/patch.ts`) — apply mutations to the live page via
   `page.evaluate`, keyed by axe selector.
7. **Verify** (`src/verify.ts`) — re-audit and re-narrate/re-judge. Diff full
   violation *sets*, not just counts. **Revert any patch that introduces a new
   violation.** The verifier is allowed to reject the agent's own fix.
8. **Emit** (`src/emit.ts`) — snapshot HTML, write evidence under
   `patches/<site>/`, open a reviewable PR in this repo (not a claim of landing
   on the target site's codebase).

## Quick start

```bash
npm install
npx playwright install chromium
cp .env.example .env   # fill in keys — see below
npm run audit          # full pipeline on targets.json
# or one URL:
npm run audit -- https://example.com
```

| Command | What it does |
|---|---|
| `npm run audit` | Scan → plan → patch → verify → emit across the 5 frozen targets (or one URL) |
| `npm run audio -- out/<report>.json` | ElevenLabs before/after narration audio; always writes `.txt` fallback |
| `npm run braintrust -- out/<report>.json` | Deterministic metrics + Grader B scores to Braintrust |
| `npm run sandbox` | Daytona isolated-execution smoke (local fallback if no key) |
| `npm run dashboard` | Generate `dashboard/index.html` from saved `out/*.json` evidence |
| `npm run typecheck` | `tsc --noEmit` |

**Env vars** (full list in `.env.example`):

| Variable | Needed for |
|---|---|
| `FIREWORKS_API_KEY` | Grader B + LLM patch tier (Grader A + narration work without it) |
| `ELEVENLABS_API_KEY` | MP3 narration audio (optional; text fallback always works) |
| `BRAINTRUST_API_KEY` | Experiment logging (optional) |
| `DAYTONA_API_KEY` | Sandbox evidence (optional) |

`gh` (GitHub CLI) must be authenticated for `src/emit.ts` to open real PRs. Without
it, the patch proposal and local branch are still created.

## Framing (hard requirement)

The dominant player in this space, accessiBe, paid a $1,000,000 FTC settlement over
claims its AI could make any website WCAG-compliant. This project never says:

- "automatically compliant" / "WCAG compliant"
- "fully accessible" / "solves accessibility"
- any claim of guaranteed legal compliance

It says: **reviewable patches with verification evidence**, **an agent proposes, a
human disposes**, **flags what it cannot determine instead of guessing**.

## Layout

| Path | Role |
|---|---|
| `src/narrate.ts` | Page → linear screen-reader narration (core contribution) |
| `src/audit.ts` | Grader A — axe results reduced at the boundary |
| `src/judge.ts` | Grader B — narration-only Fireworks judge, Zod-validated |
| `src/plan.ts` / `src/llm.ts` | Deterministic + LLM patch planning |
| `src/patch.ts` | Apply / revert DOM patches |
| `src/verify.ts` | Re-scan + set-diff; rollback on regression |
| `src/emit.ts` | Evidence files, git branch, reviewable PR |
| `src/index.ts` | Orchestration + `out/` persistence |
| `src/types.ts` | Shared contract (`SiteReport`, `RemediationReport`, `Patch`) |
| `scripts/audio.ts` | ElevenLabs before/after audio |
| `scripts/braintrust.ts` | Metrics / experiment logging |
| `scripts/sandbox.ts` | Daytona sandbox evidence |
| `scripts/dashboard.ts` | Static evidence dashboard generator |
| `targets.json` | 5 frozen demo targets (probed, real, no login wall) |

## Docs

- `tracker.md` — architectural decisions with alternatives (interview defense)
- `learn.md` — lessons from the build
- `TEAM.md` — branch ownership / merge protocol
- `earshot_spec.md` — original build spec

## What this is not

Earshot does not guarantee legal compliance, does not replace a human accessibility
review, and cannot verify that an LLM-authored fix (e.g. alt text) is *substantively
correct* — only that it doesn't regress axe's violation set. That gap is why every
LLM-tier fix ships with reasoning, uncertain cases are flagged, and every patch is a
PR for a human to review.

## Stack

TypeScript + Node · Playwright · axe-core · Zod · Fireworks · ElevenLabs · Braintrust · Daytona

Local JSON state in `out/*.json`. No database.
