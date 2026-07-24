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

## 2026-07-24 — ElevenLabs response shape

The ElevenLabs key was valid once the 401 disappeared, but the script still skipped
MP3s because the SDK returned a Blob-like response instead of the Node stream shown in
the docs snippet. The robust fix was to handle all reasonable binary shapes: Node
streams, Web streams, Blob/ArrayBuffer, and Uint8Array, plus a timeout so generation
cannot hang silently.

## 2026-07-24 — Phase 3 branch ids

The first Phase 3 rerun failed to open a PR because CLI URL scans used the generic
target id `adhoc`, so every demo tried to push `fix/a11y-adhoc`. The fix was to derive
the target id from the URL hostname and add a timestamp to emitted fix branches. For
demo artifacts, uniqueness beats pretty branch names.

## 2026-07-24 — Live keys break more than they fix

Every "confirmed-real" default that was only checked against docs broke the moment a
real Fireworks key touched it: `deepseek-v3p1` (the judge's original default,
verified against docs) 404s — not deployed on this account. The fix was checking
`GET /v1/models` with the real key, not the docs, and treating "docs-verified" and
"account-verified" as different claims. Separately, the deployed models turned out to
be reasoning models that burn tokens on chain-of-thought before ever emitting JSON,
even at temperature 0 — `max_tokens: 900` truncated before the answer arrived. Silent
truncation looks identical to "the model is bad at this task"; it isn't, it just never
got to finish thinking.

## 2026-07-24 — A verifier can lie about its own rollback

`patch.ts`'s revert path marked every non-throwing revert attempt as `reverted: true`,
even when the inner `page.evaluate` found no matching element (a selector gone stale
after a later patch restructured the DOM) and silently no-op'd. The live violation and
comprehension numbers were never actually wrong — they come from a fresh re-scan, not
from trusting the patch log — but the per-patch status shown to a human reviewer was.
A verifier that can misreport its own rollback undermines the exact claim ("the
verifier is allowed to reject its own fix") that makes this different from an overlay.
Caught by asking the adversarial question directly: does reverting *actually* restore
the page, or can a stale selector leave a mutation applied?

## 2026-07-24 — Page content in a prompt is an attack surface

The LLM tier and Grader B both feed content pulled from a third-party page (node HTML,
surrounding text, the narration transcript) into a model prompt. `PatchSchema`
validated shape but not which HTML attribute was safe to set — a hostile page could in
principle prompt-inject a `setAttribute` proposal for something like `onerror`. The
actual fix is an allow-list of accessibility-relevant attributes applied after the
model responds, not better prompting; a system-prompt instruction that page content is
untrusted data helps but no prompt is injection-proof.

## 2026-07-24 — The dashboard is a target too

Ran the dashboard through Earshot's own pipeline, per the obvious-in-hindsight rule
that a tool judging accessibility should survive being judged by itself. It scored 0
axe violations but 2/5 comprehension: stat tiles rendered a number in a `<strong>` and
a label in a sibling `<span>`, and neither carries the other's text into an accessible
name, so the label reached the screen-reader narration and the number next to it
silently didn't. Axe never caught this — no rule fires on "value and label aren't
programmatically associated" the way this markup produced it — which is itself
evidence for why Grader B exists. Fixed with `role="group"` + `aria-label` combining
both into one announcement.

## 2026-07-24 — Character limits are availability bugs

ElevenLabs' TTS endpoint hard-rejects text over 10,000 characters. `narrate.ts` caps
narration by *line count* (150), not character count, so a text-heavy real site
(a government homepage, not a toy example) produced a 14,338-character transcript that
silently fell back to text-only — correct behavior, but avoidable. Two-step fix, same
shape as the missing-key fallback: try an LLM condense first (explicitly told to keep
every "unlabeled"/"blank" line verbatim, since those are the signal), then hard-
truncate at a line boundary as the unconditional final fail-safe. A transcript being
too long should never be a harder failure than a missing API key.
