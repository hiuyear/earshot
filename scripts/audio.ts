/// <reference types="node" />

/**
 * Phase 2 audio evidence script.
 *
 * Usage:
 *   npm run audio -- out/<report>.json
 *
 * Contract:
 * - Reads committed Earshot JSON output.
 * - Always writes a text fallback for the narration used in the video.
 * - Writes an MP3 only when ELEVENLABS_API_KEY is present and the ElevenLabs
 *   API body below has been implemented.
 */
import 'dotenv/config';
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Buffer } from 'node:buffer';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import type { ElevenLabs } from '@elevenlabs/elevenlabs-js';
import type { RemediationReport, SiteReport } from '../src/types';

type AudioInput = SiteReport | RemediationReport | RemediationReport[];

type Clip = {
  label: string;
  targetId: string;
  transcript: string;
};

const OUTPUT_DIR = join('out', 'audio');
const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';
const DEFAULT_OUTPUT_FORMAT: ElevenLabs.TextToSpeechConvertRequestOutputFormat = 'mp3_44100_128';
const DEFAULT_TIMEOUT_MS = 120_000;
const OUTPUT_FORMATS = new Set<ElevenLabs.TextToSpeechConvertRequestOutputFormat>([
  'mp3_22050_32',
  'mp3_24000_48',
  'mp3_44100_128',
  'mp3_44100_192',
  'mp3_44100_32',
  'mp3_44100_64',
  'mp3_44100_96',
]);

