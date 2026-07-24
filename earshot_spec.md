# EARSHOT — Build Spec

**Read fully before writing code. Follow phases in order. Do not skip ahead.**

Solo developer. Hard deadline **3:30 PM** (Devpost submission). Assume ~3 hours of build time. Every phase must end in a working, demoable state.

---

## 0. What we are building, in one sentence

An agent that finds websites blind people can't use, fixes the code, and **verifies the fix by listening to the page**.

## 1. Non-negotiable rules

1. **Phases 1–3 are the product.** Everything after is upside. If a sponsor integration stalls for more than 15 minutes, `git checkout` and move on.
2. **Never fabricate an API endpoint or SDK signature.** For every sponsor, fetch the official docs before writing integration code. If reality differs from this file, follow the docs and say so.
3. **Framing is a hard requirement, not a preference.** See Section 8. Never output or write the words "automatically compliant." This project generates *reviewable patches with verification evidence*.
4. **Commit and tag after every phase.**
5. TypeScript + Node. Local JSON files for state. No database, no auth, no deploy.
6. **Stop building at 3:00 PM regardless of state.** The last 30 minutes are video + Devpost.

---

## 2. Why the audio layer is the whole point

Automated scanners like axe-core catch roughly 25–33% of real accessibility barriers. They pass `alt="image123"`. They can't tell you the reading order is incoherent. The remaining ~70% currently requires a human with a screen reader — that is the expensive, unscalable bottleneck in this entire industry.

So we use **two graders**:

- **Grader A (cheap, mechanical):** axe-core violation count. Fast, deterministic, catches the obvious 30%.
- **Grader B (the contribution):** serialize the page into the linear narration a screen reader would produce, then judge whether a person could actually understand and navigate the page from that alone.

Grader B is what nobody has automated. It is the demo, the differentiator, and the thing judges will remember.

---

## 3. Architecture

```
targets.json
    │
    ▼
 CRAWLER ──► AUDITOR ──► PLANNER ──► PATCHER ──► VERIFIER
(playwright) (axe-core)  (LLM via    (DOM        │
                          Fireworks)  mutation)   ├─► axe re-scan        (Grader A)
                                                  └─► NARRATOR ─► JUDGE  (Grader B)
                                                       │           │
                                                  ElevenLabs   Braintrust
                                                       │
                                                  PATCH EMITTER ─► git branch ─► PR ─► CodeRabbit
```

---

## 4. PHASE 1 — Audit + Narrate (target: 45 min)

This phase delivers the differentiator first. Do not defer it.

```bash
npm init -y
npm i -D typescript tsx @types/node
npm i playwright @axe-core/playwright zod
npx playwright install chromium
```

### 4a. Audit

`src/audit.ts` — launch chromium headless, `page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })`, run `new AxeBuilder({ page }).analyze()`.

**Reduce the output immediately.** Raw axe JSON is enormous and will wreck your context and token budget:

```ts
type Violation = {
  id: string;          // "image-alt"
  impact: string;      // minor | moderate | serious | critical
  help: string;
  nodes: Array<{
    target: string;    // CSS selector = nodes[].target[0]
    html: string;      // TRUNCATE to 300 chars
    failureSummary: string;
  }>;
};
```

### 4b. Narrate ← THE KEY FUNCTION

`src/narrate.ts`. Playwright exposes the accessibility tree directly:

```ts
const snapshot = await page.accessibility.snapshot();
```

Walk it depth-first, in document order, and emit one line per meaningful node as a screen reader would announce it:

```
heading level 1, "Community Food Bank"
link, "Donate"
image, unlabeled          ← this is the failure, made audible
button, unlabeled
edit text, blank
```

Rules:
- Emit `role, "name"` for each node with a role.
- When `name` is empty on an interactive or informative element, emit `unlabeled` or `blank` — do not skip it. **The gaps are the signal.**
- Skip generic containers with no name.
- Cap at ~150 lines so the judge prompt stays cheap.

This string is your `narration`. It is the input to Grader B and the script for the ElevenLabs audio.

### 4c. Judge the narration

One LLM call. Give it *only* the narration — never the visual page:

```
You are given the complete linear output a screen reader would produce for a web
page. You cannot see the page. Answer only from this text.

1. What is this page for?
2. What actions can a user take?
3. List every element whose purpose is unclear or unlabeled.
4. Comprehension score 1-5: could a blind user accomplish this page's primary
   task using only what you were given?

Return JSON only: { purpose, actions, unclear[], score, reasoning }
```

Validate with Zod `.safeParse()`. Never trust raw model output.

**Checkpoint:** for one real URL you have a violation count, a narration transcript, and a comprehension score. Commit. This alone is a demoable product.

---

## 5. PHASE 2 — Fix and prove it improved (target: 50 min)

### 5a. Deterministic tier (no model call)

Free, instant, 100% reliable. Do these first:
- `html-has-lang` → set `documentElement.lang = 'en'`
- `color-contrast` → compute the WCAG ratio, adjust foreground until ≥ 4.5
- `bypass` / `region` → inject a skip link as first child of `<body>`
- `duplicate-id` → suffix duplicates

