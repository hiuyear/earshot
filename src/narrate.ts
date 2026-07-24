import type { Page } from 'playwright';
import type { Narration, NarrationLine } from './types';

/**
 * THE KEY FUNCTION.
 *
 * Turns a page into the linear narration a screen reader would produce, so that a
 * judge who cannot see the page can be asked: could a blind user actually use this?
 *
 * Implementation note — deviation from the build spec:
 * The spec calls for `page.accessibility.snapshot()`. That API was deprecated in
 * Playwright 1.33 and is REMOVED in 1.61 (`page.accessibility` is `undefined` at
 * runtime). The supported replacement is `locator.ariaSnapshot()`, which returns the
 * accessibility tree as a YAML string. We parse that string back into nodes.
 *
 * Why parse their YAML rather than walk the tree ourselves over CDP
 * (`Accessibility.getFullAXTree`):
 *   - ariaSnapshot already applies the AX-tree pruning we would otherwise reimplement
 *     — it drops presentational nodes (`<img alt="">` correctly disappears) and
 *     generic containers, and emits in document order.
 *   - It is public, supported, and cross-browser; getFullAXTree is Chromium-only and
 *     returns a flat node array we would have to re-parent by hand.
 *   - Cost: we depend on a string format. Contained by keeping the parser pure and
 *     unit-testable (see `parseAriaSnapshot`), so a format change fails loudly here
 *     rather than silently degrading the narration.
 */

/** Cap so the Grader B prompt stays cheap. */
export const MAX_LINES = 150;
/** Per-line cap for prose content. */
const MAX_TEXT = 160;

/** Roles a screen-reader user navigates BY. Worth announcing even unnamed. */
const LANDMARK_ROLES = new Set([
  'banner', 'navigation', 'main', 'complementary', 'contentinfo',
  'search', 'form', 'region',
]);

/** Operable controls. An unnamed one is a dead end — always announce the gap. */
const INTERACTIVE_ROLES = new Set([
  'link', 'button', 'textbox', 'searchbox', 'checkbox', 'radio', 'combobox',
  'listbox', 'slider', 'spinbutton', 'switch', 'menuitem', 'menuitemcheckbox',
  'menuitemradio', 'tab', 'option', 'treeitem',
]);

/** Carries meaning visually. An unnamed one is information a blind user never gets. */
const INFORMATIVE_ROLES = new Set(['img', 'heading', 'iframe', 'figure']);

/** Nodes whose value is their text content, emitted as `role: text` by ariaSnapshot. */
const CONTENT_ROLES = new Set(['text', 'paragraph', 'caption', 'blockquote', 'code']);

/** ARIA role -> how a screen reader actually says it. */
const SPOKEN: Record<string, string> = {
  img: 'image',
  textbox: 'edit text',
  searchbox: 'search edit text',
  combobox: 'combo box',
  checkbox: 'check box',
  listitem: 'list item',
  rowheader: 'row header',
  columnheader: 'column header',
  menuitem: 'menu item',
  menuitemcheckbox: 'menu item check box',
  menuitemradio: 'menu item radio button',
  radio: 'radio button',
  spinbutton: 'spin button',
  treeitem: 'tree item',
  iframe: 'frame',
  contentinfo: 'content info',
};

/** Controls whose empty state a screen reader reports as "blank", not "unlabeled". */
const BLANK_ROLES = new Set(['textbox', 'searchbox', 'spinbutton']);

/** A node as it appears in the ariaSnapshot YAML, before screen-reader phrasing. */
export type AriaNode = {
  depth: number;
  role: string;
  /** Accessible name from the `role "name"` form. */
  name: string;
  /** Text content from the `role: text` form. */
  content: string;
  /** Bracket suffixes, e.g. `level=2`, `checked`, `disabled`. */
  states: string[];
};

/**
 * Parse the ariaSnapshot YAML into nodes. Pure and side-effect free so it can be
 * tested against fixtures without a browser.
 *
 * Grammar observed from Playwright 1.61 (probed, not assumed):
 *   `  - link "Donate":`          indent = 2 spaces per depth; trailing `:` = has children
 *   `  - heading "Title" [level=2]`  bracketed state suffixes
 *   `  - img`                      no name at all -> this is the signal we care about
 *   `  - paragraph: some text`     content form, unquoted after the colon
 *   `  - 'img "A photo: of, things"'`  whole item single-quoted when it contains ": "
 *   `  - /url: /donate`            property line, not a node
 */
