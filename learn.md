# Earshot — Learn Log

## 2026-07-24 — Phase 2 verification

The important Phase 2 lesson is that a fixer must be allowed to reject its own patch.
A naive region fix on gov.uk lowered nothing and introduced new axe keys, so the
verifier rolled it back. The metric that matters is not just "did the count go down";
it is "did the set of failures improve without adding new failures."

## 2026-07-24 — Sponsor audio fallback

The ElevenLabs audio script should not be the source of truth. The real artifact is
the narration transcript; MP3 is presentation for the video. That is why
`scripts/audio.ts` always writes `.txt` files first, then attempts TTS only when an
API key is present, and treats TTS auth/API failure as a skipped MP3 instead of a
failed build.

## 2026-07-24 — Braintrust as downstream evidence

Braintrust should read the saved `RemediationReport`, not call the scanner or patcher.
That keeps the team split honest: `phase-1` owns producing reports, `phase-2` owns
turning reports into sponsor evidence. The first uploaded experiment has flat scores
because the gov.uk remediation did not improve, but the pipeline is proven and can be
rerun when a stronger report lands.
