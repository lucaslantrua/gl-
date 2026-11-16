import type { Insight, InsightContext, Rule } from './types';
import { dominantSlot } from './rules/dominantSlot';
import { highGiRecurring } from './rules/highGiRecurring';
import { lateCarbs } from './rules/lateCarbs';
import { lowFiber } from './rules/lowFiber';
import { progress } from './rules/progress';
import { regularity } from './rules/regularity';
import { remainingToday } from './rules/remainingToday';
import { sugaryDrinks } from './rules/sugaryDrinks';

export const RULES: Rule[] = [remainingToday, dominantSlot, sugaryDrinks, highGiRecurring, lateCarbs, lowFiber, progress, regularity];
export const MAX_INSIGHTS = 3;

/** Évalue toutes les règles. Local, déterministe : mêmes entrées, mêmes recos. */
export function evaluateAll(ctx: InsightContext): Insight[] {
  return RULES.map((r) => r.evaluate(ctx))
    .filter((i): i is Insight => i !== null)
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}

/** Les recos affichées : au plus 3, par priorité, sans celles que l'utilisateur a masquées. */
export function selectInsights(ctx: InsightContext, max = MAX_INSIGHTS): Insight[] {
  const hidden = new Set(ctx.settings.hiddenInsights ?? []);
  return evaluateAll(ctx)
    .filter((i) => !hidden.has(i.id))
    .slice(0, max);
}
