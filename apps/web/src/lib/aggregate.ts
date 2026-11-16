import { MEAL_SLOTS, type Entry, type FoodItem, type MealSlot } from '@/db/types';
import { addDays, dayKey, startOfDay, weekdayIndex } from './dates';
import { normalize } from './gi-table';
import { isSugaryDrink, round1, sugarCubes, weightedGi } from './nutrition';

export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

export function mean(xs: number[]): number {
  return xs.length ? sum(xs) / xs.length : 0;
}

export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

export function allItems(entries: Entry[]): FoodItem[] {
  return entries.flatMap((e) => e.items);
}

export function totalOf(entries: Entry[]): number {
  return round1(sum(entries.map((e) => e.totalCarbsG)));
}

/** Entrées dont eatenAt est dans [from, to[. */
export function inRange(entries: Entry[], from: Date, to: Date): Entry[] {
  const a = from.toISOString();
  const b = to.toISOString();
  return entries.filter((e) => e.eatenAt >= a && e.eatenAt < b);
}

export function entriesOfDay(entries: Entry[], day: Date): Entry[] {
  const s = startOfDay(day);
  return inRange(entries, s, addDays(s, 1));
}

/** Total de glucides par jour local (clé YYYY-MM-DD). */
export function dailyTotals(entries: Entry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) {
    const k = dayKey(e.eatenAt);
    m.set(k, round1((m.get(k) ?? 0) + e.totalCarbsG));
  }
  return m;
}

/** Totaux jour par jour sur `days` jours à partir de `from` (0 pour les jours sans entrée). */
export function seriesByDay(entries: Entry[], from: Date, days: number): { day: Date; total: number }[] {
  const totals = dailyTotals(entries);
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(startOfDay(from), i);
    return { day, total: totals.get(dayKey(day)) ?? 0 };
  });
}

/** Moyenne journalière calculée sur les jours suivis (au moins une entrée). */
export function averageDaily(entries: Entry[]): { average: number; trackedDays: number } {
  const totals = [...dailyTotals(entries).values()];
  return { average: round1(mean(totals)), trackedDays: totals.length };
}

/** Variation en % entre deux moyennes ; null si la période précédente est vide. */
export function trendPct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function slotTotals(entries: Entry[]): Record<MealSlot, number> {
  const out = Object.fromEntries(MEAL_SLOTS.map((s) => [s, 0])) as Record<MealSlot, number>;
  for (const e of entries) out[e.mealSlot] = round1(out[e.mealSlot] + e.totalCarbsG);
  return out;
}

/** Part sucres / glucides complexes. Les glucides dont les sucres sont inconnus sont comptés à part. */
export function sugarSplit(entries: Entry[]): { sugars: number; complex: number; unknown: number } {
  let sugars = 0;
  let complex = 0;
  let unknown = 0;
  for (const i of allItems(entries)) {
    if (i.sugarsG == null) unknown += i.carbsG;
    else {
      const s = Math.min(i.sugarsG, i.carbsG);
      sugars += s;
      complex += i.carbsG - s;
    }
  }
  return { sugars: round1(sugars), complex: round1(complex), unknown: round1(unknown) };
}

export function periodGi(entries: Entry[]): number | null {
  return weightedGi(allItems(entries));
}

export interface FoodContribution {
  name: string;
  carbsG: number;
  count: number;
}

export function topFoods(entries: Entry[], n = 5): FoodContribution[] {
  const m = new Map<string, FoodContribution>();
  for (const i of allItems(entries)) {
    const k = normalize(i.name);
    const cur = m.get(k) ?? { name: i.name, carbsG: 0, count: 0 };
    cur.carbsG = round1(cur.carbsG + i.carbsG);
    cur.count += 1;
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => b.carbsG - a.carbsG).slice(0, n);
}

/** Jour de la semaine dont la moyenne journalière est la plus élevée (0 = lundi). */
export function busiestWeekday(entries: Entry[]): { index: number; average: number } | null {
  const buckets: number[][] = Array.from({ length: 7 }, () => []);
  for (const [k, total] of dailyTotals(entries)) {
    const [y, mo, d] = k.split('-').map(Number);
    buckets[weekdayIndex(new Date(y!, mo! - 1, d!))]!.push(total);
  }
  let best: { index: number; average: number } | null = null;
  buckets.forEach((b, index) => {
    if (!b.length) return;
    const average = round1(mean(b));
    if (!best || average > best.average) best = { index, average };
  });
  return best;
}

function entrySugars(e: Entry): number {
  return sum(e.items.map((i) => i.sugarsG ?? 0));
}

/** Heure moyenne (décimale) des prises les plus sucrées : le quart supérieur en sucres. */
export function sweetestHour(entries: Entry[]): number | null {
  const withSugar = entries.map((e) => ({ e, s: entrySugars(e) })).filter((x) => x.s > 0);
  if (!withSugar.length) return null;
  withSugar.sort((a, b) => b.s - a.s);
  const top = withSugar.slice(0, Math.max(1, Math.ceil(withSugar.length / 4)));
  return mean(
    top.map(({ e }) => {
      const d = new Date(e.eatenAt);
      return d.getHours() + d.getMinutes() / 60;
    }),
  );
}

export function sugaryDrinkStats(entries: Entry[]): { count: number; sugarsG: number; cubes: number } {
  const drinks = allItems(entries).filter(isSugaryDrink);
  const sugarsG = round1(sum(drinks.map((d) => d.sugarsG ?? d.carbsG)));
  return { count: drinks.length, sugarsG, cubes: sugarCubes(sugarsG) };
}

/** Ratio fibres / glucides sur les items dont les fibres sont connues. */
export function fiberRatio(entries: Entry[]): number | null {
  const known = allItems(entries).filter((i) => i.fiberG != null && i.carbsG > 0);
  const carbs = sum(known.map((i) => i.carbsG));
  if (carbs <= 0) return null;
  return sum(known.map((i) => i.fiberG ?? 0)) / carbs;
}

/** Part (0-1) des glucides consommés à partir de `hour` heures. */
export function shareAfterHour(entries: Entry[], hour: number): number | null {
  const total = totalOf(entries);
  if (total <= 0) return null;
  const late = sum(entries.filter((e) => new Date(e.eatenAt).getHours() >= hour).map((e) => e.totalCarbsG));
  return late / total;
}
