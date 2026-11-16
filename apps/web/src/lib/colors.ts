import type { GiCategory, MealSlot } from '@/db/types';

/** Couleurs de données (variables CSS). Toujours doublées d'un libellé : jamais la couleur seule. */
export const SLOT_COLOR: Record<MealSlot, string> = {
  breakfast: 'var(--honey)',
  lunch: 'var(--terracotta)',
  snack: 'var(--sage)',
  dinner: 'var(--plum)',
  other: 'var(--ink-soft)',
};

export const GI_COLOR: Record<GiCategory, string> = {
  low: 'var(--sage)',
  medium: 'var(--honey)',
  high: 'var(--plum)',
};
