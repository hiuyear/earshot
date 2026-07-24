import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { RemediationReport } from './types';

/**
 * Phase 3 — emit a reviewable patch (spec §6).
 *
 * The design problem the spec doesn't solve: src/patch.ts mutates a LIVE page via
 * page.evaluate. We do not own the target site's source repository (gov.uk, a
 * local food bank's WordPress site, etc.), so "git checkout -b, gh pr create"
 * cannot open a PR against the site's actual codebase — the only repo we can
 * open a PR on is our own.
 *
 * Chosen approach (of the options considered): snapshot the fetched HTML into
 * `patches/<site>/`, diff it against the page state after Earshot's mutations,
 * and commit that diff + full evidence to a `fix/a11y-<site>` branch in THIS
 * repo, opened as a PR here. That gives CodeRabbit a real diff on a real PR to
 * review — the mechanism is real — but it is NOT a PR against the target site's
 * own repository, and the PR body says so explicitly. The alternative (a
 * self-owned fixture site so the loop really lands on a site we control) is a
 * stronger end-to-end proof but a weaker demo target; left as a follow-up, not
 * blocking here given the time box.
 *
 * Framing (tracker.md §Framing, hard requirement): never "compliant" / "fully
 * accessible". This is a reviewable proposal; a human disposes.
 */

function sh(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, { encoding: 'utf8' }).trim();
}

function tryDiff(beforePath: string, afterPath: string): string {
  try {
    // diff exits 1 when files differ — that's success for us, not an error.
    return execFileSync('diff', ['-u', beforePath, afterPath], { encoding: 'utf8' });
  } catch (err) {
    const e = err as { status?: number; stdout?: string };
    if (e.status === 1 && typeof e.stdout === 'string') return e.stdout;
    return `(diff failed: ${err instanceof Error ? err.message : err})`;
  }
}

function gitAvailable(): boolean {
  try {
    sh('git', ['rev-parse', '--is-inside-work-tree']);
    return true;
  } catch {
    return false;
  }
}

function branchTimestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
}

function ghAuthed(): boolean {
  try {
    sh('gh', ['auth', 'status']);
    return true;
  } catch {
    return false;
  }
}

function buildEvidenceBody(report: RemediationReport, diffText: string, narrationDiff: string): string {
  const v = report.verify;
  const beforeScore = v.beforeJudgment ? `${v.beforeJudgment.score}/5 — ${v.beforeJudgment.reasoning}` : `skipped (${v.beforeJudgeError})`;
  const afterScore = v.afterJudgment ? `${v.afterJudgment.score}/5 — ${v.afterJudgment.reasoning}` : `skipped (${v.afterJudgeError})`;

  const patchLines = report.patchResults
    .map((r) => {
      const status = r.reverted ? '↩ reverted' : r.ok ? '✓ applied' : '✗ failed';
      const selector = 'selector' in r.patch ? ` ${r.patch.selector}` : '';
      return `- ${status} — ${r.patch.action}${selector} — ${r.patch.reasoning}${r.reason ? ` (${r.reason})` : ''}`;
    })
    .join('\n') || '(none proposed)';

  const flagLines = report.flaggedItems
    .map((f) => `- \`${f.violationId}\` ${f.selector} — ${f.reason}: ${f.reasoning}`)
    .join('\n') || '(none)';

  return `# Earshot — accessibility remediation proposal for ${report.target.label}

**This is a reviewable patch proposal with verification evidence, not a compliance claim.** Earshot flags what it cannot determine instead of guessing. An agent proposes; a human disposes — nothing here should be read as "compliant" or "fully accessible."

Target: ${report.target.url}
Scanned: ${report.fetchedAt}

## What this PR is and isn't

This diffs a snapshot of the fetched HTML against Earshot's proposed DOM mutations for ${report.target.url}. **It is not a pull request against that site's actual source repository** — we don't have access to it. It's a reviewable proposal in the shape a real PR would take, for the site owner or for demo purposes, opened against this repo.

## Grader A — axe-core violations

Before: **${v.beforeViolationCount}**
After: **${v.afterViolationCount}**
Removed keys: ${v.removedViolationKeys.length ? v.removedViolationKeys.join(', ') : '(none)'}
Added keys (should be empty — the verifier reverts any fix that adds one): ${v.addedViolationKeys.length ? v.addedViolationKeys.join(', ') : '(none)'}

## Grader B — narration comprehension

Before: ${beforeScore}
After: ${afterScore}

## Patches proposed (${report.patches.length})

${patchLines}

## Flagged for human review (${report.flaggedItems.length})

A good flag rate is a feature — every item below is something the model declined to guess at.

${flagLines}

## Narration diff (before → after)

\`\`\`diff
${narrationDiff || '(no textual diff — narration unchanged)'}
\`\`\`

## HTML diff (snapshot before → after mutation)

\`\`\`diff
${diffText || '(no diff — no mutations survived verification)'}
\`\`\`
`;
}

