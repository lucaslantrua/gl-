import { describe, expect, it } from 'vitest';
import { at, entry, item } from '@/test-utils';
import { averageDaily, busiestWeekday, dailyTotals, entriesOfDay, fiberRatio, inRange, seriesByDay, shareAfterHour, slotTotals, stdDev, sugarSplit, sugaryDrinkStats, sweetestHour, topFoods, trendPct } from './aggregate';
import { addDays, dayKey, startOfDay, startOfMonth, startOfWeek } from './dates';

const entries = [
  entry(at(0, 8), 'breakfast', [item({ name: 'Baguette', carbsG: 30, sugarsG: 2, fiberG: 2, glycemicIndex: 75 })]),
  entry(at(0, 12.5), 'lunch', [item({ name: 'Pâtes', carbsG: 60, sugarsG: 2, fiberG: 4 }), item({ name: 'Cola', unit: 'ml', quantityG: 330, carbsG: 35, sugarsG: 35 })]),
  entry(at(1, 21.5), 'dinner', [item({ name: 'baguette', carbsG: 40 })]),
  entry(at(8, 12), 'lunch', [item({ name: 'Riz', carbsG: 50, sugarsG: 0, fiberG: 1 })]),
];

describe('agrégations par période', () => {
  it('totalise par jour local', () => {
    const totals = dailyTotals(entries);
    expect(totals.get(dayKey(at(0, 0)))).toBe(125);
    expect(totals.get(dayKey(at(1, 0)))).toBe(40);
  });

  it('découpe par jour, semaine et mois', () => {
    expect(entriesOfDay(entries, at(0, 23))).toHaveLength(2);
    const week = startOfWeek(at(0, 13));
    expect(inRange(entries, week, addDays(week, 7))).toHaveLength(2); // lundi 15 seulement
    const month = startOfMonth(at(0, 13));
    expect(inRange(entries, month, addDays(month, 30))).toHaveLength(4);
  });

  it('produit une série continue avec des zéros', () => {
    expect(seriesByDay(entries, startOfDay(at(2, 0)), 3).map((d) => d.total)).toEqual([0, 40, 125]);
  });

  it('fait la moyenne sur les jours suivis uniquement', () => {
    expect(averageDaily(entries)).toEqual({ average: 71.7, trackedDays: 3 });
    expect(averageDaily([])).toEqual({ average: 0, trackedDays: 0 });
  });

  it('calcule la tendance', () => {
    expect(trendPct(90, 100)).toBe(-10);
    expect(trendPct(90, 0)).toBeNull();
  });

  it('répartit par créneau repas', () => {
    expect(slotTotals(entries)).toEqual({ breakfast: 30, lunch: 145, snack: 0, dinner: 40, other: 0 });
  });

  it('sépare sucres, complexes et non renseignés', () => {
    expect(sugarSplit(entries)).toEqual({ sugars: 39, complex: 136, unknown: 40 });
  });

  it('classe les aliments contributeurs sans tenir compte de la casse', () => {
    expect(topFoods(entries, 2)).toEqual([
      { name: 'Baguette', carbsG: 70, count: 2 },
      { name: 'Pâtes', carbsG: 60, count: 1 },
    ]);
  });

  it('trouve le jour de la semaine le plus chargé', () => {
    expect(busiestWeekday(entries)).toEqual({ index: 0, average: 125 }); // lundi
    expect(busiestWeekday([])).toBeNull();
  });

  it('compte les boissons sucrées et leur équivalent', () => {
    expect(sugaryDrinkStats(entries)).toEqual({ count: 1, sugarsG: 35, cubes: 7 });
  });

  it("donne l'heure moyenne des prises les plus sucrées", () => {
    expect(sweetestHour(entries)).toBe(12.5);
    expect(sweetestHour([entries[2]!])).toBeNull();
  });

  it('calcule le ratio fibres / glucides et la part tardive', () => {
    expect(fiberRatio(entries)).toBeCloseTo(7 / 140);
    expect(fiberRatio([entries[2]!])).toBeNull();
    expect(shareAfterHour(entries, 21)).toBeCloseTo(40 / 215);
  });

  it("calcule l'écart-type", () => {
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
  });
});
