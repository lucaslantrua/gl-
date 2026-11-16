import { z } from 'zod';

export type GiCategory = 'low' | 'medium' | 'high';

/** Bas < 55, moyen 55-69, haut >= 70. */
export function giCategory(gi: number): GiCategory {
  return gi < 55 ? 'low' : gi < 70 ? 'medium' : 'high';
}

/* ---------- Ce que le modèle doit renvoyer ----------
 * Schémas de forme uniquement : les bornes et la cohérence sont vérifiées ensuite
 * par normalisePlate / normaliseLabel. */

const num = z.number().nullable();

export const PlateWire = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      estimatedQuantityG: z.number(),
      unit: z.enum(['g', 'ml']),
      carbsG: z.number(),
      carbsMinG: z.number(),
      carbsMaxG: z.number(),
      sugarsG: num,
      fiberG: num,
      proteinG: num,
      fatG: num,
      glycemicIndex: num,
      box: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).nullable(),
    }),
  ),
  notes: z.string(),
  overallConfidence: z.enum(['low', 'medium', 'high']),
});

export const LabelWire = z.object({
  name: z.string().nullable(),
  unit: z.enum(['g', 'ml']),
  per100: z.object({ carbs: num, sugars: num, fiber: num, protein: num, fat: num }),
  servingQuantity: num,
});

/* ---------- Ce que l'API renvoie au front ---------- */

export interface PlateItem {
  name: string;
  estimatedQuantityG: number;
  unit: 'g' | 'ml';
  carbsG: number;
  carbsMinG: number;
  carbsMaxG: number;
  sugarsG: number | null;
  fiberG: number | null;
  proteinG: number | null;
  fatG: number | null;
  glycemicIndex: number | null;
  giCategory: GiCategory | null;
  box: { x: number; y: number; w: number; h: number } | null;
}

export interface PlateResponse {
  items: PlateItem[];
  notes: string;
  overallConfidence: 'low' | 'medium' | 'high';
}

export interface LabelResponse {
  name: string | null;
  unit: 'g' | 'ml';
  per100: { carbs: number | null; sugars: number | null; fiber: number | null; protein: number | null; fat: number | null };
  servingQuantity: number | null;
  confidence: 'manufacturer';
}

/** Réponse du modèle hors schéma ou incohérente. Le message sert au retry, jamais à l'utilisateur. */
export class InvalidModelOutput extends Error {}

const between = (v: number, min: number, max: number) => Number.isFinite(v) && v >= min && v <= max;
const optional = (v: number | null | undefined, max: number): number | null => (typeof v === 'number' && between(v, 0, max) ? v : null);

/** Tolérant sur la forme (champs optionnels absents), strict sur les valeurs. */
export function normalisePlate(raw: unknown): PlateResponse {
  const loose = PlateWire.extend({
    // Les modèles répondent parfois null pour un champ qu'ils jugent inconnu, y compris l'unité.
    items: z.array(PlateWire.shape.items.element.partial({ sugarsG: true, fiberG: true, proteinG: true, fatG: true, glycemicIndex: true, box: true }).extend({ unit: z.enum(['g', 'ml']).nullish() })),
    notes: z.string().optional(),
    overallConfidence: PlateWire.shape.overallConfidence.optional(),
  }).safeParse(raw);
  if (!loose.success) throw new InvalidModelOutput(z.prettifyError(loose.error).slice(0, 400));
  const data = loose.data;
  if (data.items.length > 30) throw new InvalidModelOutput('items: at most 30 entries');
  const items = data.items.map((i, n): PlateItem => {
    const name = i.name.trim().slice(0, 120);
    if (!name) throw new InvalidModelOutput(`items.${n}.name: must not be empty`);
    if (!between(i.estimatedQuantityG, 0.001, 5000)) throw new InvalidModelOutput(`items.${n}.estimatedQuantityG: must be > 0 and <= 5000`);
    for (const k of ['carbsG', 'carbsMinG', 'carbsMaxG'] as const) {
      if (!between(i[k], 0, 2000)) throw new InvalidModelOutput(`items.${n}.${k}: must be between 0 and 2000`);
    }
    const gi = typeof i.glycemicIndex === 'number' && between(i.glycemicIndex, 0, 120) ? i.glycemicIndex : null;
    const b = i.box;
    const box = b && [b.x, b.y, b.w, b.h].every((v) => between(v, 0, 1)) ? b : null;
    return {
      name,
      estimatedQuantityG: i.estimatedQuantityG,
      unit: i.unit ?? 'g',
      carbsG: i.carbsG,
      // La fourchette contient toujours l'estimation centrale.
      carbsMinG: Math.min(i.carbsMinG, i.carbsG),
      carbsMaxG: Math.max(i.carbsMaxG, i.carbsG),
      sugarsG: optional(i.sugarsG, 2000),
      fiberG: optional(i.fiberG, 2000),
      proteinG: optional(i.proteinG, 2000),
      fatG: optional(i.fatG, 2000),
      glycemicIndex: gi,
      // La catégorie est dérivée de l'index : les deux ne peuvent pas se contredire.
      giCategory: gi != null ? giCategory(gi) : null,
      box,
    };
  });
  return { items, notes: data.notes ?? '', overallConfidence: data.overallConfidence ?? 'low' };
}

export function normaliseLabel(raw: unknown): LabelResponse {
  const loose = LabelWire.partial({ name: true, servingQuantity: true })
    .extend({ unit: z.enum(['g', 'ml']).nullish(), per100: LabelWire.shape.per100.partial() })
    .safeParse(raw);
  if (!loose.success) throw new InvalidModelOutput(z.prettifyError(loose.error).slice(0, 400));
  const d = loose.data;
  const p = d.per100;
  for (const [k, v] of Object.entries(p)) {
    if (typeof v === 'number' && !between(v, 0, 100)) throw new InvalidModelOutput(`per100.${k}: must be between 0 and 100`);
  }
  const serving = d.servingQuantity;
  return {
    name: d.name?.trim().slice(0, 120) || null,
    unit: d.unit ?? 'g',
    per100: { carbs: p.carbs ?? null, sugars: p.sugars ?? null, fiber: p.fiber ?? null, protein: p.protein ?? null, fat: p.fat ?? null },
    servingQuantity: typeof serving === 'number' && serving > 0 && serving <= 5000 ? serving : null,
    confidence: 'manufacturer',
  };
}