function usage(): never {
  console.error('usage: npm run audio -- out/<report>.json');
  process.exit(1);
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function loadJson(path: string): AudioInput {
  return JSON.parse(readFileSync(path, 'utf8')) as AudioInput;
}

function clipsFromInput(input: AudioInput): Clip[] {
  const report = Array.isArray(input) ? input[0] : input;
  if (!report) throw new Error('report file did not contain any site reports');

  if ('before' in report && 'after' in report) {
    return [
      {
        label: 'before',
        targetId: report.target.id,
        transcript: report.before.narration.transcript,
      },
      {
        label: 'after',
        targetId: report.target.id,
        transcript: report.after.narration.transcript,
      },
    ];
  }

  return [
    {
      label: 'baseline',
      targetId: report.target.id,
      transcript: report.narration.transcript,
    },
  ];
}

function writeTextFallback(clip: Clip, sourcePath: string): string {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const source = slug(basename(sourcePath, '.json'));
  const path = join(OUTPUT_DIR, `${source}-${slug(clip.targetId)}-${clip.label}.txt`);
  writeFileSync(path, clip.transcript);
  return path;
}

function audioPath(clip: Clip, sourcePath: string): string {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const source = slug(basename(sourcePath, '.json'));
  return join(OUTPUT_DIR, `${source}-${slug(clip.targetId)}-${clip.label}.mp3`);
}

function isPipeable(value: unknown): value is NodeJS.ReadableStream {
  return typeof (value as { pipe?: unknown } | null)?.pipe === 'function';
}

function isBlobLike(value: unknown): value is { arrayBuffer: () => Promise<ArrayBuffer> } {
  return typeof (value as { arrayBuffer?: unknown } | null)?.arrayBuffer === 'function';
}

function isWebStream(value: unknown): value is ReadableStream<Uint8Array> {
  return typeof (value as { getReader?: unknown } | null)?.getReader === 'function';
}

function timeoutMs(): number {
  const value = Number.parseInt(process.env.ELEVENLABS_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS), 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  const ms = timeoutMs();
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

// ElevenLabs' TTS endpoint hard-rejects text over this length (verified via a
// real 400: "Request text length (14338) exceeds the maximum text length of
// 10000 characters"). A text-heavy site's narration can exceed it even though
// narrate.ts caps by line count, not character count. Two-step fail-safe so a
// long transcript never blocks the mp3 the same way a missing key doesn't:
// try an LLM condense first (keeps every "unlabeled"/"blank" gap line, since
// those are the signal), then hard-truncate at a line boundary regardless.
const ELEVENLABS_MAX_CHARS = 10_000;
const SUMMARIZE_TARGET_CHARS = 9_000;

async function summarizeTranscript(transcript: string): Promise<string | null> {
  const key = process.env.FIREWORKS_API_KEY;
  if (!key) return null;

  const model = process.env.FIREWORKS_SMALL_MODEL ?? 'accounts/fireworks/models/gpt-oss-120b';
  const baseUrl = process.env.FIREWORKS_BASE_URL ?? 'https://api.fireworks.ai/inference/v1';

  const prompt = `Condense the following screen-reader narration transcript to under ${SUMMARIZE_TARGET_CHARS} characters so it fits a text-to-speech character limit.

Rules:
- Keep every line containing "unlabeled" or "blank" verbatim, in order — those are the accessibility gaps this transcript exists to surface. Never summarize or drop them.
- Condense everything else: collapse long runs of similar links/list items into a shorter representative line (e.g. "12 more links: ..." style), shorten verbose paragraph text.
- Preserve overall reading order.
- Output only the condensed transcript. No commentary, no JSON, no surrounding quotes.

Transcript:
"""
${transcript}
"""`;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim();
    return content && content.length > 0 ? content : null;
  } catch {
    return null;
  }
}

function hardTruncate(transcript: string, limit: number): string {
  if (transcript.length <= limit) return transcript;
  const suffix = '\n… (trimmed to fit ElevenLabs character limit)';
  const budget = Math.max(0, limit - suffix.length);
  const cut = transcript.slice(0, budget);
  const lastBreak = cut.lastIndexOf('\n');
  const clean = lastBreak > 0 ? cut.slice(0, lastBreak) : cut;
  return `${clean}${suffix}`;
}

/**
 * Never let a too-long transcript block the mp3. Try condensing it with an
 * LLM call first (best result — real content stays intelligible); if that's
 * unavailable, fails, or still doesn't fit, hard-truncate at a line boundary
 * as the unconditional final fail-safe.
 */
async function fitForTts(transcript: string): Promise<{ text: string; trimmed: 'none' | 'summarized' | 'truncated' }> {
  if (transcript.length <= ELEVENLABS_MAX_CHARS) return { text: transcript, trimmed: 'none' };

  const summarized = await summarizeTranscript(transcript);
  if (summarized && summarized.length <= ELEVENLABS_MAX_CHARS) {
    return { text: summarized, trimmed: 'summarized' };
  }

  return { text: hardTruncate(summarized ?? transcript, ELEVENLABS_MAX_CHARS), trimmed: 'truncated' };
}

function outputFormat(): ElevenLabs.TextToSpeechConvertRequestOutputFormat {
  const value = process.env.ELEVENLABS_OUTPUT_FORMAT;
  if (!value) return DEFAULT_OUTPUT_FORMAT;
  if (OUTPUT_FORMATS.has(value as ElevenLabs.TextToSpeechConvertRequestOutputFormat)) {
    return value as ElevenLabs.TextToSpeechConvertRequestOutputFormat;
  }

  console.log(`unknown ELEVENLABS_OUTPUT_FORMAT=${value}; using ${DEFAULT_OUTPUT_FORMAT}`);
  return DEFAULT_OUTPUT_FORMAT;
}

async function writeWebStream(stream: ReadableStream<Uint8Array>, path: string): Promise<void> {
  const reader = stream.getReader();
  const chunks: Buffer[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(Buffer.from(value));
  }

  writeFileSync(path, Buffer.concat(chunks));
}

async function writeAudioResponse(audio: unknown, path: string): Promise<void> {
  if (isPipeable(audio)) {
    await pipeline(audio, createWriteStream(path));
    return;
  }

  if (isWebStream(audio)) {
    await writeWebStream(audio, path);
    return;
  }

  if (isBlobLike(audio)) {
    writeFileSync(path, Buffer.from(await audio.arrayBuffer()));
    return;
  }

  if (audio instanceof ArrayBuffer) {
    writeFileSync(path, Buffer.from(audio));
    return;
  }

  if (audio instanceof Uint8Array) {
    writeFileSync(path, Buffer.from(audio));
    return;
  }

  throw new Error(`ElevenLabs returned unsupported audio response: ${Object.prototype.toString.call(audio)}`);
}

async function synthesizeWithElevenLabs(clip: Clip, sourcePath: string): Promise<string> {
  const client = new ElevenLabsClient();
  const path = audioPath(clip, sourcePath);
  const fit = await fitForTts(clip.transcript);

  if (fit.trimmed !== 'none') {
    console.log(
      `  transcript is ${clip.transcript.length} chars (over the ${ELEVENLABS_MAX_CHARS} limit) — ${fit.trimmed} to ${fit.text.length} chars for TTS`,
    );
  }

  const audio = await withTimeout(
    client.textToSpeech.convert(process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID, {
      text: fit.text,
      modelId: process.env.ELEVENLABS_MODEL_ID ?? DEFAULT_MODEL_ID,
      outputFormat: outputFormat(),
    }),
    'ElevenLabs conversion',
  );

  await withTimeout(writeAudioResponse(audio, path), 'ElevenLabs audio write');
  return path;
}

async function main() {
  const sourcePath = process.argv[2];
  if (!sourcePath) usage();

  const clips = clipsFromInput(loadJson(sourcePath));
  const hasElevenLabsKey = Boolean(process.env.ELEVENLABS_API_KEY);

  for (const clip of clips) {
    const textPath = writeTextFallback(clip, sourcePath);
    console.log(`wrote text fallback: ${textPath}`);

    if (!hasElevenLabsKey) {
      console.log('skipped mp3: ELEVENLABS_API_KEY is not set');
      continue;
    }

    try {
      const mp3Path = await synthesizeWithElevenLabs(clip, sourcePath);
      console.log(`wrote mp3: ${mp3Path}`);
    } catch (err) {
      console.log(`skipped mp3: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
