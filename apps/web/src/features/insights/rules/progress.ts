import { averageDaily } from '@/lib/aggregate';
import { lastDays, type Rule } from '../types';

/** Règle 7 : moyenne en baisse de plus de 10 % par rapport à la semaine précédente. */
export const progress: Rule = {
  id: 'progress',
  evaluate(ctx) {
    const cur = averageDaily(lastDays(ctx, 7));
    const prev = averageDaily(lastDays(ctx, 7, 7));
    if (cur.trackedDays < 4 || prev.trackedDays < 4 || prev.average <= 0) return null;
    const change = (cur.average - prev.average) / prev.average;
    if (change >= -0.1) return null;
    return {
      id: this.id,
      priority: 75,
      tone: 'positive',
      title: 'Belle semaine',
      body: 'Ta moyenne de glucides a baissé par rapport à la semaine dernière. Ce que tu fais fonctionne.',
      evidence: `${Math.round(cur.average)} g par jour, contre ${Math.round(prev.average)} g la semaine d'avant (${Math.round(change * 100)} %)`,
    };
  },
};
