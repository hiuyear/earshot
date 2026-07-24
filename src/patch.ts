import type { Page } from 'playwright';
import type { Patch, PatchResult } from './types';

export async function applyPatch(page: Page, patch: Patch): Promise<PatchResult> {
  if (patch.action === 'flag_for_human') {
    return { patch, ok: false, reason: patch.reason, reverted: false };
  }

  try {
    const result = await page.evaluate((p) => {
      if (p.action === 'setLang') {
        const previousValue = document.documentElement.lang || null;
        document.documentElement.lang = p.value;
        return { ok: true, reason: null, previousValue };
      }

      if (p.action === 'insertSkipLink') {
        if (document.querySelector('[data-earshot-skip-link="true"]')) {
          return { ok: true, reason: 'skip link already present', inserted: false };
        }

        const target = document.querySelector(p.selector);
        if (!target) return { ok: false, reason: `selector not found: ${p.selector}` };

        const link = document.createElement('a');
        link.href = p.href;
        link.textContent = p.text;
        link.setAttribute('data-earshot-skip-link', 'true');
        link.setAttribute(
          'style',
          'position:absolute;left:0;top:0;z-index:9999;background:#fff;color:#000;padding:8px;',
        );
        target.insertBefore(link, target.firstChild);
        return { ok: true, reason: null, inserted: true };
      }

      const el = document.querySelector(p.selector);
      if (!el) return { ok: false, reason: `selector not found: ${p.selector}` };

      if (p.action === 'setAttribute') {
        const previousValue = el.getAttribute(p.attribute);
        el.setAttribute(p.attribute, p.value);
        return { ok: true, reason: null, previousValue };
      }

      if (p.action === 'setText') {
        const previousText = el.textContent;
        el.textContent = p.value;
        return { ok: true, reason: null, previousText };
      }

      return { ok: false, reason: 'unsupported patch action' };
    }, patch);

    return { patch, ...result, reverted: false };
  } catch (err) {
    return {
      patch,
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
      reverted: false,
    };
  }
}

export async function applyPatches(page: Page, patches: Patch[]): Promise<PatchResult[]> {
  const results: PatchResult[] = [];

  for (const patch of patches) {
    results.push(await applyPatch(page, patch));
  }

  return results;
}

export async function revertPatches(page: Page, results: PatchResult[]): Promise<PatchResult[]> {
  const reverted: PatchResult[] = [];

  for (const result of [...results].reverse()) {
    if (!result.ok || result.reverted || result.patch.action === 'flag_for_human') {
      reverted.push(result);
      continue;
    }

    const patch = result.patch;
    try {
      await page.evaluate((payload) => {
        const { patch: p, result: r } = payload;

        if (p.action === 'setLang') {
          document.documentElement.lang = r.previousValue ?? '';
          return;
        }

        if (p.action === 'insertSkipLink') {
          if (r.inserted) document.querySelector('[data-earshot-skip-link="true"]')?.remove();
          return;
        }

        const el = document.querySelector(p.selector);
        if (!el) return;

        if (p.action === 'setAttribute') {
          if (r.previousValue === null || r.previousValue === undefined) {
            el.removeAttribute(p.attribute);
          } else {
            el.setAttribute(p.attribute, r.previousValue);
          }
        } else if (p.action === 'setText') {
          el.textContent = r.previousText ?? '';
        }
      }, { patch, result });

      reverted.push({ ...result, reverted: true, reason: result.reason ?? 'reverted after verification regression' });
    } catch (err) {
      reverted.push({
        ...result,
        reason: `revert failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return reverted.reverse();
}
