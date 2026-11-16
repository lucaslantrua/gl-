import { describe, expect, it } from 'vitest';
import { item } from '@/test-utils';
import { carbRange, fmt, giCategoryOf, glycemicLoad, isSugaryDrink, itemFromPer100, quickQuantities, scaleItem, sugarCubes, totalCarbs, weightedGi } from './nutrition';

describe('quantités', () => {
  const pasta = item({ name: 'Pâtes', quantityG: 220, carbsG: 66, carbsMinG: 55, carbsMaxG: 80, fiberG: 4 });

  it('recalcule tout proportionnellement à la quantité', () => {
    const half = scaleItem(pasta, 110);
    expect(half).toMatchObject({ quantityG: 110, carbsG: 33, carbsMinG: 27.5, carbsMaxG: 40, fiberG: 2 });
  });

  it("n'invente pas les valeurs absentes", () => {
    expect(scaleItem(pasta, 110).sugarsG).toBeUndefined();
  });

  it('revient à la valeur de départ sans dérive', () => {
    expect(scaleItem(pasta, 220).carbsG).toBe(66);
    expect(scaleItem(pasta, 0).carbsG).toBe(0);
  });

  it('calcule un produit depuis ses valeurs pour 100 g', () => {
    const nutella = itemFromPer100({ barcode: '3017620422003', name: 'Nutella', brand: 'Ferrero', unit: 'g', per100: { carbs: 57.5, sugars: 56.3, fiber: null }, categories: ['en:spreads', 'en:hazelnut-spreads'] }, 15);
    expect(nutella).toMatchObject({ name: 'Nutella · Ferrero', carbsG: 8.6, sugarsG: 8.4, confidence: 'manufacturer', barcode: '3017620422003', glycemicIndex: 33, giCategory: 'low' });
    expect(nutella.fiberG).toBeUndefined();
  });

  it("laisse l'IG vide quand aucune catégorie ne correspond", () => {
    const x = itemFromPer100({ name: 'Mystère', unit: 'g', per100: { carbs: 10 }, categories: ['en:unknown-things'] }, 100);
    expect(x.glycemicIndex).toBeUndefined();
    expect(x.giCategory).toBeUndefined();
  });

  it('propose les quantités rapides adaptées', () => {
    expect(quickQuantities({ unit: 'ml', servingQuantity: 250, isBeverage: true, packageQuantity: 1500 }).map((q) => q.quantity)).toEqual([250, 100, 330, 500, 750]);
    expect(quickQuantities({ unit: 'g', servingQuantity: null, isBeverage: false, packageQuantity: null }).map((q) => q.id)).toEqual(['100']);
  });
});

describe('index et charge glycémiques', () => {
  it('classe bas < 55, moyen 55-69, haut >= 70', () => {
    expect([54, 55, 69, 70].map(giCategoryOf)).toEqual(['low', 'medium', 'medium', 'high']);
  });

  it('CG = IG x glucides / 100', () => {
    expect(glycemicLoad(50, 66)).toBe(33);
    expect(glycemicLoad(75, 34)).toBe(25.5);
  });

  it("pondère l'IG par les glucides et ignore les IG inconnus", () => {
    expect(weightedGi([item({ carbsG: 30, glycemicIndex: 80 }), item({ carbsG: 10, glycemicIndex: 40 }), item({ carbsG: 100 })])).toBe(70);
    expect(weightedGi([item({ carbsG: 100 })])).toBeNull();
  });
});

describe('équivalences et totaux', () => {
  it('1 morceau = 5 g de sucre', () => {
    expect(sugarCubes(45)).toBe(9);
    expect(sugarCubes(35)).toBe(7);
    expect(sugarCubes(undefined)).toBe(0);
    expect(sugarCubes(2)).toBe(0);
  });

  it('additionne les glucides et les fourchettes', () => {
    const items = [item({ carbsG: 66, carbsMinG: 55, carbsMaxG: 80 }), item({ carbsG: 8.6 })];
    expect(totalCarbs(items)).toBe(74.6);
    expect(carbRange(items)).toEqual({ min: 63.6, max: 88.6 });
    expect(carbRange([item({ carbsG: 8.6 })])).toBeNull();
  });

  it('repère les boissons sucrées', () => {
    expect(isSugaryDrink(item({ unit: 'ml', quantityG: 330, carbsG: 35, sugarsG: 35 }))).toBe(true);
    expect(isSugaryDrink(item({ unit: 'ml', quantityG: 330, carbsG: 0.3, sugarsG: 0 }))).toBe(false);
    expect(isSugaryDrink(item({ unit: 'g', quantityG: 330, carbsG: 35, sugarsG: 35 }))).toBe(false);
  });

  it('formate à la française', () => {
    expect(fmt(8.6)).toBe('8,6');
    expect(fmt(142.4)).toBe('142');
  });
});
