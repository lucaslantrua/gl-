import { shareAfterHour } from '@/lib/aggregate';
import { lastDays, pct, type Rule } from '../types';

/** Règle 5 : plus de 30 % des glucides après 21 h sur 7 jours. */
export const lateCarbs: Rule = {
  id: 'late-carbs',
  evaluate(ctx) {
    const week = lastDays(ctx, 7);
    const share = shareAfterHour(week, 21);
    if (week.length < 6 || share == null || share <= 0.3) return null;
    return {
      id: this.id,
      priority: 60,
      tone: 'info',
      title: 'Beaucoup de glucides en soirée',
      body: 'Une bonne partie de tes glucides arrive après 21 h. Avancer un peu le dîner, ou alléger sa part de féculents, peut changer la donne.',
      evidence: `${pct(share)} % de tes glucides après 21 h sur 7 jours`,
    };
  },
};
