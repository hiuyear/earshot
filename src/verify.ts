import type { Page } from 'playwright';
import { countNodes, byImpact, violationKeys } from './audit';
import { judge } from './judge';
import { scanPage } from './scan';
import type { SiteReport, Target, VerifyResult } from './types';

export type Verification = {
  after: SiteReport;
  verify: VerifyResult;
};

function difference(left: Set<string>, right: Set<string>): string[] {
  return [...left].filter((key) => !right.has(key)).sort();
}

export async function verifyRemediation(
  page: Page,
  target: Target,
  before: SiteReport,
): Promise<Verification> {
  const scan = await scanPage(page);
  const outcome = await judge(scan.narration);

  const after: SiteReport = {
    target,
    fetchedAt: new Date().toISOString(),
    violations: scan.violations,
    violationCount: countNodes(scan.violations),
    violationsByImpact: byImpact(scan.violations),
    narration: scan.narration,
    judgment: outcome.ok ? outcome.judgment : null,
    judgeError: outcome.ok ? null : outcome.error,
  };

  const beforeKeys = violationKeys(before.violations);
  const afterKeys = violationKeys(after.violations);

  return {
    after,
    verify: {
      beforeViolationCount: before.violationCount,
      afterViolationCount: after.violationCount,
      removedViolationKeys: difference(beforeKeys, afterKeys),
      addedViolationKeys: difference(afterKeys, beforeKeys),
      beforeJudgment: before.judgment,
      afterJudgment: after.judgment,
      beforeJudgeError: before.judgeError,
      afterJudgeError: after.judgeError,
    },
  };
}
