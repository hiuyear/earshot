import { chromium, type Browser, type Page } from 'playwright';
import { audit, byImpact, countNodes } from './audit';
import { narrate } from './narrate';
import type { Narration, Target, Violation } from './types';

export type ScanResult = {
  violations: Violation[];
  violationCount: number;
  violationsByImpact: Record<string, number>;
  narration: Narration;
};

export async function launch(): Promise<Browser> {
  return chromium.launch({ headless: true });
}

/**
 * Load a URL into a page that is settled enough for BOTH graders.
 *
 * `domcontentloaded` alone is what the spec prescribes for speed, but the
 * accessibility tree is computed lazily and comes back thin on a page that has
 * only just parsed — the "narration is empty" failure mode. So we go to
 * domcontentloaded with a hard timeout, then make a best-effort wait for the
 * network to settle. The settle is deliberately allowed to fail: on sites with
 * long-polling or ad beacons `networkidle` never fires, and a slow tail must not
 * cost us the scan we already have.
 */
export async function open(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
}

/** Run both graders' INPUTS against an already-loaded page. */
export async function scanPage(page: Page): Promise<ScanResult> {
  // Sequential, not Promise.all: axe injects and runs a large script in the page,
  // and taking the AX snapshot mid-run yields a tree that reflects axe's own
  // scaffolding rather than the page. Correctness beats the ~1s saved.
  const violations = await audit(page);
  const narration = await narrate(page);

  return {
    violations,
    violationCount: countNodes(violations),
    violationsByImpact: byImpact(violations),
    narration,
  };
}

/** Convenience: fresh context per target so cookies/state never leak between sites. */
export async function scanUrl(browser: Browser, target: Target): Promise<ScanResult> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await open(page, target.url);
    return await scanPage(page);
  } finally {
    await context.close();
  }
}
