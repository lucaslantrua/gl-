import { addDays, startOfDay } from '@/lib/dates';
import { GI_TABLE } from '@/lib/gi-table';
import { giCategoryOf, round1, totalCarbs } from '@/lib/nutrition';
import { db } from './db';
import type { Entry, FoodItem, MealSlot, Source } from './types';

/** PRNG déterministe (mulberry32) : la démo est identique d'un lancement à l'autre. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DemoFood {
  name: string;
  qty: number;
  unit?: 'ml';
  /** Pour 100 g / ml. */
  carbs: number;
  sugars: number;
  fiber: number;
  gi?: string; // id de la table IG
  source: Source;
}

const F = (name: string, qty: number, carbs: number, sugars: number, fiber: number, gi: string | undefined, source: Source, unit?: 'ml'): DemoFood => ({ name, qty, carbs, sugars, fiber, gi, source, unit });

const MEALS: Record<Exclude<MealSlot, 'other'>, DemoFood[][]> = {
  breakfast: [
    [F('Baguette', 60, 56, 2.5, 3, 'baguette', 'plate_photo'), F('Confiture de fraise', 25, 60, 58, 1, 'jam', 'barcode')],
    [F("Flocons d'avoine", 50, 59, 1, 10, 'porridge', 'barcode'), F('Banane', 110, 20, 15, 2.6, 'banana', 'plate_photo')],
    [F('Céréales chocolatées', 45, 76, 28, 5, 'chocolate-cereal', 'barcode'), F('Lait demi-écrémé', 200, 4.8, 4.8, 0, 'milk', 'barcode', 'ml')],
    [F('Pain complet', 70, 43, 3, 7, 'wholemeal-bread', 'plate_photo'), F("Jus d'orange", 200, 9, 8.5, 0.2, 'orange-juice', 'barcode', 'ml')],
    [F('Croissant', 60, 45, 7, 2.5, 'croissant', 'plate_photo')],
  ],
  lunch: [
    [F('Pâtes cuites', 230, 28, 1, 1.8, 'pasta', 'plate_photo'), F('Sauce tomate', 100, 7, 5, 1.5, undefined, 'plate_photo')],
    [F('Riz basmati cuit', 200, 27, 0.2, 0.6, 'basmati-rice', 'plate_photo'), F('Poulet et légumes', 200, 4, 2.5, 2, undefined, 'plate_photo')],
    [F('Lentilles cuisinées', 250, 15, 1, 5, 'lentils', 'plate_photo'), F('Pain au levain', 40, 48, 2, 3.5, 'sourdough-bread', 'plate_photo')],
    [F('Sandwich jambon-beurre', 220, 30, 2, 1.8, 'baguette', 'plate_photo')],
    [F('Frites', 150, 34, 0.5, 3.5, 'fries', 'plate_photo'), F('Burger', 200, 21, 4, 1.5, 'burger-bun', 'plate_photo')],
    [F('Quinoa cuit', 180, 19, 0.9, 2.8, 'quinoa', 'plate_photo'), F('Légumes rôtis', 200, 8, 5, 3.5, undefined, 'plate_photo')],
  ],
  snack: [
    [F('Pomme', 150, 11.5, 10, 2.4, 'apple', 'manual')],
    [F('Cookies pépites de chocolat', 40, 62, 34, 3, 'cookies', 'barcode')],
    [F('Soda cola', 330, 10.6, 10.6, 0, 'cola', 'barcode', 'ml')],
    [F('Yaourt aux fruits', 125, 13, 12.5, 0.3, 'fruit-yogurt', 'barcode')],
    [F('Barre de céréales', 25, 66, 26, 4, 'cereal-bar', 'label_photo')],
    [F('Thé glacé pêche', 330, 4.5, 4.4, 0, 'iced-tea', 'barcode', 'ml')],
  ],
  dinner: [
    [F('Pizza margherita', 300, 30, 3.5, 2, 'pizza', 'plate_photo')],
    [F('Soupe de légumes', 300, 6, 3, 1.6, 'vegetable-soup', 'barcode'), F('Pain complet', 50, 43, 3, 7, 'wholemeal-bread', 'plate_photo')],
    [F('Purée de pommes de terre', 220, 14, 1.2, 1.5, 'mashed-potato', 'plate_photo'), F('Steak haché', 120, 0, 0, 0, undefined, 'plate_photo')],
    [F('Riz blanc cuit', 200, 28, 0.1, 0.4, 'white-rice', 'plate_photo'), F('Curry de légumes', 220, 7, 4, 2.5, undefined, 'plate_photo')],
    [F('Gnocchi', 220, 33, 0.6, 1.8, 'gnocchi', 'plate_photo')],
    [F('Salade composée', 280, 5, 3, 2.5, undefined, 'plate_photo'), F('Baguette', 50, 56, 2.5, 3, 'baguette', 'plate_photo')],
  ],
};

