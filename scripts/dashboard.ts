/// <reference types="node" />

/**
 * Generate a static demo dashboard from local Phase 2 artifacts.
 *
 * Usage:
 *   npm run dashboard
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RemediationReport } from '../src/types';

type BraintrustMetricsFile = {
  generatedAt: string;
  metrics: Array<{
    targetId: string;
    beforeViolationCount: number;
    afterViolationCount: number;
    violationDelta: number;
    noRegression: number;
    fixSuccessRate: number;
    flagRate: number;
    beforeComprehension: number | null;
    afterComprehension: number | null;
  }>;
};

type DaytonaEvidenceFile = {
  generatedAt: string;
  results: Array<{
    target: { id: string; url: string; label: string };
    mode: string;
    sandboxId: string | null;
    exitCode: number | null;
    result: string;
    error: string | null;
  }>;
};

const DASHBOARD_PATH = join('dashboard', 'index.html');

function latestFile(dir: string, suffix: string): string | null {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((file) => file.endsWith(suffix))
    .map((file) => join(dir, file))
    .sort();
  return files.at(-1) ?? null;
}

function readJson<T>(path: string | null): T | null {
  if (!path) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function latestReports(): RemediationReport[] {
  const path = latestFile('out', '.json');
  if (!path) return [];
  const raw = JSON.parse(readFileSync(path, 'utf8')) as RemediationReport | RemediationReport[];
  return Array.isArray(raw) ? raw : [raw];
}

function audioFiles(): string[] {
  if (!existsSync(join('out', 'audio'))) return [];
  return readdirSync(join('out', 'audio'))
    .filter((file) => file.endsWith('.txt') || file.endsWith('.mp3'))
    .sort()
    .map((file) => join('out', 'audio', file));
}

function renderReportCards(reports: RemediationReport[]): string {
  if (reports.length === 0) return '<p>No remediation reports found in <code>out/</code>.</p>';

  return reports
    .map((report) => {
      const beforeScore = report.before.judgment?.score ?? 'skipped';
      const afterScore = report.after.judgment?.score ?? 'skipped';
      const violationsLabel = `Axe violations: ${report.verify.beforeViolationCount} to ${report.verify.afterViolationCount}`;
      const keysLabel = `Violation keys: ${report.verify.removedViolationKeys.length} removed, ${report.verify.addedViolationKeys.length} added`;
      const comprehensionLabel = `Comprehension: ${beforeScore} to ${afterScore}`;
      const flaggedLabel = `Flagged for human: ${report.flaggedItems.length}`;
      // Stat tiles split the number and label into separate elements for the
      // visual layout, but neither <strong> nor <span> exposes an accessible
      // name from its sibling's text — narrate.ts's live audit found the
      // dashboard's own comprehension score at 2/5 because of exactly this:
      // labels reached the screen-reader narration, the numbers next to them
      // didn't. role="group" + aria-label carries one combined, coherent
      // announcement regardless of how the visual children get parsed.
      return `
        <article class="card">
          <h3>${escapeHtml(report.target.label)}</h3>
          <p class="muted">${escapeHtml(report.target.url)}</p>
          <div class="metrics">
            <div role="group" aria-label="${escapeHtml(violationsLabel)}"><strong aria-hidden="true">${report.verify.beforeViolationCount} -> ${report.verify.afterViolationCount}</strong><span aria-hidden="true">Axe violations</span></div>
            <div role="group" aria-label="${escapeHtml(keysLabel)}"><strong aria-hidden="true">-${report.verify.removedViolationKeys.length} +${report.verify.addedViolationKeys.length}</strong><span aria-hidden="true">Violation keys</span></div>
            <div role="group" aria-label="${escapeHtml(comprehensionLabel)}"><strong aria-hidden="true">${escapeHtml(beforeScore)} -> ${escapeHtml(afterScore)}</strong><span aria-hidden="true">Comprehension</span></div>
            <div role="group" aria-label="${escapeHtml(flaggedLabel)}"><strong aria-hidden="true">${report.flaggedItems.length}</strong><span aria-hidden="true">Flagged for human</span></div>
          </div>
        </article>`;
    })
    .join('\n');
}

function renderBraintrust(metrics: BraintrustMetricsFile | null): string {
  if (!metrics) return '<p>No Braintrust metrics file found.</p>';
  return metrics.metrics
    .map(
      (m) => `
        <tr>
          <td>${escapeHtml(m.targetId)}</td>
          <td>${m.beforeViolationCount} -> ${m.afterViolationCount}</td>
          <td>${m.violationDelta}</td>
          <td>${m.noRegression ? 'yes' : 'no'}</td>
          <td>${Math.round(m.fixSuccessRate * 100)}%</td>
          <td>${Math.round(m.flagRate * 100)}%</td>
          <td>${escapeHtml(m.beforeComprehension ?? 'skipped')} -> ${escapeHtml(m.afterComprehension ?? 'skipped')}</td>
        </tr>`,
    )
    .join('\n');
}

function renderDaytona(evidence: DaytonaEvidenceFile | null): string {
  if (!evidence) return '<p>No Daytona evidence file found.</p>';
  return evidence.results
    .map(
      (r) => `
        <article class="card">
          <h3>${escapeHtml(r.target.id)} — ${escapeHtml(r.mode)}</h3>
          <p><strong>Sandbox:</strong> ${escapeHtml(r.sandboxId ?? 'none')}</p>
          <p><strong>Exit:</strong> ${escapeHtml(r.exitCode ?? 'n/a')}</p>
          <pre>${escapeHtml(r.error ?? r.result)}</pre>
        </article>`,
    )
    .join('\n');
}

function renderAudio(files: string[]): string {
  if (files.length === 0) return '<p>No audio/text narration artifacts found.</p>';
  return `<ul>${files
    .map((file) => `<li><a href="../${escapeHtml(file)}">${escapeHtml(file)}</a></li>`)
    .join('\n')}</ul>`;
}

function main() {
  const reports = latestReports();
  const braintrust = readJson<BraintrustMetricsFile>(latestFile(join('out', 'braintrust'), '.json'));
  const daytona = readJson<DaytonaEvidenceFile>(latestFile(join('out', 'daytona'), '.json'));
  const audio = audioFiles();

  mkdirSync('dashboard', { recursive: true });
  writeFileSync(
    DASHBOARD_PATH,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Earshot Evidence Dashboard</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; background: #0b1020; color: #eef2ff; }
    body { margin: 0; padding: 32px; }
    main { max-width: 1120px; margin: 0 auto; }
    h1 { font-size: 42px; margin-bottom: 8px; }
    h2 { margin-top: 36px; }
    a { color: #93c5fd; }
    .muted { color: #a5b4fc; }
    .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
    .card { background: #111827; border: 1px solid #334155; border-radius: 18px; padding: 20px; box-shadow: 0 16px 48px #0005; }
    .metrics { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 16px; }
    .metrics div { background: #020617; border-radius: 12px; padding: 12px; }
    .metrics strong { display: block; font-size: 22px; }
    .metrics span { color: #cbd5e1; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; background: #111827; border-radius: 18px; overflow: hidden; }
    th, td { padding: 12px; border-bottom: 1px solid #334155; text-align: left; }
    th { color: #bfdbfe; background: #1e293b; }
    pre { white-space: pre-wrap; background: #020617; border-radius: 12px; padding: 12px; color: #d1d5db; }
    .warning { border-left: 4px solid #f59e0b; padding-left: 16px; color: #fde68a; }
  </style>
</head>
<body>
<main>
  <h1>Earshot Evidence Dashboard</h1>
  <p class="muted">Reviewable patches with verification evidence. This dashboard does not claim compliance.</p>
  <p class="warning">Generated from local artifacts at ${escapeHtml(new Date().toISOString())}.</p>

  <h2>Remediation Report</h2>
  <section class="grid">${renderReportCards(reports)}</section>

  <h2>Braintrust Metrics</h2>
  <table>
    <caption class="muted">Violations and Comprehension show axe violation count and Grader B's 1-5 narration comprehension score, each as before &#8594; after. Delta is the net change in violation count. Fix Rate is the share of proposed patches that were kept (not reverted). Flag Rate is the share of semantic violations the LLM tier declined to guess at and flagged for human review instead.</caption>
    <thead><tr><th>Target</th><th>Violations</th><th>Delta</th><th>No Regression</th><th>Fix Rate</th><th>Flag Rate</th><th>Comprehension</th></tr></thead>
    <tbody>${renderBraintrust(braintrust)}</tbody>
  </table>

  <h2>Daytona Sandbox Evidence</h2>
  <p class="muted">One isolated sandbox per target, running an untrusted-execution scan. Sandbox is the Daytona sandbox id; Exit is the scan process's exit code (0 = ran successfully); the block below is its raw stdout/stderr.</p>
  <section class="grid">${renderDaytona(daytona)}</section>

  <h2>Audio / Narration Artifacts</h2>
  ${renderAudio(audio)}
</main>
</body>
</html>`,
  );

  console.log(`wrote dashboard: ${DASHBOARD_PATH}`);
}

main();
