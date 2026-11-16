import type { Page } from '@playwright/test';
import sharp from 'sharp';

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
const flip = (s: string) => [...s].map((b) => (b === '0' ? '1' : '0')).join('');
const rev = (s: string) => [...s].reverse().join('');

/** Image PNG d'un code-barres EAN-13 (le "code-barres mocké" du parcours scan). */
export async function ean13Png(code: string): Promise<Buffer> {
  const d = [...code].map(Number);
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += PARITY[d[0]!]![i - 1] === 'L' ? L[d[i]!]! : rev(flip(L[d[i]!]!));
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += flip(L[d[i]!]!);
  bits += '101';
  const m = 6;
  const quiet = 14;
  const w = (bits.length + quiet * 2) * m;
  const bars = [...bits].map((b, i) => (b === '1' ? `<rect x="${(i + quiet) * m}" y="40" width="${m}" height="320"/>` : '')).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="400"><rect width="100%" height="100%" fill="#fff"/>${bars}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function platePng(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="#e9dcc7"/><circle cx="400" cy="300" r="240" fill="#fff"/><circle cx="340" cy="290" r="110" fill="#e3b76a"/><circle cx="500" cy="330" r="70" fill="#b5432e"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Passe l'onboarding par l'interface. */
export async function onboard(page: Page, goal?: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: "C'est parti" }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continuer' }).click();
  if (goal) {
    await page.getByRole('textbox').fill(goal);
    await page.getByRole('button', { name: 'Valider mon objectif' }).click();
  } else {
    await page.getByRole('button', { name: "Je n'ai pas d'objectif" }).click();
  }
  await page.getByTestId('today-total').waitFor();
}

export const NUTELLA = {
  barcode: '3017620422003',
  name: 'Nutella',
  brand: 'Ferrero',
  unit: 'g',
  per100: { carbs: 57.5, sugars: 56.3, fiber: 0, protein: 6.3, fat: 30.9 },
  servingQuantity: 15,
  packageQuantity: 400,
  nutriscore: 'e',
  imageUrl: null,
  isBeverage: false,
  categories: ['en:spreads', 'en:sweet-spreads', 'en:hazelnut-spreads'],
};
