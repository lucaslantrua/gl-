import { sugaryDrinkStats } from '@/lib/aggregate';
import { lastDays, type Rule } from '../types';

/** Règle 3 : au moins 3 boissons sucrées sur 7 jours. */
export const sugaryDrinks: Rule = {
  id: 'sugary-drinks',
  evaluate(ctx) {
    const { count, cubes, sugarsG } = sugaryDrinkStats(lastDays(ctx, 7));
    if (count < 3) return null;
    return {
      id: this.id,
      priority: 80,
      tone: 'info',
      title: `${count} boissons sucrées cette semaine`,
      body: `Ça représente ${cubes} morceaux de sucre. Les boissons, c'est souvent le sucre qu'on voit le moins.`,
      evidence: `${Math.round(sugarsG)} g de sucres en 7 jours`,
      alternative: 'Les versions sans sucre, ou une eau pétillante avec un trait de citron, gardent le plaisir des bulles.',
    };
  },
};
