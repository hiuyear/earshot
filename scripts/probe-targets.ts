/**
 * Target vetting, not part of the pipeline.
 *
 * The spec says "load each manually first — a site that hangs will kill a live run."
 * This is that check, done by measurement rather than by assumption: for each
 * candidate we record load time, axe violation count, narration length and gap
 * count, so the five frozen targets are chosen on evidence.
 *
 *   npx tsx scripts/probe-targets.ts <url> [url...]
 */
import { launch, open, scanPage } from '../src/scan';

async function main() {
  const urls = process.argv.slice(2);
  if (urls.length === 0) {
    console.error('usage: tsx scripts/probe-targets.ts <url> [url...]');
    process.exit(1);
  }

  const browser = await launch();

  for (const url of urls) {
    const started = Date.now();
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await open(page, url);
      const r = await scanPage(page);
      const ms = Date.now() - started;
      console.log(
        [
          'OK  ',
          `${ms}ms`.padStart(7),
          `viol=${String(r.violationCount).padStart(4)}`,
          `lines=${String(r.narration.lines.length).padStart(4)}`,
          `gaps=${String(r.narration.gapCount).padStart(3)}`,
          `trunc=${r.narration.truncated ? 'Y' : 'n'}`,
          url,
        ].join('  '),
      );
    } catch (err) {
      const ms = Date.now() - started;
      const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
      console.log(`FAIL  ${`${ms}ms`.padStart(7)}  ${url}  — ${msg}`);
    } finally {
      await context.close();
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
