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

## 2026-07-24 — Daytona dependency tradeoff

Official SDKs are not automatically the right dependency if they bring an unfixed
security finding into a small demo repo. Daytona's SDK installed successfully, but
`npm audit --omit=dev` showed 3 high-severity findings through OpenTelemetry. The
REST smoke path still proves isolated execution and keeps the dependency tree clean.

## 2026-07-24 — Dashboard as presentation only

The static dashboard is not another pipeline stage. It reads existing artifacts and
makes them easier to screenshot: remediation numbers, Braintrust metrics, Daytona
sandbox proof, and audio/text outputs. The source of truth remains the saved JSON
reports and sponsor evidence files.
