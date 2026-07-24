# Earshot — Tracker (interview-defense source of truth)

**Goal:** An agent that finds websites blind people can't use, fixes the code, and
verifies the fix by *listening* to the page. Two graders: A = axe-core violation
count (cheap, mechanical, ~30% of barriers); B = narration comprehension (the
contribution — judge a page from *only* the linear screen-reader output).

**Team:** two people. Ownership + branch map + merge protocol in committed `TEAM.md`
(Hiuyan → `feat/remediation`, Phases 2–3; teammate → `feat/evidence`, sponsor layer).

## Phase status

| Phase | State | Evidence |
|---|---|---|
| 1 — Audit + Narrate + Judge | **GREEN (Grader B pending key)** | Live run on gov.uk: 2 violations, 150-line narration w/ 4 gaps, state saved to `out/`. Judge code complete; needs `FIREWORKS_API_KEY` for the score line. |
| 2 — Fix + prove improvement | not started | — |
| 3 — Emit reviewable patch | not started | — |

## Data model (Phase 1)

`Target` → `SiteReport { violations[], violationCount, violationsByImpact, narration, judgment|null }`.
`Narration { lines[], transcript, gapCount, truncated }`. All in `src/types.ts`.
Raw axe JSON is reduced to `Violation` at the audit boundary — no raw axe object
escapes `audit()` (token-budget correctness, not optimisation).

## Architectural decisions

### D1 — `locator.ariaSnapshot()` instead of `page.accessibility.snapshot()`
- **Context:** spec §4b mandates `page.accessibility.snapshot()`.
- **Reality:** that API was deprecated in Playwright 1.33 and is REMOVED in 1.61
  (`page.accessibility` is `undefined` at runtime — verified, not assumed).
- **Alternatives:**
  - *CDP `Accessibility.getFullAXTree`* — costs: Chromium-only, returns a flat node
    array we'd have to re-parent by hand, reimplements pruning ariaSnapshot already does.
  - *`locator.ariaSnapshot()`* (chosen) — public, supported, cross-browser; already
    prunes presentational nodes (`<img alt="">` correctly vanishes) and emits in
    document order. Cost: we depend on its YAML string format.
- **Why for this project:** least code, most correctness, and the risk (format
  dependence) is contained by keeping `parseAriaSnapshot` pure + unit-testable so a
  format change fails loudly in one place. Confirmed it emits unlabeled elements
  (`- img`, `- button`) — the gaps we need — before committing to it.
- **Interview line:** "The spec's API was removed two versions back; I verified the
  supported replacement actually surfaces the unlabeled gaps before building on it."

### D2 — Drop `/url:` lines from the narration
- A screen reader does not read link *targets* aloud. Feeding them to Grader B would
  leak information the blind user never receives and inflate the comprehension score.
  Kept out of narration; retained (later) for Phase 2 alt-text context — different consumer.
- **Interview line:** "Grader B must see exactly what a screen-reader user hears, no more."

### D3 — Sequential audit → narrate, not `Promise.all`
- axe injects and runs a large script *in the page*. Snapshotting the AX tree mid-run
  reflects axe's scaffolding, not the page. ~1s saved isn't worth a corrupted narration.

### D4 — Compare violation *sets*, not counts (`violationKeys` = `ruleId::selector`)
- Built in Phase 1 for Phase 2: a fix that removes 2 and adds 1 is a net win by count
  but may have broken something. Set diff catches the regression; counts hide it.

### D5 — Fireworks judge: `json_object` + Zod `safeParse`, model id env-overridable
- OpenAI-compatible (base/header/model-format/response_format all verified against
  Fireworks docs, not memorised). Default model `deepseek-v3p1` is a confirmed-real
  serverless id. Docs caveat: json_object mode requires also instructing JSON in the
  prompt or the model streams whitespace — done. Raw output never trusted: safeParse
  or the score is dropped, never coerced.

## Framing guardrails (hard requirement, spec §8)
Never "automatically compliant" / "WCAG compliant" / "fully accessible". This project
produces **reviewable patches with verification evidence**; an agent proposes, a human
disposes; it flags what it cannot determine instead of guessing.
