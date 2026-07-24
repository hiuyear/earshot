/// <reference types="node" />

/**
 * Phase 2 Braintrust evidence script.
 *
 * Usage:
 *   npm run braintrust -- out/<report>.json
 *
 * Contract:
 * - Reads saved Earshot remediation reports.
 * - Computes deterministic metrics locally.
 * - Writes a local JSON summary no matter what.
 * - Uploads one Braintrust event per site when BRAINTRUST_API_KEY is valid.
 */
import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { flush, init, log, summarize } from 'braintrust';
import type { RemediationReport } from '../src/types';

type BraintrustInput = RemediationReport | RemediationReport[];

type SiteMetrics = {
  targetId: string;
  label: string;
  url: string;
  beforeViolationCount: number;
  afterViolationCount: number;
  violationDelta: number;
  removedViolationKeys: number;
  addedViolationKeys: number;
  noRegression: number;
  patchesProposed: number;
  patchesKept: number;
  fixSuccessRate: number;
  flaggedItems: number;
  flagRate: number;
  beforeComprehension: number | null;
  afterComprehension: number | null;
  comprehensionDelta: number | null;
  beforeGaps: number;
  afterGaps: number;
  gapDelta: number;
};

const OUTPUT_DIR = join('out', 'braintrust');

function usage(): never {
  console.error('usage: npm run braintrust -- out/<report>.json');
  process.exit(1);
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function loadReports(path: string): RemediationReport[] {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as BraintrustInput;
  return Array.isArray(raw) ? raw : [raw];
}

function safeRate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function normalizedImprovement(before: number, after: number): number {
  if (before <= 0) return after <= 0 ? 1 : 0;
  return Math.max(0, Math.min(1, (before - after) / before));
}

function metricsForReport(report: RemediationReport): SiteMetrics {
  const patchesKept = report.patchResults.filter((r) => r.ok && !r.reverted).length;
  const beforeScore = report.before.judgment?.score ?? null;
  const afterScore = report.after.judgment?.score ?? null;
  const gapDelta = report.before.narration.gapCount - report.after.narration.gapCount;

  return {
    targetId: report.target.id,
    label: report.target.label,
    url: report.target.url,
    beforeViolationCount: report.verify.beforeViolationCount,
    afterViolationCount: report.verify.afterViolationCount,
    violationDelta: report.verify.beforeViolationCount - report.verify.afterViolationCount,
    removedViolationKeys: report.verify.removedViolationKeys.length,
    addedViolationKeys: report.verify.addedViolationKeys.length,
    noRegression: report.verify.addedViolationKeys.length === 0 ? 1 : 0,
    patchesProposed: report.patches.length,
    patchesKept,
    fixSuccessRate: safeRate(patchesKept, report.patches.length),
    flaggedItems: report.flaggedItems.length,
    flagRate: safeRate(report.flaggedItems.length, report.patches.length + report.flaggedItems.length),
    beforeComprehension: beforeScore,
    afterComprehension: afterScore,
    comprehensionDelta: beforeScore === null || afterScore === null ? null : afterScore - beforeScore,
    beforeGaps: report.before.narration.gapCount,
    afterGaps: report.after.narration.gapCount,
    gapDelta,
  };
}

function writeLocalSummary(sourcePath: string, metrics: SiteMetrics[]): string {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const path = join(OUTPUT_DIR, `${slug(basename(sourcePath, '.json'))}-metrics.json`);
  writeFileSync(path, JSON.stringify({ generatedAt: new Date().toISOString(), metrics }, null, 2));
  return path;
}

async function uploadToBraintrust(sourcePath: string, metrics: SiteMetrics[]): Promise<void> {
  init({
    project: process.env.BRAINTRUST_PROJECT ?? 'Earshot',
    experiment: process.env.BRAINTRUST_EXPERIMENT ?? `phase-2-${slug(basename(sourcePath, '.json'))}`,
    metadata: {
      sourcePath,
      branch: 'phase-2',
      artifact: 'remediation-report',
    },
  });

  for (const m of metrics) {
    log({
      input: {
        targetId: m.targetId,
        url: m.url,
        label: m.label,
      },
      output: {
        beforeViolationCount: m.beforeViolationCount,
        afterViolationCount: m.afterViolationCount,
        beforeComprehension: m.beforeComprehension,
        afterComprehension: m.afterComprehension,
        removedViolationKeys: m.removedViolationKeys,
        addedViolationKeys: m.addedViolationKeys,
        flaggedItems: m.flaggedItems,
      },
      scores: {
        no_regression: m.noRegression,
        violation_improvement: normalizedImprovement(m.beforeViolationCount, m.afterViolationCount),
        gap_improvement: normalizedImprovement(m.beforeGaps, m.afterGaps),
        comprehension_score: m.afterComprehension === null ? 0 : m.afterComprehension / 5,
        comprehension_improvement:
          m.beforeComprehension === null || m.afterComprehension === null
            ? 0
            : Math.max(0, Math.min(1, (m.afterComprehension - m.beforeComprehension) / 4)),
        fix_success_rate: m.fixSuccessRate,
        flag_rate: m.flagRate,
      },
      metadata: m,
      tags: ['phase-2', 'sponsor-evidence', 'accessibility'],
    });
  }

  await flush();

  try {
    const summary = await summarize({ summarizeScores: true });
    console.log(`Braintrust summary: ${JSON.stringify(summary, null, 2)}`);
  } catch (err) {
    console.log(`Braintrust uploaded but summary failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main() {
  const sourcePath = process.argv[2];
  if (!sourcePath) usage();

  const reports = loadReports(sourcePath);
  const metrics = reports.map(metricsForReport);
  const localPath = writeLocalSummary(sourcePath, metrics);
  console.log(`wrote local metrics: ${localPath}`);

  for (const m of metrics) {
    console.log(
      `${m.targetId}: violations ${m.beforeViolationCount} -> ${m.afterViolationCount}; ` +
        `keys -${m.removedViolationKeys} +${m.addedViolationKeys}; ` +
        `flags ${m.flaggedItems}`,
    );
  }

  if (!process.env.BRAINTRUST_API_KEY) {
    console.log('skipped Braintrust upload: BRAINTRUST_API_KEY is not set');
    return;
  }

  try {
    await uploadToBraintrust(sourcePath, metrics);
    console.log('uploaded metrics to Braintrust');
  } catch (err) {
    console.log(`skipped Braintrust upload: ${err instanceof Error ? err.message : String(err)}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
