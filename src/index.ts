import 'dotenv/config';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { launch, open, scanPage } from './scan';
import { judge } from './judge';
import { planPatches } from './plan';
import { applyPatches, revertPatches } from './patch';
import { verifyRemediation } from './verify';
import { emitPatch, type EmitResult } from './emit';
import type { RemediationReport, SiteReport, Target } from './types';

type TargetsFile = { targets: Target[]; fallbacks?: Target[] };

function targetFromArg(url: string): Target {
  const parsed = new URL(url);
  const id = parsed.hostname.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  return { id: id || 'adhoc', url, label: url };
}

function loadTargets(): Target[] {
  const file = JSON.parse(readFileSync('targets.json', 'utf8')) as TargetsFile;
  // A single URL on argv overrides the frozen list — this is the "one real URL"
  // path the Phase 1 checkpoint asks for.
  const argUrl = process.argv[2];
  if (argUrl) return [targetFromArg(argUrl)];
  return file.targets;
}

function bar(label: string) {
  console.log(`\n${'─'.repeat(72)}\n${label}\n${'─'.repeat(72)}`);
}

async function makeSiteReport(target: Target, scan: Awaited<ReturnType<typeof scanPage>>): Promise<SiteReport> {
  const outcome = await judge(scan.narration);

  return {
    target,
    fetchedAt: new Date().toISOString(),
    violations: scan.violations,
    violationCount: scan.violationCount,
    violationsByImpact: scan.violationsByImpact,
    narration: scan.narration,
    judgment: outcome.ok ? outcome.judgment : null,
    judgeError: outcome.ok ? null : outcome.error,
  };
}

async function remediateTarget(
  browser: Awaited<ReturnType<typeof launch>>,
  target: Target,
): Promise<RemediationReport> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await open(page, target.url);
    const htmlBefore = await page.content();
    const scan = await scanPage(page);
    const before = await makeSiteReport(target, scan);
    const plan = await planPatches(page, before.violations);
    let patchResults = await applyPatches(page, plan.patches);
    let verification = await verifyRemediation(page, target, before);

    if (verification.verify.addedViolationKeys.length > 0) {
      patchResults = await revertPatches(page, patchResults);
      verification = await verifyRemediation(page, target, before);
    }

    const htmlAfter = await page.content();

    const report: RemediationReport = {
      target,
      fetchedAt: new Date().toISOString(),
      before,
      after: verification.after,
      patches: plan.patches,
      patchResults,
      flaggedItems: plan.flaggedItems,
      verify: verification.verify,
    };

    const emit = await emitPatch(report, htmlBefore, htmlAfter);
    reportEmit(target, emit);

    return report;
  } finally {
    await context.close();
  }
}

function reportEmit(target: Target, emit: EmitResult) {
  if (!emit.ok) {
    console.log(`\nPhase 3 emit — FAILED for ${target.label}: ${emit.error}`);
    return;
  }
  console.log(`\nPhase 3 emit — patch proposal written to ${emit.dir}/ (branch ${emit.branch})`);
  if (emit.prUrl) {
    console.log(`  PR opened: ${emit.prUrl}`);
  } else if (emit.prSkippedReason) {
    console.log(`  PR not opened: ${emit.prSkippedReason}`);
  }
}

function reportSite(r: SiteReport, label = r.target.label) {
  bar(`${r.target.label}\n${r.target.url}`);

  // GRADER A
  const impacts = Object.entries(r.violationsByImpact)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
  console.log(`\n${label} — Grader A: ${r.violationCount}` + (impacts ? `  (${impacts})` : ''));

  // The narration transcript — the artifact the whole project turns on.
  console.log(
    `\nNarration — ${r.narration.lines.length} lines, ${r.narration.gapCount} unlabeled gaps` +
      (r.narration.truncated ? ' (capped)' : ''),
  );
  console.log('┄'.repeat(72));
  console.log(r.narration.transcript);
  console.log('┄'.repeat(72));

  // GRADER B
  if (r.judgment) {
    const j = r.judgment;
    console.log(`\nGrader B — comprehension score: ${j.score}/5`);
    console.log(`  purpose:   ${j.purpose}`);
    console.log(`  actions:   ${j.actions.join(' · ') || '(none identified)'}`);
    console.log(`  unclear:   ${j.unclear.join(' · ') || '(none)'}`);
    console.log(`  reasoning: ${j.reasoning}`);
  } else {
    console.log(`\nGrader B — SKIPPED (${r.judgeError})`);
    console.log('  Narration + Grader A above still stand — set FIREWORKS_API_KEY for the score.');
  }
}

function reportRemediation(r: RemediationReport) {
  reportSite(r.before, 'Before');

  bar(`Phase 2 remediation\n${r.target.url}`);
  console.log(`\nPatches proposed: ${r.patches.length}`);
  console.log(
    `Patches applied:  ${r.patchResults.filter((p) => p.ok && !p.reverted).length}/${r.patchResults.length}` +
      (r.patchResults.some((p) => p.reverted) ? ' (regression reverted)' : ''),
  );
  console.log(`Flagged items:    ${r.flaggedItems.length}`);

  for (const result of r.patchResults) {
    const patch = result.patch;
    const selector = 'selector' in patch ? ` ${patch.selector}` : '';
    const status = result.reverted ? '↩' : result.ok ? '✓' : '✗';
    console.log(`  ${status} ${patch.action}${selector}${result.reason ? ` — ${result.reason}` : ''}`);
  }

  console.log(
    `\nViolation keys: -${r.verify.removedViolationKeys.length} +${r.verify.addedViolationKeys.length}`,
  );
  if (r.verify.addedViolationKeys.length) {
    console.log(`  Added: ${r.verify.addedViolationKeys.join(' · ')}`);
  }

  bar(`After\n${r.target.url}`);
  const impacts = Object.entries(r.after.violationsByImpact)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
  console.log(
    `\nGrader A — axe violations: ${r.verify.beforeViolationCount} → ${r.verify.afterViolationCount}` +
      (impacts ? `  (${impacts})` : ''),
  );

  const beforeScore = r.before.judgment ? `${r.before.judgment.score}/5` : `skipped (${r.before.judgeError})`;
  const afterScore = r.after.judgment ? `${r.after.judgment.score}/5` : `skipped (${r.after.judgeError})`;
  console.log(`Grader B — comprehension: ${beforeScore} → ${afterScore}`);
  console.log(
    `Narration gaps: ${r.before.narration.gapCount} → ${r.after.narration.gapCount}` +
      (r.after.narration.truncated ? ' (after capped)' : ''),
  );
}

async function main() {
  const targets = loadTargets();
  const browser = await launch();
  const reports: RemediationReport[] = [];

  try {
    for (const target of targets) {
      try {
        const r = await remediateTarget(browser, target);
        reportRemediation(r);
        reports.push(r);
      } catch (err) {
        bar(`${target.label}\n${target.url}`);
        console.log(`\nFAILED to scan: ${err instanceof Error ? err.message.split('\n')[0] : err}`);
      }
    }
  } finally {
    await browser.close();
  }

  // Persist for later phases (local JSON state, no DB — per spec).
  mkdirSync('out', { recursive: true });
  const path = `out/phase2-${Date.now()}.json`;
  writeFileSync(path, JSON.stringify(reports, null, 2));
  console.log(`\n\nSaved ${reports.length} remediation report(s) → ${path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
