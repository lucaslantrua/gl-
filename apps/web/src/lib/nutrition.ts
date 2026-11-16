import type { Entry, FoodItem, GiCategory, OffProduct } from '@/db/types';
import { matchGiByCategories } from './gi-table';

/** 1 morceau de sucre = 5 g de sucre. */
export const SUGAR_CUBE_G = 5;
/** Seuil (g de sucres pour 100 ml) à partir duquel une boisson est comptée comme sucrée. */
export const SUGARY_DRINK_THRESHOLD = 2.5;

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function giCategoryOf(gi: number): GiCategory {
  if (gi < 55) return 'low';
  if (gi < 70) return 'medium';
  return 'high';
}

/** Charge glycémique : CG = IG x glucides / 100. */
export function glycemicLoad(gi: number, carbsG: number): number {
  return round1((gi * carbsG) / 100);
}

export function sugarCubes(sugarsG: number | undefined): number {
  if (!sugarsG || sugarsG <= 0) return 0;
  return Math.round(sugarsG / SUGAR_CUBE_G);
}

const SCALED: (keyof FoodItem)[] = ['carbsG', 'carbsMinG', 'carbsMaxG', 'sugarsG', 'fiberG', 'proteinG', 'fatG'];

/**
 * Recalcule un item pour une nouvelle quantité, proportionnellement à l'item de référence.
 * Les valeurs absentes restent absentes (on n'invente rien).
 */
export function scaleItem(ref: FoodItem, quantityG: number): FoodItem {
  const out: FoodItem = { ...ref, quantityG };
  if (ref.quantityG <= 0) return out;
  const ratio = quantityG / ref.quantityG;
  const bag = out as unknown as Record<string, unknown>;
  for (const key of SCALED) {
    const v = ref[key];
    if (typeof v === 'number') bag[key] = round1(v * ratio);
  }
  return out;
}

/** Construit un item à partir de valeurs pour 100 g / 100 ml (produit scanné ou étiquette). */
export function itemFromPer100(
  p: Pick<OffProduct, 'name' | 'unit' | 'per100'> & Partial<OffProduct>,
  quantityG: number,
): FoodItem {
  const f = quantityG / 100;
  const opt = (v: number | null | undefined) => (typeof v === 'number' ? round1(v * f) : undefined);
  const gi = p.categories ? matchGiByCategories(p.categories) : undefined;
  return {
    id: uid(),
    name: [p.name, p.brand].filter(Boolean).join(' · '),
    quantityG,
    unit: p.unit,
    carbsG: round1(p.per100.carbs * f),
    sugarsG: opt(p.per100.sugars),
    fiberG: opt(p.per100.fiber),
    proteinG: opt(p.per100.protein),
    fatG: opt(p.per100.fat),
    glycemicIndex: gi?.gi,
    giCategory: gi ? giCategoryOf(gi.gi) : undefined,
    confidence: 'manufacturer',
    barcode: p.barcode,
    offImageUrl: p.imageUrl ?? undefined,
  };
}

export function totalCarbs(items: FoodItem[]): number {
  return round1(items.reduce((s, i) => s + (i.carbsG || 0), 0));
}

export function sumOptional(items: FoodItem[], key: 'sugarsG' | 'fiberG' | 'carbsMinG' | 'carbsMaxG'): number {
  return round1(items.reduce((s, i) => s + (i[key] ?? 0), 0));
}

/** Fourchette totale : les items sans fourchette comptent pour leur valeur exacte. */
export function carbRange(items: FoodItem[]): { min: number; max: number } | null {
  if (!items.some((i) => i.carbsMinG != null || i.carbsMaxG != null)) return null;
  return {
    min: round1(items.reduce((s, i) => s + (i.carbsMinG ?? i.carbsG), 0)),
    max: round1(items.reduce((s, i) => s + (i.carbsMaxG ?? i.carbsG), 0)),
  };
}

/** IG moyen pondéré par les glucides, sur les seuls items dont l'IG est connu. */
export function weightedGi(items: FoodItem[]): number | null {
  let num = 0;
  let den = 0;
  for (const i of items) {
    if (i.glycemicIndex != null && i.carbsG > 0) {
      num += i.glycemicIndex * i.carbsG;
      den += i.carbsG;
    }
  }
  return den > 0 ? Math.round(num / den) : null;
}

export function isSugaryDrink(i: FoodItem): boolean {
  if (i.unit !== 'ml' || i.quantityG <= 0) return false;
  const sugar = i.sugarsG ?? i.carbsG;
  return (sugar / i.quantityG) * 100 >= SUGARY_DRINK_THRESHOLD;
}

export function entryGi(e: Entry): number | null {
  return weightedGi(e.items);
}

export function entryTitle(e: Pick<Entry, 'items'>): string {
  if (e.items.length === 0) return 'Entrée vide';
  const [first, ...rest] = e.items;
  return rest.length ? `${first!.name} + ${rest.length}` : first!.name;
}

/** Affichage compact d'un nombre de grammes : 47, 12,5. */
export function fmt(n: number): string {
  const r = n >= 100 ? Math.round(n) : round1(n);
  return String(r).replace('.', ',');
}

export interface QuickQuantity {
  id: string;
  label: string;
  quantity: number;
}

/** Quantités rapides proposées pour un produit scanné. */
export function quickQuantities(p: Pick<OffProduct, 'unit' | 'servingQuantity' | 'isBeverage' | 'packageQuantity'>): QuickQuantity[] {
  const out: QuickQuantity[] = [];
  const u = p.unit;
  if (p.servingQuantity && p.servingQuantity > 0) {
    out.push({ id: 'serving', label: `Portion (${fmt(p.servingQuantity)} ${u})`, quantity: p.servingQuantity });
  }
  out.push({ id: '100', label: `100 ${u}`, quantity: 100 });
  if (p.isBeverage || u === 'ml') {
    out.push({ id: 'can', label: 'Canette 33 cl', quantity: 330 });
    out.push({ id: 'bottle', label: 'Bouteille 50 cl', quantity: 500 });
  }
  if (p.packageQuantity && p.packageQuantity > 0) {
    out.push({ id: 'half', label: 'Moitié du paquet', quantity: round1(p.packageQuantity / 2) });
  }
  return out;
}
