# Earshot — Learn Log

## 2026-07-24 — Phase 2 verification

The important Phase 2 lesson is that a fixer must be allowed to reject its own patch.
A naive region fix on gov.uk lowered nothing and introduced new axe keys, so the
verifier rolled it back. The metric that matters is not just "did the count go down";
it is "did the set of failures improve without adding new failures."
