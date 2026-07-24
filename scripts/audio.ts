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

function outputFormat(): ElevenLabs.TextToSpeechConvertRequestOutputFormat {
  const value = process.env.ELEVENLABS_OUTPUT_FORMAT;
  if (!value) return DEFAULT_OUTPUT_FORMAT;
  if (OUTPUT_FORMATS.has(value as ElevenLabs.TextToSpeechConvertRequestOutputFormat)) {
    return value as ElevenLabs.TextToSpeechConvertRequestOutputFormat;
  }

  console.log(`unknown ELEVENLABS_OUTPUT_FORMAT=${value}; using ${DEFAULT_OUTPUT_FORMAT}`);
  return DEFAULT_OUTPUT_FORMAT;
}

async function synthesizeWithElevenLabs(clip: Clip, sourcePath: string): Promise<string> {
  const client = new ElevenLabsClient();
  const path = audioPath(clip, sourcePath);

  const audio = await client.textToSpeech.convert(process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID, {
    text: clip.transcript,
    modelId: process.env.ELEVENLABS_MODEL_ID ?? DEFAULT_MODEL_ID,
    outputFormat: outputFormat(),
  });

  if (!isPipeable(audio)) {
    throw new Error('ElevenLabs returned a non-stream audio response');
  }

  await pipeline(audio, createWriteStream(path));
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
