import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = new URL('.', import.meta.url).pathname;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
}

describe('garde-fous', () => {
  it('aucune occurrence de "insuline", "dose" ou "bolus" dans l’UI, sauf dans le disclaimer', () => {
    const files = walk(SRC).filter((f) => /\.(tsx?|css)$/.test(f) && !/\.test\.ts$/.test(f) && !f.endsWith('lib/copy.ts'));
    const hits = files.filter((f) => /insulin|\bdoses?\b|bolus/i.test(readFileSync(f, 'utf8')));
    expect(hits.map((f) => f.replace(SRC, ''))).toEqual([]);
  });
});

/* ---------- Contrastes WCAG AA des tokens, dans les deux thèmes ---------- */
function parseBlock(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1]!, m[2]!]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const TEXT_PAIRS: [fg: string, bg: string][] = [
  ['ink', 'cream'],
  ['ink', 'paper'],
  ['ink', 'sunken'],
  ['ink-soft', 'cream'],
  ['ink-soft', 'paper'],
  ['ink-soft', 'sunken'],
  ['on-cta', 'cta'],
  ['accent-text', 'cream'],
  ['accent-text', 'paper'],
  ['accent-text', 'terracotta-wash'],
  ['honey-text', 'honey-wash'],
  ['honey-text', 'paper'],
  ['sage-text', 'sage-wash'],
  ['sage-text', 'paper'],
  ['plum-text', 'plum-wash'],
  ['plum-text', 'paper'],
];

describe('contrastes WCAG AA', () => {
  const css = readFileSync(join(SRC, 'styles/tokens.css'), 'utf8');
  const light = parseBlock(css, ':root');
  const dark = { ...light, ...parseBlock(css, "[data-theme='dark']") };
  for (const [name, theme] of [['clair', light], ['sombre', dark]] as const) {
    it.each(TEXT_PAIRS)(`thème ${name} : %s sur %s >= 4,5`, (fg, bg) => {
      expect(contrast(theme[fg]!, theme[bg]!)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