### 5b. LLM tier

For `image-alt`, `label`, `button-name`, `link-name`, `aria-*`, `heading-order` — send violation id, help text, the offending HTML, and ~200 chars of surrounding DOM text. Demand JSON only:

```json
{ "action": "setAttribute",
  "selector": "...",
  "attribute": "alt",
  "value": "Volunteers packing grocery boxes at the community food bank",
  "reasoning": "one sentence" }
```

**Alt-text quality is the single highest-risk output in this project.** The FTC's case against accessiBe cited AI-generated alt text describing filet mignon as "brown bread on white ceramic plate." Always include the surrounding text, any `<figcaption>`, and the link target in the prompt. If the model cannot determine the content confidently, it must return `{"action": "flag_for_human"}` rather than guessing. Log flagged items — **a good flag rate is a feature, and saying so out loud is what separates you from the overlay vendors.**

### 5c. Apply

Mutate the live DOM via `page.evaluate` keyed by the axe selector. No file serving, no proxy, no deploy — the loop closes in one page context.

```ts
await page.evaluate(({ selector, attribute, value }) => {
  const el = document.querySelector(selector);
  if (!el) return { ok: false, reason: 'selector not found' };
  el.setAttribute(attribute, value);
  return { ok: true };
}, patch);
```

Re-scan between fixes, or apply in reverse document order — selectors go stale after mutation.

### 5d. Verify with BOTH graders

- **A:** re-run axe. `violationsBefore → violationsAfter`.
- **B:** re-narrate, re-judge. `scoreBefore → scoreAfter`.

Compare full violation *sets*, not just counts — if a fix introduced new violations, revert it.

**Checkpoint:** console shows `47 violations → 39` **and** `comprehension 2/5 → 4/5`. Commit. **This is the demo.** Screenshot everything now as insurance.

---

## 6. PHASE 3 — Emit a reviewable patch (target: 25 min)

This is what makes the project legitimate rather than an overlay clone. Overlays patch the browser at runtime and leave the source broken; that model is legally discredited and community-hated. We emit source changes for human review.

1. Collect all applied mutations for a site into a structured changeset.
2. Write it as a real diff — modified HTML file(s) in a `patches/<site>/` directory.
3. `git checkout -b fix/a11y-<site>`, commit, push, `gh pr create`.
4. PR body must include: violations before/after, comprehension score before/after, the narration diff, and every `flag_for_human` item.

CodeRabbit reviews it automatically (Section 7.4). **Your agent proposes; a reviewer disposes.** Say exactly that on stage.

**Checkpoint:** a real PR exists on GitHub with evidence in the body. Commit.

---

## 7. Sponsor integrations

> Fetch each sponsor's docs before writing integration code. Redeem coupons **now**, before you need them.

Order is by cash-per-minute. Do them in this sequence.

### 7.1 ElevenLabs (20 min — core, not optional)

Discord redemption: `https://discord.com/invite/VnBvbbcdEC` → `#coupon-codes` → Start Redemption.

Two uses:
- **Verification:** synthesize the `narration` string to audio. This is the artifact that makes the failure *audible* rather than a number on a chart.
- **Demo:** generate before/after audio for the same page. Before = "image, unlabeled… button, unlabeled." After = a coherent page. **Play both in the video. This is your cold open.**

Keep a text-only fallback path so a TTS failure can never block the loop.

### 7.2 Braintrust (25 min — you already know this stack)

Coupon `BT-DISCOUNT-HACKATHON` at `https://www.braintrust.dev/signup` → billing settings → Pro upgrade path.

Log every site as an experiment with:
- **Deterministic scorers:** violation delta, violations-by-impact delta, fix success rate, flag rate.
- **LLM-as-judge scorer:** the comprehension score from 4c.
- **Dataset:** the five target sites.
- **Comparison:** baseline (unpatched) vs remediated, as two runs.

The screenshot to capture: the Braintrust experiment diff showing comprehension scores rising across the dataset. That is one image that proves the whole thesis.

### 7.3 Daytona ($1,000 cash — 20 min HARD CAP)

Coupon `DAYTONA_HACKSPRINT_07_24_639EXIRT` at `https://app.daytona.io` → Billing Dashboard → Redeem. Quickstart is linked in the event doc; paste their full LLMs.txt into your context before coding against it.

Justification is genuine, not decorative: **you are executing generated patches against untrusted third-party websites.** That belongs in an isolated sandbox. Run one sandbox per target site and fan out all five in parallel.

**Known risk:** Playwright needs a chromium install inside the sandbox, which can be slow. If the sandbox isn't running a scan within 20 minutes, fall back to local execution and still describe the isolation argument in the write-up.

### 7.4 CodeRabbit ($1,000 cash — 15 min, highest cash-per-minute)

Free 14-day trial, no card. Install the GitHub app on your repo.

Phase 3 already opens the PR — CodeRabbit reviews it with zero extra work. The narrative writes itself: **an AI agent writes accessibility fixes, and another AI reviews them before any human sees them.** Almost nobody else will wire this. Screenshot the CodeRabbit review comment on your PR.

