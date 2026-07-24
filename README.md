# Earshot

Finds websites blind users can't navigate, generates **reviewable code fixes**, and
verifies each fix by *listening* to the page as a screen reader would.

Automated scanners (axe-core) catch ~25–33% of real accessibility barriers. The rest
needs a human with a screen reader — the expensive, unscalable bottleneck. Earshot
uses **two graders**:

- **Grader A** — axe-core violation count. Fast, deterministic, catches the obvious ~30%.
- **Grader B** — serialize the page into the linear narration a screen reader produces,
  then judge whether a person could understand and navigate it *from that alone*. This
  is the part nobody has automated.

Earshot **proposes** patches with verification evidence; a human **disposes**. It flags
what it cannot determine instead of guessing. It does not claim to make any site
"compliant."

## Phase 1 (this build)

Audit + narrate + judge one real URL.

```bash
npm install
npx playwright install chromium
cp .env.example .env        # add FIREWORKS_API_KEY (Grader B); Grader A works without it
npm run audit -- https://www.gov.uk/
```

Output per URL: axe violation count (Grader A), the full screen-reader narration
transcript with unlabeled gaps made explicit, and a 1–5 comprehension score (Grader B).
Reports are saved to `out/`.

## Layout

| File | Role |
|---|---|
| `src/narrate.ts` | **The key function** — page → linear screen-reader narration. Parse (`parseAriaSnapshot`) and render (`renderNode`) are split so the fragile string handling is browser-free testable. |
| `src/audit.ts` | Grader A — axe results reduced to a small `Violation` shape at the boundary. |
| `src/judge.ts` | Grader B — one Fireworks LLM call over *only* the narration, Zod-validated. |
| `src/scan.ts` | Load a page settled enough for both graders; run them. |
| `src/index.ts` | Entry point — ties it together, prints the checkpoint, persists to `out/`. |
| `scripts/probe-targets.ts` | Vet candidate target sites by measurement before freezing. |

Stack: TypeScript + Node, Playwright, axe-core, Zod, Fireworks. Local JSON state, no DB.
