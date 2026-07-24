import 'dotenv/config';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { launch, open, scanPage } from './scan';
import { judge } from './judge';
import type { SiteReport, Target } from './types';

type TargetsFile = { targets: Target[]; fallbacks?: Target[] };

function loadTargets(): Target[] {
  const file = JSON.parse(readFileSync('targets.json', 'utf8')) as TargetsFile;
  // A single URL on argv overrides the frozen list — this is the "one real URL"
  // path the Phase 1 checkpoint asks for.
  const argUrl = process.argv[2];
  if (argUrl) return [{ id: 'adhoc', url: argUrl, label: argUrl }];
  return file.targets;
}

function bar(label: string) {
  console.log(`\n${'─'.repeat(72)}\n${label}\n${'─'.repeat(72)}`);
}

async function scanTarget(browser: Awaited<ReturnType<typeof launch>>, target: Target): Promise<SiteReport> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await open(page, target.url);
    const scan = await scanPage(page);
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
  } finally {
    await context.close();
  }
}

function report(r: SiteReport) {
  bar(`${r.target.label}\n${r.target.url}`);

  // GRADER A
  const impacts = Object.entries(r.violationsByImpact)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
  console.log(`\nGrader A — axe violations: ${r.violationCount}` + (impacts ? `  (${impacts})` : ''));

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

async function main() {
  const targets = loadTargets();
  const browser = await launch();
  const reports: SiteReport[] = [];

  try {
    for (const target of targets) {
      try {
        const r = await scanTarget(browser, target);
        report(r);
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
  const path = `out/phase1-${Date.now()}.json`;
  writeFileSync(path, JSON.stringify(reports, null, 2));
  console.log(`\n\nSaved ${reports.length} report(s) → ${path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
