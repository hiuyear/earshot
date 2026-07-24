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
guessing, and it never claims a site is "compliant" or "fully accessible" — see
[Framing](#framing-a-hard-requirement) below.

## The two graders

- **Grader A** (cheap, mechanical) — axe-core violation count. Fast, deterministic,
  catches the obvious ~30%.
- **Grader B** (the contribution) — serialize the page into the linear narration a
  screen reader would produce, then ask an LLM judge whether a person could actually
  understand and navigate the page *from that narration alone*, with no visual
  access. This is the part nobody else automates, and it's what catches the other
  ~70%: incoherent reading order, unlabeled controls, structure that "passes" a
  scanner but is unusable in practice.

## Pipeline

```
targets.json
    │
    ▼
 CRAWLER ──► AUDITOR ──► PLANNER ──► PATCHER ──► VERIFIER
(playwright)  (axe-core)  (deterministic  (DOM        │
                           tier +          mutation)   ├─► axe re-scan        (Grader A)
                           Fireworks LLM               └─► NARRATOR ─► JUDGE  (Grader B)
                           tier)                             │           │
                                                        ElevenLabs   Braintrust
                                                             │
                                                        PATCH EMITTER ─► git branch ─► PR ─► CodeRabbit
```

1. **Crawl** (`src/scan.ts`) — load each target with Playwright, settle the page.
2. **Audit** (`src/audit.ts`) — run axe-core, reduce raw results to a small
   `Violation` shape at the boundary (raw axe JSON is enormous and will blow a
   token budget if it ever reaches an LLM prompt).
3. **Narrate** (`src/narrate.ts`) — walk the accessibility tree
   (`locator.ariaSnapshot()` — `page.accessibility.snapshot()` was removed in
   Playwright 1.61, see `tracker.md` D1) and render it as the linear text a screen
   reader would announce: `heading level 1, "..."`, `image, unlabeled`,
   `button, unlabeled`. **The gaps are the signal** — unlabeled/blank elements are
   never skipped, they're the whole point.
4. **Judge** (`src/judge.ts`) — Grader B. One Fireworks LLM call over *only* the
   narration text (never the visual page, never link targets — see D2), asking what
   the page is for, what a user can do, and a 1–5 comprehension score. Zod-validated;
   unparseable output is dropped, never coerced into a fake score.
5. **Plan** (`src/plan.ts` + `src/llm.ts`) — two tiers:
   - *Deterministic* (zero model calls): `html-has-lang`, skip links (`bypass`),
     `region`, `duplicate-id`.
   - *LLM tier*, real Fireworks model routing: `image-alt` / `label` /
     `button-name` / `link-name` → a small model; `aria-*` / `heading-order` → a
     larger model. Alt-text prompts carry surrounding text, any `<figcaption>`, and
     the link target — pulled live from the page at plan time, since alt-text is
     the single highest-risk output here (the FTC's case against accessiBe cited
     AI alt text describing a filet mignon photo as "brown bread on white ceramic
     plate"). The model must return `flag_for_human` when it isn't confident rather
     than guess — **a high flag rate is a feature, not a failure**. Disk-cached by
     `${violationId}::sha1(html)` so a killed run or a late rate limit never
     re-spends. Only an allow-listed set of accessibility-relevant HTML attributes
     can ever be set (defense against prompt injection from hostile page content —
     see `tracker.md` §Security).
6. **Patch** (`src/patch.ts`) — apply patches to the live page via `page.evaluate`,
   keyed by the axe selector.
7. **Verify** (`src/verify.ts`) — re-audit and re-narrate/re-judge, diff the full
   violation **sets** (not just counts — a fix that removes 2 violations and adds 1
   is a net win by count but may have broken something), and **revert any patch
   that adds a new violation**. The verifier is allowed to reject the agent's own
   fix; that's what separates this from an overlay.
8. **Emit** (`src/emit.ts`) — Phase 3. We don't own the target sites' source repos,
   so a literal PR against e.g. `urbannava.gov` isn't possible. Instead: snapshot
   the fetched HTML, diff it against Earshot's mutations, write full evidence
   (violations before/after, comprehension before/after, narration diff, every
   `flag_for_human` item) to `patches/<site>/`, commit to a local
   `fix/a11y-<site>-<timestamp>` branch, and open a PR **in this repo** as an
   explicitly-labeled reviewable proposal — never framed as a claim of landing on
   the target site's actual codebase. CodeRabbit reviews the PR automatically once
   opened.

## Framing (hard requirement)

The dominant player in this space, accessiBe, paid a $1,000,000 FTC settlement over
claims its AI could make any website WCAG-compliant; hundreds of businesses using
overlay widgets were sued anyway. This project never says:

- "automatically compliant" / "WCAG compliant"
- "fully accessible" / "solves accessibility"
- any claim of guaranteed legal compliance

It says: **reviewable patches with verification evidence**, **an agent proposes, a
human disposes**, **flags what it cannot determine instead of guessing**.

## Running it

```bash
npm install
npx playwright install chromium
cp .env.example .env   # fill in keys — see below
```

| Command | What it does |
|---|---|
| `npm run audit` | Full pipeline (scan → plan → patch → verify → emit) across the 5 frozen targets in `targets.json`. Pass a URL to override: `npm run audit -- https://example.com` |
| `npm run audio -- out/<report>.json` | ElevenLabs before/after narration audio for one report (the demo's cold open: "image, unlabeled. button, unlabeled."). Text-only fallback if the key is missing or a call fails — never blocks. |
| `npm run braintrust -- out/<report>.json` | Logs an experiment per target: deterministic scorers (violation delta, fix success rate, flag rate) + the Grader B comprehension score. |
| `npm run sandbox` | One isolated Daytona sandbox per target (untrusted third-party page execution belongs in a sandbox), REST-based, with a local-execution fallback. |
| `npm run dashboard` | Generates `dashboard/index.html` from committed `out/*.json` — before/after scores, narration diff, audio links, Braintrust/Daytona evidence. Static, no live crawling, no compliance claims. Keyboard-navigable and passes its own accessibility audit (see `learn.md`). |
| `npm run typecheck` | `tsc --noEmit` |

**Env vars** (`.env.example` has the full list): `FIREWORKS_API_KEY` (Grader B +
LLM tier — Grader A and narration still work without it), `ELEVENLABS_API_KEY`,
`BRAINTRUST_API_KEY`, `DAYTONA_API_KEY`. `gh` (GitHub CLI) needs to be installed and
authenticated separately for `src/emit.ts` to open real PRs — without it, the patch
proposal and local git branch still get created, just not pushed.

## Layout

| File | Role |
|---|---|
| `src/narrate.ts` | **The key function** — page → linear screen-reader narration. Parsing (`parseAriaSnapshot`) and rendering (`renderNode`) are split so the fragile string handling is browser-free testable. |
| `src/audit.ts` | Grader A — axe results reduced to a small `Violation` shape at the boundary. |
| `src/judge.ts` | Grader B — one Fireworks LLM call over *only* the narration, Zod-validated. |
| `src/plan.ts` | Deterministic patch tier + merges in the LLM tier. |
| `src/llm.ts` | LLM tier: Fireworks model routing, live page context for prompts, disk cache, attribute allow-list. |
| `src/patch.ts` | Apply/revert patches via `page.evaluate`, keyed by axe selector. |
| `src/verify.ts` | Re-audit + re-narrate + re-judge; diff violation sets. |
| `src/emit.ts` | Phase 3 — snapshot diff, evidence file, git branch, PR. |
| `src/scan.ts` | Load a page settled enough for both graders; run them. |
| `src/index.ts` | Orchestration — ties the pipeline together, prints the checkpoint, persists to `out/`. |
| `src/types.ts` | Shared contract (`SiteReport`, `RemediationReport`, `Patch` discriminated union) — the boundary between the product core and the evidence/dashboard layer. |
| `scripts/probe-targets.ts` | Vet candidate target sites by measurement (load time, violation count, narration gaps) before freezing `targets.json`. |
| `scripts/audio.ts` | ElevenLabs narration audio, with an LLM-summarize-then-truncate fail-safe for transcripts over ElevenLabs' 10k-character limit. |
| `scripts/braintrust.ts` | Braintrust experiment logging. |
| `scripts/sandbox.ts` | Daytona isolated-execution evidence. |
| `scripts/dashboard.ts` | Static evidence dashboard generator. |
| `targets.json` | The 5 frozen demo targets — real, sympathetic, genuinely broken, no login wall, fast-loading (probed, not assumed). |

## Docs

- `earshot_spec.md` — the original build spec.
- `tracker.md` — architectural decisions with alternatives considered, and the
  interview-defense framing for each.
- `TEAM.md` — branch ownership and merge protocol for parallel work.
- `learn.md` — lessons from the build, not a changelog.

## What this is not

Earshot does not guarantee legal compliance, does not replace a human accessibility
review, and cannot verify that an LLM-authored fix (e.g. alt text) is *substantively
correct* — only that it doesn't regress axe's violation set. That gap is exactly why
every LLM-tier fix ships with its reasoning, every uncertain case is flagged instead
of guessed, and every patch is a PR for a human to review before anything reaches a
real site.

## Stack

TypeScript + Node, Playwright, axe-core, Zod, Fireworks (LLM tier + Grader B),
ElevenLabs, Braintrust, Daytona. Local JSON state (`out/*.json`), no database.
