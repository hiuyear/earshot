# Earshot — accessibility remediation proposal for Oxford Computer Science (university department)

**This is a reviewable patch proposal with verification evidence, not a compliance claim.** Earshot flags what it cannot determine instead of guessing. An agent proposes; a human disposes — nothing here should be read as "compliant" or "fully accessible."

Target: https://www.cs.ox.ac.uk/
Scanned: 2026-07-24T23:12:28.899Z

## What this PR is and isn't

This diffs a snapshot of the fetched HTML against Earshot's proposed DOM mutations for https://www.cs.ox.ac.uk/. **It is not a pull request against that site's actual source repository** — we don't have access to it. It's a reviewable proposal in the shape a real PR would take, for the site owner or for demo purposes, opened against this repo.

## Grader A — axe-core violations

Before: **19**
After: **19**
Removed keys: (none)
Added keys (should be empty — the verifier reverts any fix that adds one): (none)

## Grader B — narration comprehension

Before: 4/5 — The page has a clear heading hierarchy, landmarks, and descriptive link text for most elements, making it navigable. However, a few links are ambiguous or oddly placed, which could cause minor confusion for a blind user trying to understand the page structure or the destination of certain actions.
After: 3/5 — The page has clear headings, landmarks, and navigation, allowing a blind user to understand the overall structure and access main sections. However, several action links are generic ('Discover More', 'Book Now', multiple 'Find out more') without sufficient context, making it difficult to know their specific purpose. The 'Book Now' link is particularly ambiguous. While a user can explore the site, these unclear elements hinder full usability for the primary task of efficiently finding information.

## Patches proposed (9)

- ↩ reverted — setAttribute .container-fluid.space-below.no-gutters:nth-child(2) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .container-fluid.space-below.no-gutters:nth-child(7) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .container-fluid.space-below.no-gutters:nth-child(8) > .row > .col-md-6.no-gutters.col-xs-12:nth-child(1) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .container-fluid.space-below.no-gutters:nth-child(8) > .row > .col-md-6.no-gutters.col-xs-12:nth-child(3) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .container-fluid.space-below.no-gutters:nth-child(9) > .row > .col-md-6.no-gutters.col-xs-12:nth-child(1) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .container-fluid.space-below.no-gutters:nth-child(9) > .row > .col-md-6.no-gutters.col-xs-12:nth-child(3) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .container-fluid.space-below.content-width:nth-child(10) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .container-fluid.space-below.no-gutters:nth-child(11) — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)
- ↩ reverted — setAttribute .back-to-top — Content outside landmarks needs a navigable region; role=main is the smallest demo fix. (reverted after verification regression)

## Flagged for human review (0)

A good flag rate is a feature — every item below is something the model declined to guess at.

(none)

## Narration diff (before → after)

```diff
(no textual diff — narration unchanged)
```

## HTML diff (snapshot before → after mutation)

```diff
--- patches/csox/before.html	2026-07-24 16:12:28
+++ patches/csox/after.html	2026-07-24 16:12:28
@@ -617,7 +617,7 @@
                         </div>
 		
 		</div>
-                <div class="col-xs-12 equal-text-height">
+                <div class="col-xs-12 equal-text-height" style="">
                     <div class="hero-text">
                         <h2 class="text-uppercase">OUR WORLD-CLASS RESEARCH</h2>
                         <p>
@@ -702,7 +702,7 @@
                         </div>
 		
 		</div>
-                <div class="col-xs-12 equal-text-height">
+                <div class="col-xs-12 equal-text-height" style="height: 353px;">
                     <div class="hero-text">
                         <h2 class="text-uppercase">Study with us</h2>
                         <p>
@@ -742,7 +742,7 @@
                 	</div>
 		 </div>
 	    
-                <div class="col-xs-12 equal-text-height">
+                <div class="col-xs-12 equal-text-height" style="height: 353px;">
                     <div class="hero-text">
                         <h2 class="text-uppercase">Meet our people</h2>
                         <p>

```