export function parseAriaSnapshot(yaml: string): AriaNode[] {
  const nodes: AriaNode[] = [];

  for (const rawLine of yaml.split('\n')) {
    const m = /^(\s*)-\s+(.*)$/.exec(rawLine);
    if (!m) continue; // blank lines, or block-scalar continuations we intentionally drop

    const indent = m[1] ?? '';
    let body = (m[2] ?? '').trim();
    if (!body) continue;

    // `/url: /donate` and friends are properties of the parent node, not nodes.
    // Deliberately discarded: a screen reader does NOT read link targets aloud, so
    // letting them reach Grader B would leak information the blind user never gets.
    if (body.startsWith('/')) continue;

    const depth = Math.floor(indent.length / 2);

    // Trailing `:` marks "has children". Strip before unquoting — the children marker
    // sits outside the quotes: `- 'img "a: b"':`
    if (body.endsWith(':')) body = body.slice(0, -1);

    // YAML single-quotes the whole item when it contains a `: ` that would otherwise
    // read as a key/value split. Inside, `''` is a literal apostrophe.
    if (body.length >= 2 && body.startsWith("'") && body.endsWith("'")) {
      body = body.slice(1, -1).replace(/''/g, "'");
    }

    const roleMatch = /^([A-Za-z][A-Za-z0-9-]*)/.exec(body);
    if (!roleMatch) continue;

    const role = roleMatch[1] ?? '';
    let rest = body.slice(role.length);

    // Content form: `paragraph: some text`
    if (rest.startsWith(':')) {
      nodes.push({ depth, role, name: '', content: rest.slice(1).trim(), states: [] });
      continue;
    }

    // Name form: ` "Donate"`, with `\"` for literal quotes.
    let name = '';
    const nameMatch = /^\s+"((?:\\.|[^"\\])*)"/.exec(rest);
    if (nameMatch) {
      name = (nameMatch[1] ?? '').replace(/\\(.)/g, '$1');
      rest = rest.slice(nameMatch[0].length);
    }

    const states = [...rest.matchAll(/\[([^\]]*)\]/g)].map((s) => s[1] ?? '');

    nodes.push({ depth, role, name, content: '', states });
  }

  return nodes;
}

function truncate(s: string, max: number): string {
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** State suffixes a screen reader would append, e.g. `, checked`. */
function spokenStates(states: string[]): string[] {
  const out: string[] = [];
  for (const s of states) {
    if (s === 'checked') out.push('checked');
    else if (s === 'disabled') out.push('unavailable');
    else if (s === 'selected') out.push('selected');
    else if (s === 'expanded') out.push('expanded');
    else if (s === 'expanded=false') out.push('collapsed');
    else if (s === 'required') out.push('required');
  }
  return out;
}

/**
 * Render one parsed node as a screen reader would announce it.
 * Returns null for nodes a screen reader would pass over silently.
 */
export function renderNode(node: AriaNode): NarrationLine | null {
  const { role, states } = node;
  const name = node.name.trim();

  // Content nodes: the words on the page. Grader B needs these to answer
  // "what is this page for" at all.
  if (CONTENT_ROLES.has(role)) {
    const content = truncate(node.content, MAX_TEXT);
    if (!content) return null;
    return { role, name: content, states: [], isGap: false, text: `text, "${content}"` };
  }

  const spoken = SPOKEN[role] ?? role;
  const suffix = spokenStates(states);

  if (role === 'heading') {
    const levelState = states.find((s) => s.startsWith('level='));
    const level = levelState ? Number(levelState.slice('level='.length)) : undefined;
    const label = level ? `heading level ${level}` : 'heading';
    if (!name) {
      return { role, name: '', level, states: suffix, isGap: true, text: `${label}, unlabeled` };
    }
    return {
      role, name, level, states: suffix, isGap: false,
      text: [`${label}, "${truncate(name, MAX_TEXT)}"`, ...suffix].join(', '),
    };
  }

  if (LANDMARK_ROLES.has(role)) {
    // An unnamed landmark is still useful structure, not a failure. Don't cry wolf.
    const text = name ? `${spoken} landmark, "${truncate(name, MAX_TEXT)}"` : `${spoken} landmark`;
    return { role, name, states: suffix, isGap: false, text };
  }

  const isControl = INTERACTIVE_ROLES.has(role);
  const isInfo = INFORMATIVE_ROLES.has(role);

  if (isControl || isInfo) {
    if (!name) {
      // THE GAPS ARE THE SIGNAL. Never skip these — they are the whole point.
      const gapWord = BLANK_ROLES.has(role) ? 'blank' : 'unlabeled';
      return { role, name: '', states: suffix, isGap: true, text: `${spoken}, ${gapWord}` };
    }
    return {
      role, name, states: suffix, isGap: false,
      text: [`${spoken}, "${truncate(name, MAX_TEXT)}"`, ...suffix].join(', '),
    };
  }

  // Everything else (list, row, cell, group, generic…) is structural scaffolding.
  // Announce it only when it carries a name, otherwise it is noise that would
  // crowd out real content under the line cap.
  if (name) {
    return {
      role, name, states: suffix, isGap: false,
      text: [`${spoken}, "${truncate(name, MAX_TEXT)}"`, ...suffix].join(', '),
    };
  }

  return null;
}

/** Parsed nodes -> the narration object consumed by Grader B and ElevenLabs. */
export function buildNarration(nodes: AriaNode[]): Narration {
  const all: NarrationLine[] = [];
  for (const node of nodes) {
    const line = renderNode(node);
    if (line) all.push(line);
  }

  const truncated = all.length > MAX_LINES;
  const lines = truncated ? all.slice(0, MAX_LINES) : all;

  return {
    lines,
    transcript: lines.map((l) => l.text).join('\n'),
    gapCount: lines.filter((l) => l.isGap).length,
    truncated,
  };
}

/**
 * Narrate a live page.
 *
 * Failure mode guarded here (spec §13): "narration is empty / AX tree not ready".
 * The caller settles the network; we additionally retry once, because the AX tree
 * is computed lazily and can come back thin on a page that just finished painting.
 */
export async function narrate(page: Page): Promise<Narration> {
  let yaml = await page.locator('body').ariaSnapshot();
  let narration = buildNarration(parseAriaSnapshot(yaml));

  if (narration.lines.length < 3) {
    await page.waitForTimeout(1000);
    yaml = await page.locator('body').ariaSnapshot();
    narration = buildNarration(parseAriaSnapshot(yaml));
  }

  return narration;
}
