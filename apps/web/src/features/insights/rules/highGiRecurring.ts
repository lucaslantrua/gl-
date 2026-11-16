import { allItems } from '@/lib/aggregate';
import { lowerGiAlternative, matchGiByName, normalize } from '@/lib/gi-table';
import { lastDays, type Rule } from '../types';

/** Règle 4 : un aliment à IG haut revient au moins 4 fois en 14 jours → alternative de la table IG. */
export const highGiRecurring: Rule = {
  id: 'high-gi-recurring',
  evaluate(ctx) {
    const counts = new Map<string, { name: string; count: number; gi: number }>();
    for (const i of allItems(lastDays(ctx, 14))) {
      if (i.giCategory !== 'high' || i.glycemicIndex == null) continue;
      const k = normalize(i.name);
      const cur = counts.get(k) ?? { name: i.name, count: 0, gi: i.glycemicIndex };
      cur.count += 1;
      counts.set(k, cur);
    }
    const top = [...counts.values()].filter((c) => c.count >= 4).sort((a, b) => b.count - a.count)[0];
    if (!top) return null;
    const known = matchGiByName(top.name);
    const alt = known ? lowerGiAlternative(known) : undefined;
    return {
      id: this.id,
      priority: 70,
      tone: 'info',
      title: `${top.name} revient souvent`,
      body: `C'est un aliment à index glycémique haut (repère : ${Math.round(top.gi)}). Rien d'interdit, mais il y a des cousins plus doux.`,
      evidence: `${top.count} fois en 14 jours`,
      alternative: alt ? `À essayer à la place, de temps en temps : ${alt.name.toLowerCase()} (IG ${alt.gi}).` : undefined,
    };
  },
};
