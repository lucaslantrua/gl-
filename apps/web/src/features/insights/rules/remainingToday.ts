import type { MealSlot } from '@/db/types';
import { entriesOfDay, totalOf } from '@/lib/aggregate';
import { SLOT_LABEL } from '@/lib/dates';
import type { Rule } from '../types';

const DEFAULT_SPLIT: Record<MealSlot, number> = { breakfast: 25, lunch: 35, snack: 10, dinner: 30, other: 0 };
/** Heure à partir de laquelle on considère le créneau comme passé. */
const SLOT_END: [MealSlot, number][] = [
  ['breakfast', 10.5],
  ['lunch', 14.5],
  ['snack', 18],
  ['dinner', 22.5],
];

/** Règle 1 : objectif défini → reste du jour et suggestion de répartition sur les repas restants. */
export const remainingToday: Rule = {
  id: 'remaining-today',
  evaluate({ entries, settings, now }) {
    const goal = settings.dailyCarbGoalG;
    if (!goal) return null;
    const today = entriesOfDay(entries, now);
    const total = totalOf(today);
    const rest = Math.round(goal - total);
    if (rest <= 0) return null;
    const hour = now.getHours() + now.getMinutes() / 60;
    const done = new Set(today.map((e) => e.mealSlot));
    const split = settings.mealSplit ?? DEFAULT_SPLIT;
    const left = SLOT_END.filter(([slot, end]) => hour < end && !done.has(slot) && split[slot] > 0).map(([slot]) => slot);
    if (!left.length) return null;
    const weight = left.reduce((a, k) => a + split[k], 0);
    const parts = left.map((k) => `${SLOT_LABEL[k].toLowerCase()} ${Math.round((rest * split[k]) / weight)} g`);
    return {
      id: this.id,
      priority: 90,
      tone: 'info',
      title: `Il te reste ${rest} g aujourd'hui`,
      body: left.length > 1 ? `Une façon de les répartir : ${parts.join(', ')}.` : `De quoi prévoir ton ${SLOT_LABEL[left[0]!].toLowerCase()} : environ ${rest} g.`,
      evidence: `${Math.round(total)} g notés sur ${goal} g`,
    };
  },
};
