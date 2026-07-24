# Earshot — Team Working Agreement

Two people, hard stop **3:00 PM** (then video + Devpost by 3:30). This file is the
single source of truth for **who owns what** and **how we avoid stepping on each
other**. It is committed so both of us see the same copy — unlike `tasks/`, which is
gitignored and local-only.

**Branch naming (updated):** `phase-1` and `phase-2` replace the old `feat/remediation`
/ `feat/evidence` names below. The split is still by **domain**, not by spec phase
number — `phase-1` owns the product core (`src/`), `phase-2` owns the sponsor
evidence layer (`scripts/`) and the dashboard (`dashboard/`). Any `feat/remediation`
or `feat/evidence` reference below means `phase-1` / `phase-2` respectively.

Framing rule applies to everything either of us writes or says: reviewable patches
with verification evidence. Never "compliant" / "fully accessible". See `tracker.md` §Framing.

---

## The seam: how we work in parallel without conflicts

The whole split rests on one idea: **Branch B builds against Phase 1's saved output
(`out/*.json`), not against Branch A's code.** The `SiteReport` type in `src/types.ts`
is the contract between us. Freeze it first, then neither branch blocks the other.

**Nobody edits the other person's files.** Ownership below is strict. The only shared
files are `src/types.ts`, `package.json`, and `targets.json` — all frozen *before* we
branch (see Step 0).

---

## Step 0 — DO THIS TOGETHER ON `main` BEFORE BRANCHING (~15 min)

Both branches depend on these. Doing them first prevents the two worst merge
conflicts (lockfile + type contract).

- [x] **Hiuyan:** commit Phase 1, push `main` to GitHub. `gh` is still not installed
      locally (`brew install gh && gh auth login`, run by hand) — it isn't needed
      again until Phase 3's `gh pr create`.
- [x] **Hiuyan:** freeze `targets.json` — probed 8 candidates with
      `npx tsx scripts/probe-targets.ts <url>...`, committed the 5 that load fast
      and are genuinely broken (urbannava.gov, mdfoodbank.org, comlib.org,
      communitylibrary.net/post-falls, cs.ox.ac.uk). Replaced gov.uk, which only
      had 2 axe violations and didn't fit spec §9's "genuinely broken" bar.
- [x] **Hiuyan:** `src/types.ts` already carries the Phase 2/3 shapes (`Patch`,
      `PatchResult`, `VerifyResult`, `RemediationReport`) — frozen, both branches
      build against it as-is.
- [ ] **Together:** install every dep both branches need **now**, in one commit, so the
      lockfile doesn't conflict later:
      `npm i elevenlabs braintrust @daytonaio/sdk` *(confirm real package names from each
      sponsor's docs before running — do not trust these strings; P2.1/`/browse` covers this)*.
- [ ] **Teammate:** install the **CodeRabbit** GitHub app on the repo (2 min, highest
      cash-per-minute). Needs `main` pushed first — it is.
- [x] `phase-1` is cut from `main` and current. `phase-2` still needs to be cut by
      whoever picks up the sponsor evidence layer — same starting point (`main`
      at the target-freeze commit).

---

## Branch A — `phase-1` (Hiuyan) — the product core

Phases 2 & 3. This is the demo. Detailed hands-on plan (with verify lines + tags) is in
your local `tasks/todo.md`.

| File | Responsibility |
|---|---|
| `src/plan.ts` | Planner. Deterministic tier (lang, contrast, skip-link, dup-id — no model call) + LLM tier (Fireworks → JSON patch, `flag_for_human` when unsure). **Fireworks model routing lives here** (small model for simple violations, large for aria/heading-order). |
| `src/patch.ts` | Apply patches via `page.evaluate`, keyed by axe selector. Reverse doc order / re-scan between fixes (selectors go stale). |
| `src/verify.ts` | Re-audit + re-narrate + re-judge. Diff full violation **sets** (`violationKeys`), revert any fix that adds violations. Produces before→after numbers. |
| `src/emit.ts` | Phase 3. Changeset → `patches/<site>/` → `git checkout -b fix/a11y-<site>` → commit → `gh pr create` with evidence body. |
| `src/index.ts` | Orchestration. You own this file. |

**Output artifact (not a dev branch):** `emit.ts` creates `fix/a11y-<site>` branches and
opens PRs — that's the product's deliverable, the thing CodeRabbit reviews on stage.

---

## Branch B — `phase-2` (Teammate) — the sponsor evidence layer

Everything here reads `out/*.json` (Phase 1 output, already committed as fixtures) or a
`RemediationReport` once A produces one. **You never touch `src/index.ts`** — each feature
is its own script under `scripts/`, run standalone. That fully decouples us.

> Before writing ANY integration code, fetch that sponsor's official docs. Do not
> invent an endpoint or SDK signature — if reality differs from what's below, follow
> the docs and note it.

| File | Responsibility | Priority |
|---|---|---|
| `scripts/audio.ts` | **ElevenLabs.** Synthesize a `narration.transcript` → mp3. Generate before/after audio for one site (the video's cold open). **Keep a text-only fallback so a TTS failure never blocks anything.** | 1st — core |
| `scripts/braintrust.ts` | **Braintrust.** Log each site as an experiment. Deterministic scorers: violation delta, by-impact delta, fix success rate, flag rate. LLM-as-judge scorer: the comprehension score. Dataset = the 5 targets. Two runs: baseline vs remediated. The screenshot = comprehension rising across the dataset. | 2nd |
| `scripts/sandbox.ts` | **Daytona.** Run one scan per target in an isolated sandbox, fan out all 5 in parallel. **20-min HARD CAP** — if Playwright/chromium install in the sandbox isn't scanning by then, fall back to local and still make the isolation argument in the write-up. | 3rd, capped |
| — | **CodeRabbit.** No code. Just the GitHub app install (Step 0) — it auto-reviews A's `fix/a11y-*` PRs. | done in Step 0 |

CopilotKit (§7.6) and WorkOS (§7.7): **skip** unless we're ahead at 2:15.

---

## Merge protocol

- Both branches → PR into `main`. Small, frequent merges beat one big merge at 2:55.
- Merge order doesn't matter (no file overlap) **as long as Step 0 froze the shared
  files.** If you must change `types.ts` after branching, message the other person
  first — that's the one file that can conflict.
- `package-lock.json` conflicts: don't hand-merge. Take one side, `npm install`, recommit.
- Rebase on `main` before opening your PR so the diff is clean.

## Integration checkpoints

Note: "Phase 2" / "Phase 3" below are spec phases (§5, §6), not the `phase-1` /
`phase-2` branch names — both happen on the `phase-1` branch.

| by | state |
|---|---|
| +0:15 | Step 0 done, both on branches |
| Phase 2 green (`phase-1`) | violations fall AND comprehension rises on one site — **screenshot immediately** |
| `phase-1` merges Phase 2 work | `phase-2` re-points Braintrust/audio at real remediated numbers |
| Phase 3 green (`phase-1`) | real PR open, CodeRabbit comment appears — screenshot |
| +2:00 all merged | main runs end-to-end across 5 targets |
| **3:00** | **STOP BUILDING** |