### 7.5 Fireworks ($500 — 15 min)

Dashboard → Credits → Redeem Promo → `FWAI-DAYTONA-7-24-2026`. OpenAI-compatible API, so it's a base-URL and key swap.

Real routing, not a swap-and-stop:
- Deterministic tier → **zero model calls**
- Simple violations (`image-alt`, `link-name`, `button-name`) → small fast model
- Hard violations (`aria-*`, `heading-order`, focus order) → larger model
- The narration judge → larger model

Log cost-per-fix and cost-per-site. A falling cost curve alongside a rising comprehension curve is a strong slide.

### 7.6 CopilotKit ($500 — SKIP unless ahead at 2:15)

`npx copilotkit@latest license`. If you have slack: a sidebar copilot on the dashboard answering "why did you make this fix?" against the changeset. Nice, not necessary.

### 7.7 WorkOS

No prize. Skip entirely.

---

## 8. Framing guardrails — non-negotiable

The dominant player in this space, accessiBe, paid a $1,000,000 FTC settlement over claims that its AI could make any website WCAG-compliant. Over 800 businesses using overlay widgets were sued anyway. Accessibility practitioners are actively hostile to "AI fixes accessibility" pitches, for good reason.

**Never write or say:**
- "automatically compliant" / "WCAG compliant in one click"
- "fully accessible" / "solves accessibility"
- any claim that the tool guarantees legal compliance

**Do say:**
- "generates reviewable patches with verification evidence"
- "an agent proposes, a human disposes"
- "flags what it cannot determine instead of guessing"

Preempt this in the first 30 seconds of the pitch. Naming the overlay problem before a judge can raise it converts your biggest vulnerability into credibility.

---

## 9. Targets

Five sites, frozen now, no sixth. Real organisations, sympathetic, genuinely broken, no login wall, mostly static HTML. Small nonprofits, local government departments, university department pages, community libraries.

Load each manually first — a site that hangs will kill a live run. Store in `targets.json` with a known-good fallback list.

---

## 10. Timeline (deadline 3:30 PM)

| by | state |
|---|---|
| +0:45 | Phase 1 green — audit + narration + comprehension score |
| +1:35 | Phase 2 green — fixes applied, both graders improving |
| +2:00 | Phase 3 green — PR open with evidence |
| +2:20 | ElevenLabs audio + Braintrust experiments |
| +2:40 | Daytona + CodeRabbit + Fireworks |
| **+2:40** | **STOP BUILDING** |
| +2:55 | Record the video |
| +3:00 | Devpost submitted |

Round one is judged on the Devpost, not a live demo. **The write-up is not overhead — it is the qualifying round.**

---

## 11. Devpost submission (write this, do not improvise)

Required: team name, members with emails/socials, demo video under 2 minutes, project description, public GitHub URL.

Description must cover, in this order:
1. **2–3 sentence summary.** "Earshot finds websites blind users can't navigate, generates reviewable code fixes, and verifies each fix by listening to the page as a screen reader would."
2. **Problem and impact.** Automated scanners catch ~30% of barriers; the rest needs a human with a screen reader. EAA enforcement began June 2025 across all 27 EU member states with extraterritorial reach; US settlements run into the millions. Meanwhile AI codegen is producing inaccessible markup faster than humans can review it.
3. **Architecture.** The two-grader design. Emphasise that Grader B — narration comprehension — is the novel part.
4. **Sponsor tools.** One dense paragraph each, naming the specific feature and a number. Submit to **every** track you legitimately touched; sponsor awards are open to all teams, not just finalists.

## 12. Video (under 2 min)

- **0:00–0:15** Audio only, black screen. The "before" narration. `image, unlabeled. button, unlabeled. edit text, blank.` Say nothing.
- **0:15–0:30** "That's a real charity's donation page, as a blind user hears it."
- **0:30–1:15** Agent runs. Violations fall. Comprehension score rises. Play the "after" audio.
- **1:15–1:40** The PR, with CodeRabbit's review on it. "It proposes. A human approves."
- **1:40–2:00** Braintrust experiment across five sites. Totals.

---

## 13. Failure modes

| symptom | cause | fix |
|---|---|---|
| context blows up | raw axe JSON | reduce to `Violation` in Phase 1, always |
| selector not found | stale after prior mutation | re-scan between fixes |
| narration is empty | AX tree not ready | await `networkidle` or a 1s settle before snapshot |
| comprehension score never moves | judge sees too little | ensure narration includes unlabeled elements explicitly |
| alt text is generic | prompt lacks context | include surrounding text, figcaption, link target |
| new violations after fix | model over-edits | diff full violation sets; revert net-negative fixes |
| rate limited late | no caching | cache by `${violationId}::${htmlHash}`, persist to disk |

---

## 14. Start here

```
Phase 1. Playwright + axe-core + page.accessibility.snapshot().
Print a violation count AND a narration transcript for one real URL.
Nothing else. Go.
```