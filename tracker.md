# Earshot — Tracker (interview-defense source of truth)

**Goal:** An agent that finds websites blind people can't use, fixes the code, and
verifies the fix by *listening* to the page. Two graders: A = axe-core violation
count (cheap, mechanical, ~30% of barriers); B = narration comprehension (the
contribution — judge a page from *only* the linear screen-reader output).

**Team:** two people. Ownership + branch map + merge protocol in committed `TEAM.md`
(`phase-1` → product core in `src/`; `phase-2` → sponsor evidence in `scripts/`
and later `dashboard/`).

## Phase status

| Phase | State | Evidence |
|---|---|---|
| 1 — Audit + Narrate + Judge | **GREEN (Grader B pending key)** | Live run on gov.uk: 2 violations, 150-line narration w/ 4 gaps, state saved to `out/`. Judge code complete; needs `FIREWORKS_API_KEY` for the score line. |
| 2 — Fix + prove improvement | **YELLOW (loop wired, needs improving patch/key)** | `feat/remediation` runs scan → plan → apply → verify. Live gov.uk run caught unsafe region patches, reverted them, and ended with `2 → 2`, `+0` added keys. Grader B still needs `FIREWORKS_API_KEY`. |
| 3 — Emit reviewable patch | not started | — |

## Data model (Phase 1)

`Target` → `SiteReport { violations[], violationCount, violationsByImpact, narration, judgment|null }`.
`Narration { lines[], transcript, gapCount, truncated }`. All in `src/types.ts`.
Raw axe JSON is reduced to `Violation` at the audit boundary — no raw axe object
escapes `audit()` (token-budget correctness, not optimisation).

Phase 2 adds `RemediationReport { before, after, patches, patchResults, flaggedItems, verify }`.
`Patch` is a Zod-validated discriminated union so LLM patch output can be parsed or
dropped by the same rule as Grader B.

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

### D6 — Freeze a shared remediation contract before branch work
- **Alternatives:**
  - *Ad hoc objects per file* — faster to start, but Branch A/Branch B drift immediately.
  - *Shared `RemediationReport` + `Patch` types in `src/types.ts`* (chosen) — costs a
    few minutes up front, but gives the teammate/scripts one stable JSON contract.
- **Why for this project:** this is a two-person hackathon repo; stable local JSON is
  the integration boundary, so the type contract is the cheapest way to avoid merge
  and interpretation bugs.
- **Interview line:** "The shared type was the branch boundary: code can move fast
  because the evidence JSON shape is frozen."

### D7 — Verify full violation sets and rollback on regression
- **Alternatives:**
  - *Keep any count-neutral/count-improving patch* — demos better numbers, but can hide
    new accessibility failures.
  - *Apply, rescan, compare `violationKeys`, rollback if new keys appear* (chosen) —
    slower and sometimes ends with no improvement, but never silently ships a worse page.
- **Why for this project:** a live gov.uk run proved the need: a naive `region` fix
  changed `2 → 5`; the rollback returned the final state to `+0` added keys.
- **Interview line:** "The verifier is allowed to reject the agent's own fix; that is
  what separates reviewable remediation from an overlay."

### D8 — Temporary demo target freeze: gov.uk + example fallback
- **Alternatives:**
  - *Spend time freezing five targets now* — better dataset story, but risks burning
    the core Phase 2 window.
  - *Use the Phase 1-verified gov.uk target and keep example.com as fallback* (chosen)
    — smaller demo surface, but lets the remediation loop be debugged immediately.
- **Why for this project:** Phase 2 correctness gates the sponsor/evidence layer; one
  known-loading target is enough to prove the loop before expanding the dataset.
- **Interview line:** "I froze the smallest target set that protected the demo path,
  then left dataset expansion as a separate sponsor/evidence task."

### D9 — ElevenLabs SDK with text fallback for audio evidence
- **Alternatives:**
  - *Raw REST call* — avoids a dependency, but adds hand-rolled binary stream handling
    under hackathon time pressure.
  - *Official `@elevenlabs/elevenlabs-js` SDK* (chosen) — adds one package, but the docs
    confirm it reads `ELEVENLABS_API_KEY` and returns a stream suitable for writing MP3s.
- **Why for this project:** the sponsor audio layer is a demo artifact, not the core
  accessibility engine; the fastest defensible path is official SDK + a non-blocking
  `.txt` fallback so invalid/missing TTS keys never block the video script.
- **Evidence:** `npm run audio -- out/phase2-1784925995566.json` writes before/after
  text fallbacks and exits 0; current ElevenLabs key returns 401 `invalid_api_key`, so
  MP3 output is pending a valid key.
- **Interview line:** "The audio layer is allowed to fail soft: text narration is the
  source of truth, and TTS is a presentation artifact."

## Framing guardrails (hard requirement, spec §8)
Never "automatically compliant" / "WCAG compliant" / "fully accessible". This project
produces **reviewable patches with verification evidence**; an agent proposes, a human
disposes; it flags what it cannot determine instead of guessing.
