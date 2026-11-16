import { fiberRatio } from '@/lib/aggregate';
import { lastDays, type Rule } from '../types';

/** Règle 6 : ratio fibres / glucides moyen inférieur à 0,1 sur 7 jours. */
export const lowFiber: Rule = {
  id: 'low-fiber',
  evaluate(ctx) {
    const week = lastDays(ctx, 7);
    const ratio = fiberRatio(week);
    if (week.length < 6 || ratio == null || ratio >= 0.1) return null;
    return {
      id: this.id,
      priority: 40,
      tone: 'info',
      title: 'Un peu léger en fibres',
      body: 'Les fibres accompagnent bien les glucides. Légumes secs, légumes, fruits entiers et céréales complètes en apportent facilement.',
      evidence: `${String(Math.round(ratio * 100) / 10).replace('.', ',')} g de fibres pour 10 g de glucides sur 7 jours`,
      alternative: 'Une idée simple : des lentilles ou des pois chiches à la place du féculent habituel, une ou deux fois dans la semaine.',
    };
  },
};
