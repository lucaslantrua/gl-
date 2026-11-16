import { dailyTotals, mean, stdDev } from '@/lib/aggregate';
import { lastDays, type Rule } from '../types';

/** Coefficient de variation à partir duquel les journées sont jugées très inégales. */
export const VARIATION_THRESHOLD = 0.35;

/** Règle 8 : forte variance du total journalier sur 14 jours. */
export const regularity: Rule = {
  id: 'regularity',
  evaluate(ctx) {
    const totals = [...dailyTotals(lastDays(ctx, 14)).values()];
    if (totals.length < 7) return null;
    const m = mean(totals);
    if (m <= 0 || stdDev(totals) / m <= VARIATION_THRESHOLD) return null;
    return {
      id: this.id,
      priority: 30,
      tone: 'info',
      title: 'Des journées en dents de scie',
      body: "Tes totaux varient beaucoup d'un jour à l'autre. Des repas un peu plus réguliers rendent les journées plus faciles à anticiper.",
      evidence: `de ${Math.round(Math.min(...totals))} g à ${Math.round(Math.max(...totals))} g par jour sur 14 jours`,
    };
  },
};
