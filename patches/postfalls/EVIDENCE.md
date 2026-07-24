# Earshot — accessibility remediation proposal for Post Falls Community Library (community library)

**This is a reviewable patch proposal with verification evidence, not a compliance claim.** Earshot flags what it cannot determine instead of guessing. An agent proposes; a human disposes — nothing here should be read as "compliant" or "fully accessible."

Target: https://communitylibrary.net/library/post-falls/
Scanned: 2026-07-24T23:10:46.639Z

## What this PR is and isn't

This diffs a snapshot of the fetched HTML against Earshot's proposed DOM mutations for https://communitylibrary.net/library/post-falls/. **It is not a pull request against that site's actual source repository** — we don't have access to it. It's a reviewable proposal in the shape a real PR would take, for the site owner or for demo purposes, opened against this repo.

## Grader A — axe-core violations

Before: **8**
After: **6**
Removed keys: aria-valid-attr-value::#menu-item-71510 > .fusion-bar-highlight[aria-label="Get a Card, opens a new window"][rel="noopener noreferrer"] > .menu-text > .fa-external-link-alt.fas[aria-hidden="”true”"], aria-valid-attr-value::#menu-item-7516 > .fusion-bar-highlight[rel="noopener noreferrer"][target="_blank"] > .menu-text > .fa-external-link-alt.fas[aria-hidden="”true”"]
Added keys (should be empty — the verifier reverts any fix that adds one): (none)

## Grader B — narration comprehension

Before: 4/5 — The page's primary information—hours, contact, closures, manager, and history—is presented in a logical structure with headings and text, making it largely accessible. However, the presence of unlabeled images, an unlabeled frame, and potentially confusing icon characters slightly hinders a fully seamless experience. A blind user could still accomplish the main task of finding library details, but the unclear elements may cause minor disorientation.
After: 4/5 — All essential information is available in text, and navigation is clear. However, several unlabeled images and an unlabeled frame may cause confusion or obscure potential content, slightly reducing usability.

## Patches proposed (2)

- ✓ applied — setAttribute #menu-item-71510 > .fusion-bar-highlight[aria-label="Get a Card, opens a new window"][rel="noopener noreferrer"] > .menu-text > .fa-external-link-alt.fas[aria-hidden="”true”"] — The aria-hidden value contains curly quotes, so we replace with straight quotes to make it 'true'.
- ✓ applied — setAttribute #menu-item-7516 > .fusion-bar-highlight[rel="noopener noreferrer"][target="_blank"] > .menu-text > .fa-external-link-alt.fas[aria-hidden="”true”"] — The aria-hidden value contains curly quotes, so we replace with straight quotes to make it 'true'.

## Flagged for human review (0)

A good flag rate is a feature — every item below is something the model declined to guess at.

(none)

## Narration diff (before → after)

```diff
--- patches/postfalls/before-narration.txt	2026-07-24 16:10:46
+++ patches/postfalls/after-narration.txt	2026-07-24 16:10:46
@@ -4,9 +4,9 @@
 link, "District 208.773.1506"
 link, "Donate"
 link, "Get a Card, opens a new window"
-text, "Get a Card  This link will open an external site in a new tab or window"
+text, "Get a Card This link will open an external site in a new tab or window"
 link, "Sign in or Search Catalog, opens a new window"
-text, "Sign in or Search Catalog "
+text, "Sign in or Search Catalog"
 link, "Facebook, opens a new window"
 text, " Facebook"
 link, "YouTube, opens a new window"

```

## HTML diff (snapshot before → after mutation)

