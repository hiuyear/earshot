/// <reference types="node" />

/**
 * Phase 2 Daytona evidence script.
 *
 * Usage:
 *   npm run sandbox
 *   DAYTONA_MAX_TARGETS=5 npm run sandbox
 *   DAYTONA_RUN_SCAN=true npm run sandbox
 *
 * Contract:
 * - Reads frozen targets from targets.json.
 * - Creates or reuses Daytona sandboxes through REST, avoiding the current SDK
 *   dependency's high-severity audit issue.
 * - Runs a cheap isolated command by default; full scan mode is opt-in because
 *   Playwright install inside a sandbox can burn the hackathon clock.
 * - Writes local evidence even when Daytona auth/API fails.
 */
import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Target } from '../src/types';

type TargetsFile = { targets: Target[] };

type DaytonaResult = {
  target: Target;
  mode: 'daytona' | 'local-fallback';
  sandboxId: string | null;
  command: string;
  exitCode: number | null;
  result: string;
  error: string | null;
};

const API_URL = process.env.DAYTONA_API_URL ?? 'https://app.daytona.io/api';
const TOOLBOX_URL = process.env.DAYTONA_TOOLBOX_URL ?? 'https://proxy.app.daytona.io/toolbox';
const OUTPUT_DIR = join('out', 'daytona');
const REPO_URL = 'https://github.com/the-builders-burrow/earshot.git';

function loadTargets(): Target[] {
  const file = JSON.parse(readFileSync('targets.json', 'utf8')) as TargetsFile;
  const limit = Number.parseInt(process.env.DAYTONA_MAX_TARGETS ?? '1', 10);
  return file.targets.slice(0, Number.isFinite(limit) && limit > 0 ? limit : 1);
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.DAYTONA_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }
  return JSON.parse(text) as T;
}

function extractSandboxId(response: unknown): string {
  const record = response as Record<string, unknown>;
  const candidates = [record.id, record.sandboxId, record.name, record.info && (record.info as Record<string, unknown>).id];
  const id = candidates.find((value): value is string => typeof value === 'string' && value.length > 0);
  if (!id) throw new Error(`could not find sandbox id in create response: ${JSON.stringify(response)}`);
  return id;
}

async function createSandbox(): Promise<string> {
  if (process.env.DAYTONA_SANDBOX_ID) return process.env.DAYTONA_SANDBOX_ID;
  const response = await postJson<unknown>(`${API_URL}/sandbox`, {
    language: 'typescript',
    autoStopInterval: 15,
  });
  return extractSandboxId(response);
}

function commandForTarget(target: Target): string {
  if (process.env.DAYTONA_RUN_SCAN === 'true') {
    return [
      'set -e',
      'rm -rf /tmp/earshot',
      `git clone --depth 1 ${REPO_URL} /tmp/earshot`,
      'cd /tmp/earshot',
      'npm install',
      'npx playwright install chromium',
      `npm run audit -- ${JSON.stringify(target.url)}`,
    ].join(' && ');
  }

  return `console.log(JSON.stringify({ isolated: true, targetId: ${JSON.stringify(target.id)}, url: ${JSON.stringify(
    target.url,
  )}, runtime: process.version }))`;
}

async function executeInSandbox(sandboxId: string, command: string): Promise<{ exitCode: number | null; result: string }> {
  const timeout = Number.parseInt(process.env.DAYTONA_TIMEOUT_SECONDS ?? '120', 10);

  if (process.env.DAYTONA_RUN_SCAN !== 'true') {
    const response = await postJson<{ exitCode?: number; result?: string }>(
      `${TOOLBOX_URL}/${encodeURIComponent(sandboxId)}/process/code-run`,
      {
        code: command,
        language: 'typescript',
        timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 120,
      },
    );

    return {
      exitCode: typeof response.exitCode === 'number' ? response.exitCode : null,
      result: response.result ?? JSON.stringify(response),
    };
  }

  const response = await postJson<{ exitCode?: number; result?: string }>(
    `${TOOLBOX_URL}/${encodeURIComponent(sandboxId)}/process/execute`,
    {
      command,
      cwd: '/workspace',
      timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 120,
    },
  );

  return {
    exitCode: typeof response.exitCode === 'number' ? response.exitCode : null,
    result: response.result ?? JSON.stringify(response),
  };
}

async function runTarget(target: Target): Promise<DaytonaResult> {
  const command = commandForTarget(target);

  if (!process.env.DAYTONA_API_KEY) {
    return {
      target,
      mode: 'local-fallback',
      sandboxId: null,
      command,
      exitCode: null,
      result: 'DAYTONA_API_KEY is not set',
      error: 'missing Daytona key',
    };
  }

  try {
    const sandboxId = await createSandbox();
    const executed = await executeInSandbox(sandboxId, command);
    return {
      target,
      mode: 'daytona',
      sandboxId,
      command,
      exitCode: executed.exitCode,
      result: executed.result,
      error: null,
    };
  } catch (err) {
    return {
      target,
      mode: 'local-fallback',
      sandboxId: null,
      command,
      exitCode: null,
      result: 'Daytona unavailable; use local scan output for demo fallback.',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function writeEvidence(results: DaytonaResult[]): string {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const path = join(OUTPUT_DIR, `sandbox-${Date.now()}.json`);
  writeFileSync(path, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  return path;
}

async function main() {
  const targets = loadTargets();
  const results = await Promise.all(targets.map(runTarget));
  const path = writeEvidence(results);

  for (const result of results) {
    console.log(
      `${result.target.id}: ${result.mode}` +
        (result.sandboxId ? ` sandbox=${result.sandboxId}` : '') +
        (result.exitCode === null ? '' : ` exit=${result.exitCode}`),
    );
    if (result.error) console.log(`  ${result.error}`);
  }

  console.log(`wrote Daytona evidence: ${path}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
