import type { Entry, FoodItem, MealSlot } from '@/db/types';
import { totalCarbs } from '@/lib/nutrition';

let n = 0;

export function item(p: Partial<FoodItem> & { carbsG: number }): FoodItem {
  return { id: `i${++n}`, name: 'Aliment', quantityG: 100, unit: 'g', confidence: 'estimate', ...p };
}

/** Entrée à une date locale donnée. */
export function entry(at: Date, mealSlot: MealSlot, items: FoodItem[]): Entry {
  return { id: `e${++n}`, createdAt: at.toISOString(), eatenAt: at.toISOString(), mealSlot, source: 'manual', items, totalCarbsG: totalCarbs(items) };
}

/** Date locale : jour J - `daysAgo` à `hour` heures, par rapport à NOW. */
export const NOW = new Date(2026, 5, 15, 13, 0); // lundi 15 juin 2026, 13 h
export function at(daysAgo: number, hour: number): Date {
  return new Date(2026, 5, 15 - daysAgo, Math.floor(hour), Math.round((hour % 1) * 60));
}