```diff
--- patches/postfalls/before.html	2026-07-24 16:10:46
+++ patches/postfalls/after.html	2026-07-24 16:10:46
@@ -4464,7 +4464,7 @@
 <div class="fusion-secondary-header">
 	<div class="fusion-row">
 					<div class="fusion-alignleft">
-				<nav class="fusion-secondary-menu" role="navigation" aria-label="Secondary Menu"><ul id="menu-community-library-network-top-secondary-menu" class="menu"><li id="menu-item-1204" class="nmr-logged-out menu-item menu-item-type-custom menu-item-object-custom menu-item-1204" data-item-id="1204"><a href="tel:208-773-1506" class="fusion-flex-link fusion-bar-highlight"><span class="fusion-megamenu-icon"><i class="glyphicon fa-external-link-alt fas" aria-hidden="true"></i></span><span class="menu-text">District 208.773.1506</span></a></li><li id="menu-item-6582" class="fusion-menu nmr-logged-out menu-item menu-item-type-custom menu-item-object-custom menu-item-6582" data-classes="fusion-menu" data-item-id="6582"><a href="/about/#foundation" class="fusion-bar-highlight"><span class="menu-text">Donate</span></a></li><li id="menu-item-71510" class="nmr-logged-out menu-item menu-item-type-custom menu-item-object-custom menu-item-71510" data-item-id="71510"><a target="_blank" rel="noopener noreferrer" href="https://catalog.communitylibrary.net/MyAccount/SelfReg" class="fusion-bar-highlight" aria-label="Get a Card, opens a new window" data-nww-processed="true"><span class="menu-text">Get a Card <i class="fas fa-external-link-alt" aria-hidden="”true”"></i></span><i class="anww-external-link-icon" aria-hidden="true"></i></a></li><li id="menu-item-7516" class="nmr-logged-out menu-item menu-item-type-custom menu-item-object-custom menu-item-7516" data-item-id="7516"><a target="_blank" rel="noopener noreferrer" href="https://catalog.communitylibrary.net" class="fusion-bar-highlight" aria-label="Sign in or Search Catalog, opens a new window" data-nww-processed="true"><span class="menu-text">Sign in or Search Catalog <i class="fas fa-external-link-alt" aria-hidden="”true”"></i></span><i class="anww-external-link-icon" aria-hidden="true"></i></a></li></ul></nav><nav class="fusion-mobile-nav-holder fusion-mobile-menu-text-align-left" aria-label="Secondary Mobile Menu"><ul id="mobile-menu-community-library-network-top-secondary-menu" class="menu"><li id="mobile-menu-item-1204" class="fusion-mobile-nav-item" data-item-id="1204" style=""><a href="tel:208-773-1506" class="fusion-flex-link fusion-bar-highlight"><span class="fusion-megamenu-icon"><i class="glyphicon fa-external-link-alt fas" aria-hidden="true"></i></span><span class="menu-text">District 208.773.1506</span></a></li><li id="mobile-menu-item-6582" class="fusion-mobile-nav-item fusion-menu" data-classes="fusion-menu" data-item-id="6582" style=""><a href="/about/#foundation" class="fusion-bar-highlight"><span class="menu-text">Donate</span></a></li><li id="mobile-menu-item-71510" class="fusion-mobile-nav-item" data-item-id="71510" style=""><a target="_blank" rel="noopener noreferrer" href="https://catalog.communitylibrary.net/MyAccount/SelfReg" class="fusion-bar-highlight" aria-label="Get a Card, opens a new window" data-nww-processed="true"><span class="menu-text">Get a Card <i class="fas fa-external-link-alt" aria-hidden="”true”"></i></span><i class="anww-external-link-icon" aria-hidden="true"></i></a></li><li id="mobile-menu-item-7516" class="fusion-mobile-nav-item" data-item-id="7516" style=""><a target="_blank" rel="noopener noreferrer" href="https://catalog.communitylibrary.net" class="fusion-bar-highlight" aria-label="Sign in or Search Catalog, opens a new window" data-nww-processed="true"><span class="menu-text">Sign in or Search Catalog <i class="fas fa-external-link-alt" aria-hidden="”true”"></i></span><i class="anww-external-link-icon" aria-hidden="true"></i></a></li></ul></nav>			</div>
+				<nav class="fusion-secondary-menu" role="navigation" aria-label="Secondary Menu"><ul id="menu-community-library-network-top-secondary-menu" class="menu"><li id="menu-item-1204" class="nmr-logged-out menu-item menu-item-type-custom menu-item-object-custom menu-item-1204" data-item-id="1204"><a href="tel:208-773-1506" class="fusion-flex-link fusion-bar-highlight"><span class="fusion-megamenu-icon"><i class="glyphicon fa-external-link-alt fas" aria-hidden="true"></i></span><span class="menu-text">District 208.773.1506</span></a></li><li id="menu-item-6582" class="fusion-menu nmr-logged-out menu-item menu-item-type-custom menu-item-object-custom menu-item-6582" data-classes="fusion-menu" data-item-id="6582"><a href="/about/#foundation" class="fusion-bar-highlight"><span class="menu-text">Donate</span></a></li><li id="menu-item-71510" class="nmr-logged-out menu-item menu-item-type-custom menu-item-object-custom menu-item-71510" data-item-id="71510"><a target="_blank" rel="noopener noreferrer" href="https://catalog.communitylibrary.net/MyAccount/SelfReg" class="fusion-bar-highlight" aria-label="Get a Card, opens a new window" data-nww-processed="true"><span class="menu-text">Get a Card <i class="fas fa-external-link-alt" aria-hidden="true"></i></span><i class="anww-external-link-icon" aria-hidden="true"></i></a></li><li id="menu-item-7516" class="nmr-logged-out menu-item menu-item-type-custom menu-item-object-custom menu-item-7516" data-item-id="7516"><a target="_blank" rel="noopener noreferrer" href="https://catalog.communitylibrary.net" class="fusion-bar-highlight" aria-label="Sign in or Search Catalog, opens a new window" data-nww-processed="true"><span class="menu-text">Sign in or Search Catalog <i class="fas fa-external-link-alt" aria-hidden="true"></i></span><i class="anww-external-link-icon" aria-hidden="true"></i></a></li></ul></nav><nav class="fusion-mobile-nav-holder fusion-mobile-menu-text-align-left" aria-label="Secondary Mobile Menu"><ul id="mobile-menu-community-library-network-top-secondary-menu" class="menu"><li id="mobile-menu-item-1204" class="fusion-mobile-nav-item" data-item-id="1204" style=""><a href="tel:208-773-1506" class="fusion-flex-link fusion-bar-highlight"><span class="fusion-megamenu-icon"><i class="glyphicon fa-external-link-alt fas" aria-hidden="true"></i></span><span class="menu-text">District 208.773.1506</span></a></li><li id="mobile-menu-item-6582" class="fusion-mobile-nav-item fusion-menu" data-classes="fusion-menu" data-item-id="6582" style=""><a href="/about/#foundation" class="fusion-bar-highlight"><span class="menu-text">Donate</span></a></li><li id="mobile-menu-item-71510" class="fusion-mobile-nav-item" data-item-id="71510" style=""><a target="_blank" rel="noopener noreferrer" href="https://catalog.communitylibrary.net/MyAccount/SelfReg" class="fusion-bar-highlight" aria-label="Get a Card, opens a new window" data-nww-processed="true"><span class="menu-text">Get a Card <i class="fas fa-external-link-alt" aria-hidden="”true”"></i></span><i class="anww-external-link-icon" aria-hidden="true"></i></a></li><li id="mobile-menu-item-7516" class="fusion-mobile-nav-item" data-item-id="7516" style=""><a target="_blank" rel="noopener noreferrer" href="https://catalog.communitylibrary.net" class="fusion-bar-highlight" aria-label="Sign in or Search Catalog, opens a new window" data-nww-processed="true"><span class="menu-text">Sign in or Search Catalog <i class="fas fa-external-link-alt" aria-hidden="”true”"></i></span><i class="anww-external-link-icon" aria-hidden="true"></i></a></li></ul></nav>			</div>
 							<div class="fusion-alignright">
 				<div class="fusion-social-links-header"><div class="fusion-social-networks boxed-icons"><div class="fusion-social-networks-wrapper"><a class="fusion-social-network-icon fusion-tooltip fusion-facebook awb-icon-facebook" style="" data-placement="bottom" data-title="Facebook" data-toggle="tooltip" title="" href="https://www.facebook.com/communitylibrary.net/" target="_blank" rel="noreferrer" aria-label="Facebook, opens a new window" data-nww-processed="true" data-original-title="Facebook"><span class="screen-reader-text">Facebook</span><i class="anww-external-link-icon" aria-hidden="true"></i></a><a class="fusion-social-network-icon fusion-tooltip fusion-youtube awb-icon-youtube" style="" data-placement="bottom" data-title="YouTube" data-toggle="tooltip" title="" href="https://www.youtube.com/@CommunityLibraryNetwork" target="_blank" rel="noopener noreferrer" aria-label="YouTube, opens a new window" data-nww-processed="true" data-original-title="YouTube"><span class="screen-reader-text">YouTube</span><i class="anww-external-link-icon" aria-hidden="true"></i></a><a class="fusion-social-network-icon fusion-tooltip fusion-instagram awb-icon-instagram" style="" data-placement="bottom" data-title="Instagram" data-toggle="tooltip" title="" href="https://www.instagram.com/communitylibrarynetwork/" target="_blank" rel="noopener noreferrer" aria-label="Instagram, opens a new window" data-nww-processed="true" data-original-title="Instagram"><span class="screen-reader-text">Instagram</span><i class="anww-external-link-icon" aria-hidden="true"></i></a><a class="awb-custom-icon fusion-social-network-icon fusion-tooltip fa-microphone-alt fas" style="position:relative;" data-placement="bottom" data-title="Podcasts" data-toggle="tooltip" title="" href="https://communitylibrary.net/category/library-network-podcasts/" target="_blank" rel="noopener noreferrer" aria-label="Podcasts, opens a new window" data-nww-processed="true" data-original-title="Podcasts"><span class="screen-reader-text">Podcasts</span><i class="anww-external-link-icon" aria-hidden="true"></i></a><a class="awb-custom-icon fusion-social-network-icon fusion-tooltip fa-calendar-alt fas" style="position:relative;" data-placement="bottom" data-title="Calendar" data-toggle="tooltip" title="" href="https://communitylibrary.libcal.com/" target="_blank" rel="noopener noreferrer" aria-label="Calendar, opens a new window" data-nww-processed="true" data-original-title="Calendar"><span class="screen-reader-text">Calendar</span><i class="anww-external-link-icon" aria-hidden="true"></i></a></div></div></div>			</div>
 			</div>

```