export type EmitResult =
  | { ok: true; branch: string; dir: string; prUrl: string | null; prSkippedReason: string | null }
  | { ok: false; error: string };

/**
 * Write the reviewable patch artifacts and, if git/gh are available, commit them
 * to a `fix/a11y-<site>` branch and open a PR. Never blocks the pipeline: if git
 * or gh aren't available/authed, the local artifacts are still written and the
 * caller gets a clear reason why the PR step was skipped.
 */
export async function emitPatch(
  report: RemediationReport,
  htmlBefore: string,
  htmlAfter: string,
): Promise<EmitResult> {
  const site = report.target.id;
  const dir = `patches/${site}`;

  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/before.html`, htmlBefore);
    writeFileSync(`${dir}/after.html`, htmlAfter);

    const diffText = tryDiff(`${dir}/before.html`, `${dir}/after.html`);
    writeFileSync(`${dir}/diff.patch`, diffText);

    writeFileSync(`${dir}/before-narration.txt`, report.before.narration.transcript);
    writeFileSync(`${dir}/after-narration.txt`, report.after.narration.transcript);
    const narrationDiff = tryDiff(`${dir}/before-narration.txt`, `${dir}/after-narration.txt`);

    const body = buildEvidenceBody(report, diffText, narrationDiff);
    writeFileSync(`${dir}/EVIDENCE.md`, body);

    if (!gitAvailable()) {
      return { ok: true, branch: '(none)', dir, prUrl: null, prSkippedReason: 'git not available' };
    }

    const originalBranch = sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
    const branch = `fix/a11y-${site}-${branchTimestamp()}`;

    try {
      sh('git', ['checkout', '-B', branch]);
      sh('git', ['add', '-f', dir]);

      const hasStaged = (() => {
        try {
          sh('git', ['diff', '--cached', '--quiet']);
          return false;
        } catch {
          return true;
        }
      })();

      if (!hasStaged) {
        sh('git', ['checkout', originalBranch]);
        return { ok: true, branch, dir, prUrl: null, prSkippedReason: 'no changes to commit (patch identical to last run)' };
      }

      sh('git', [
        'commit',
        '-m',
        `fix(a11y): reviewable remediation proposal for ${report.target.label}\n\nAxe violations: ${report.verify.beforeViolationCount} -> ${report.verify.afterViolationCount}\nComprehension: ${report.before.judgment?.score ?? '?'} -> ${report.after.judgment?.score ?? '?'}\nFlagged for human review: ${report.flaggedItems.length}\n\nReviewable patch proposal with verification evidence, not a compliance claim.`,
      ]);

      let prUrl: string | null = null;
      let prSkippedReason: string | null = null;

      if (!ghAuthed()) {
        prSkippedReason = 'gh not installed/authenticated — branch committed locally, push + `gh pr create` manually';
      } else {
        try {
          sh('git', ['push', '-u', 'origin', branch]);
          const bodyFile = `${dir}/EVIDENCE.md`;
          prUrl = sh('gh', [
            'pr',
            'create',
            '--title',
            `fix(a11y): reviewable proposal for ${report.target.label}`,
            '--body-file',
            bodyFile,
          ]);
        } catch (err) {
          prSkippedReason = `gh pr create failed: ${err instanceof Error ? err.message : err}`;
        }
      }

      sh('git', ['checkout', originalBranch]);
      return { ok: true, branch, dir, prUrl, prSkippedReason };
    } catch (err) {
      // Never leave the caller's working tree on the fix branch after a failure.
      try {
        sh('git', ['checkout', originalBranch]);
      } catch {
        /* best effort */
      }
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
