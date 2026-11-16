import { MEAL_SLOTS } from '@/db/types';
import { slotTotals, totalOf } from '@/lib/aggregate';
import { SLOT_LABEL } from '@/lib/dates';
import { lastDays, pct, type Rule } from '../types';

/** Règle 2 : un créneau représente plus de 40 % des glucides sur 7 jours. */
export const dominantSlot: Rule = {
  id: 'dominant-slot',
  evaluate(ctx) {
    const week = lastDays(ctx, 7);
    const total = totalOf(week);
    if (week.length < 6 || total <= 0) return null;
    const slots = slotTotals(week);
    const top = MEAL_SLOTS.filter((k) => k !== 'other').sort((a, b) => slots[b] - slots[a])[0]!;
    const share = slots[top] / total;
    if (share <= 0.4) return null;
    return {
      id: this.id,
      priority: 50,
      tone: 'info',
      title: `Ton ${SLOT_LABEL[top].toLowerCase()} pèse lourd`,
      body: 'Il concentre une bonne part de tes glucides. En déplacer un peu vers un autre repas peut lisser ta journée.',
      evidence: `${pct(share)} % de tes glucides sur 7 jours`,
    };
  },
};
