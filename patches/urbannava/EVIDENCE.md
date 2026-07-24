# Earshot — accessibility remediation proposal for Town of Urbanna, VA (local government)

**This is a reviewable patch proposal with verification evidence, not a compliance claim.** Earshot flags what it cannot determine instead of guessing. An agent proposes; a human disposes — nothing here should be read as "compliant" or "fully accessible."

Target: https://urbannava.gov/
Scanned: 2026-07-24T23:05:45.402Z

## What this PR is and isn't

This diffs a snapshot of the fetched HTML against Earshot's proposed DOM mutations for https://urbannava.gov/. **It is not a pull request against that site's actual source repository** — we don't have access to it. It's a reviewable proposal in the shape a real PR would take, for the site owner or for demo purposes, opened against this repo.

## Grader A — axe-core violations

Before: **64**
After: **64**
Removed keys: (none)
Added keys (should be empty — the verifier reverts any fix that adds one): (none)

## Grader B — narration comprehension

Before: 3/5 — The page contains many unlabeled elements (headings, image, link) and several incomplete text fragments, which obscure some content and navigation cues. However, the main navigation links and most public notices are labeled and readable, allowing a blind user to access key information and perform essential tasks, albeit with gaps and potential confusion.
After: 3/5 — The page contains many unlabeled elements (headings, image, link) that hinder navigation and comprehension for a blind user. However, the main content is text-based and most links are labeled, allowing a user to access announcements and perform actions, albeit with reduced efficiency and clarity.

## Patches proposed (54)

- ↩ reverted — setLang — The document needs an explicit language for screen-reader pronunciation. (reverted after verification regression)
- ↩ reverted — setAttribute #p7MGMa1_1 — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute #p7MGMa1_2 — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute #p7MGMi1_9 — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute #p7MGMa1_3 — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute #p7MGMa1_4 — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute #p7MGMa1_5 — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute #p7MGMa1_6 — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute #p7MGMa1_7 — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute #p7HMY_2 > .hmy-section[data-hmy-basis="100,%,1"]:nth-child(2) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .hide — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(1) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(3) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(4) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(5) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(6) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(7) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(8) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(9) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(10) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(11) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(12) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(14) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(15) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(16) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(17) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(18) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(19) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(20) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(22) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(23) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(24) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(25) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(26) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(27) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(28) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(29) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(30) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(31) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(32) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .hide_desktop — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(35) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(36) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_white.public_notice:nth-child(37) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap_plain — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute iframe — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .ad_wrap — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute #town — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .footer — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute #p7PBXp_1 — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute #p7PBXp_2 — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute #p7PBXp_3 — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .p7IFX — The image is a linked down‑arrow whose target is #start, so the alt text should convey its purpose as a link to the start of the page. (reverted after verification regression)
- ↩ reverted — setAttribute a[href$="#start"] — The link contains only an image and no visible text, so adding an aria-label that describes its purpose (scroll to start) provides a discernible name for screen readers. (reverted after verification regression)

## Flagged for human review (1)

A good flag rate is a feature — every item below is something the model declined to guess at.

- `button-name` iframe — Button purpose cannot be determined from the given context.: There is no visible text, title, or surrounding information to infer an appropriate aria-label, so a reliable accessible name cannot be generated.

## Narration diff (before → after)

```diff
(no textual diff — narration unchanged)
```

## HTML diff (snapshot before → after mutation)

```diff
--- patches/urbannava/before.html	2026-07-24 16:05:45
+++ patches/urbannava/after.html	2026-07-24 16:05:45
@@ -1,4 +1,4 @@
-<!DOCTYPE html><html><head>
+<!DOCTYPE html><html lang=""><head>
 <meta id="p7HMY" name="viewport" content="width=device-width">
 <meta charset="UTF-8">
 <title>Town of Urbanna Governmental Website</title>
@@ -952,4 +952,4 @@
 
 
 
-<span class="p7BAM bam-wrapper bam-body"><span class="bam-mask bam-color-none" style="opacity: 0.65;"></span><span class="bam-image bam-type-cover bam-pos-center-center current-slide bam-burns-1 bam-run" style="background-image: url(&quot;img/bkgd/9100-aerialPhoto.jpg&quot;); z-index: 1; visibility: visible; opacity: 1; left: 0px; top: 0px; transition: transform 12s linear, opacity 3s linear;"></span><span class="bam-image bam-type-cover bam-pos-center-center"></span><span class="bam-image bam-type-cover bam-pos-center-center"></span></span><div id="p7PBXov" class="pbx-overlay" style="z-index: 99999995;"></div></body></html>
\ No newline at end of file
+<span class="p7BAM bam-wrapper bam-body"><span class="bam-mask bam-color-none" style="opacity: 0.65;"></span><span class="bam-image bam-type-cover bam-pos-center-center current-slide bam-burns-5 bam-run" style="background-image: url(&quot;img/bkgd/9100-aerialPhoto.jpg&quot;); z-index: 1; visibility: visible; opacity: 1; left: 0px; top: 0px; transition: transform 12s linear, opacity 3s linear;"></span><span class="bam-image bam-type-cover bam-pos-center-center bam-burns-3" style="background-image: url(&quot;img/bkgd/6980-lansdowne.jpg&quot;); z-index: 0; visibility: hidden; opacity: 0; left: 0px; top: 0px;"></span><span class="bam-image bam-type-cover bam-pos-center-center bam-burns-4" style="background-image: url(&quot;img/bkgd/6980-marina_1.jpg&quot;); z-index: 0; visibility: hidden; opacity: 0; left: 0px; top: 0px;"></span></span><div id="p7PBXov" class="pbx-overlay" style="z-index: 99999995;"></div></body></html>
\ No newline at end of file

```
