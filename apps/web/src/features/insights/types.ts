import type { Entry, Settings } from '@/db/types';
import { inRange } from '@/lib/aggregate';
import { addDays, startOfDay } from '@/lib/dates';

export interface InsightContext {
  /** Entrées des 30 derniers jours. */
  entries: Entry[];
  settings: Settings;
  now: Date;
}

export interface Insight {
  id: string;
  /** Plus c'est haut, plus la reco passe devant. */
  priority: number;
  tone: 'info' | 'positive';
  title: string;
  body: string;
  /** La donnée qui justifie la reco. */
  evidence: string;
  alternative?: string;
}

export interface Rule {
  id: string;
  evaluate(ctx: InsightContext): Insight | null;
}

/** Entrées des `days` derniers jours calendaires, aujourd'hui inclus, décalées de `offset` jours en arrière. */
export function lastDays(ctx: InsightContext, days: number, offset = 0): Entry[] {
  const end = addDays(startOfDay(ctx.now), 1 - offset);
  return inRange(ctx.entries, addDays(end, -days), end);
}

export const pct = (ratio: number): number => Math.round(ratio * 100);
