# Earshot — accessibility remediation proposal for Community Library (nonprofit library)

**This is a reviewable patch proposal with verification evidence, not a compliance claim.** Earshot flags what it cannot determine instead of guessing. An agent proposes; a human disposes — nothing here should be read as "compliant" or "fully accessible."

Target: https://comlib.org/
Scanned: 2026-07-24T23:09:37.458Z

## What this PR is and isn't

This diffs a snapshot of the fetched HTML against Earshot's proposed DOM mutations for https://comlib.org/. **It is not a pull request against that site's actual source repository** — we don't have access to it. It's a reviewable proposal in the shape a real PR would take, for the site owner or for demo purposes, opened against this repo.

## Grader A — axe-core violations

Before: **36**
After: **36**
Removed keys: (none)
Added keys (should be empty — the verifier reverts any fix that adds one): (none)

## Grader B — narration comprehension

Before: 4/5 — The page has clear landmarks, headings, and most interactive elements are labeled. However, multiple unlabeled images and ambiguous controls like the 'I want to' link and shuffle button reduce clarity. A blind user could likely accomplish primary tasks such as finding events or searching, but some elements may cause confusion.
After: 4/5 — The page has clear landmarks, headings, and most interactive elements are labeled. However, multiple unlabeled images and ambiguous controls like the 'I want to' link and shuffle button reduce clarity. A blind user could likely accomplish primary tasks such as finding events or searching, but some elements may cause confusion.

## Patches proposed (2)

- ↩ reverted — setAttribute .genesis-skip-link > li:nth-child(1) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .sup_footer — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)

## Flagged for human review (0)

A good flag rate is a feature — every item below is something the model declined to guess at.

(none)

## Narration diff (before → after)

```diff
(no textual diff — narration unchanged)
```

## HTML diff (snapshot before → after mutation)

```diff
(no diff — no mutations survived verification)
```