const HOURS: Record<Exclude<MealSlot, 'other'>, number> = { breakfast: 7.75, lunch: 12.75, snack: 16.5, dinner: 20 };

function toItem(f: DemoFood, r: () => number, id: string): FoodItem {
  const qty = Math.round((f.qty * (0.8 + r() * 0.4)) / 5) * 5;
  const k = qty / 100;
  const estimate = f.source === 'plate_photo' || f.source === 'manual';
  const carbs = round1(f.carbs * k);
  const gi = f.gi ? GI_TABLE.find((g) => g.id === f.gi)?.gi : undefined;
  return {
    id,
    name: f.name,
    quantityG: qty,
    unit: f.unit ?? 'g',
    carbsG: carbs,
    ...(f.source === 'plate_photo' ? { carbsMinG: round1(carbs * 0.82), carbsMaxG: round1(carbs * 1.2) } : {}),
    sugarsG: round1(f.sugars * k),
    fiberG: round1(f.fiber * k),
    glycemicIndex: gi,
    giCategory: gi != null ? giCategoryOf(gi) : undefined,
    confidence: estimate ? 'estimate' : 'manufacturer',
  };
}

/** Génère `days` jours d'entrées de démo se terminant à `now`. Fonction pure. */
export function generateDemoEntries(now: Date, days = 30, seed = 20250101): Entry[] {
  const r = rng(seed);
  const entries: Entry[] = [];
  const pick = <T,>(xs: T[]): T => xs[Math.floor(r() * xs.length)]!;
  for (let d = days - 1; d >= 0; d--) {
    const day = addDays(startOfDay(now), -d);
    (Object.keys(MEALS) as (keyof typeof MEALS)[]).forEach((slot, si) => {
      // On saute parfois le petit-déj ou le goûter : des journées réalistes, pas parfaites.
      if ((slot === 'snack' && r() < 0.3) || (slot === 'breakfast' && r() < 0.12)) return;
      const hour = HOURS[slot] + (r() - 0.5) * 1.4 + (slot === 'dinner' && r() < 0.2 ? 1.6 : 0);
      const eatenAt = new Date(day.getTime() + hour * 3_600_000);
      if (eatenAt > now) return;
      const meal = pick(MEALS[slot]);
      const items = meal.map((f, i) => toItem(f, r, `demo-${d}-${si}-${i}`));
      entries.push({
        id: `demo-${d}-${si}`,
        createdAt: eatenAt.toISOString(),
        eatenAt: eatenAt.toISOString(),
        mealSlot: slot,
        source: meal[0]!.source,
        items,
        totalCarbsG: totalCarbs(items),
      });
    });
  }
  return entries;
}

export async function seedDemo(now = new Date()): Promise<number> {
  const entries = generateDemoEntries(now);
  await db.entries.bulkPut(entries);
  return entries.length;
}

export async function clearDemo(): Promise<void> {
  await db.entries.where('id').startsWith('demo-').delete();
}
