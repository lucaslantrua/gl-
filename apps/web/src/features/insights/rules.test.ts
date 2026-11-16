import { describe, expect, it } from 'vitest';
import { generateDemoEntries } from '@/db/seed';
import { DEFAULT_SETTINGS, type Entry, type Settings } from '@/db/types';
import { at, entry, item, NOW } from '@/test-utils';
import { evaluateAll, RULES, selectInsights } from './engine';
import { dominantSlot } from './rules/dominantSlot';
import { highGiRecurring } from './rules/highGiRecurring';
import { lateCarbs } from './rules/lateCarbs';
import { lowFiber } from './rules/lowFiber';
import { progress } from './rules/progress';
import { regularity } from './rules/regularity';
import { remainingToday } from './rules/remainingToday';
import { sugaryDrinks } from './rules/sugaryDrinks';
import type { InsightContext } from './types';

const ctx = (entries: Entry[], settings: Partial<Settings> = {}, now = NOW): InsightContext => ({ entries, settings: { ...DEFAULT_SETTINGS, ...settings }, now });

/** Une semaine "neutre" : 3 repas équilibrés par jour, riches en fibres, sans rien de notable. */
const plainDay = (d: number, carbs = 50) => [
  entry(at(d, 8), 'breakfast', [item({ name: 'Porridge', carbsG: carbs, sugarsG: 5, fiberG: carbs * 0.15, glycemicIndex: 55, giCategory: 'medium' })]),
  entry(at(d, 12.5), 'lunch', [item({ name: 'Lentilles', carbsG: carbs, sugarsG: 2, fiberG: carbs * 0.2, glycemicIndex: 32, giCategory: 'low' })]),
  entry(at(d, 19.5), 'dinner', [item({ name: 'Quinoa', carbsG: carbs, sugarsG: 2, fiberG: carbs * 0.15, glycemicIndex: 53, giCategory: 'low' })]),
];
const plainWeek = (from = 1, carbs = 50) => Array.from({ length: 7 }, (_, i) => plainDay(from + i, carbs)).flat();

describe('règle 1 : reste du jour', () => {
  const morning = [entry(at(0, 8), 'breakfast', [item({ carbsG: 47 })])];
  it('affiche le reste et une répartition sur les repas restants', () => {
    const r = remainingToday.evaluate(ctx(morning, { dailyCarbGoalG: 130 }))!;
    expect(r.title).toBe("Il te reste 83 g aujourd'hui");
    // À 13 h : déjeuner (35), goûter (10) et dîner (30) restent → 83 g répartis au prorata.
    expect(r.body).toBe('Une façon de les répartir : déjeuner 39 g, goûter 11 g, dîner 33 g.');
    expect(r.evidence).toBe('47 g notés sur 130 g');
  });
  it('suit la répartition personnalisée', () => {
    const r = remainingToday.evaluate(ctx(morning, { dailyCarbGoalG: 147, mealSplit: { breakfast: 20, lunch: 50, snack: 0, dinner: 50, other: 0 } }))!;
    expect(r.body).toBe('Une façon de les répartir : déjeuner 50 g, dîner 50 g.');
  });
  it('se tait sans objectif, objectif atteint, ou journée finie', () => {
    expect(remainingToday.evaluate(ctx(morning))).toBeNull();
    expect(remainingToday.evaluate(ctx(morning, { dailyCarbGoalG: 40 }))).toBeNull();
    expect(remainingToday.evaluate(ctx(morning, { dailyCarbGoalG: 130 }, at(0, 23)))).toBeNull();
  });
});

describe('règle 2 : créneau dominant', () => {
  it('se déclenche au-delà de 40 % sur 7 jours', () => {
    const heavy = Array.from({ length: 7 }, (_, d) => [entry(at(d, 8), 'breakfast', [item({ carbsG: 20 })]), entry(at(d, 20), 'dinner', [item({ carbsG: 80 })])]).flat();
    const r = dominantSlot.evaluate(ctx(heavy))!;
    expect(r.title).toBe('Ton dîner pèse lourd');
    expect(r.evidence).toBe('80 % de tes glucides sur 7 jours');
  });
  it('se tait quand les repas sont équilibrés ou les données trop minces', () => {
    expect(dominantSlot.evaluate(ctx(plainWeek()))).toBeNull();
    expect(dominantSlot.evaluate(ctx([entry(at(0, 20), 'dinner', [item({ carbsG: 80 })])]))).toBeNull();
  });
});

describe('règle 3 : boissons sucrées', () => {
  const cola = (d: number) => entry(at(d, 16), 'snack', [item({ name: 'Cola', unit: 'ml', quantityG: 330, carbsG: 35, sugarsG: 35 })]);
  it('se déclenche à partir de 3 boissons en 7 jours, avec l’équivalent en sucre', () => {
    const r = sugaryDrinks.evaluate(ctx([cola(0), cola(2), cola(5)]))!;
    expect(r.title).toBe('3 boissons sucrées cette semaine');
    expect(r.body).toContain('21 morceaux de sucre');
    expect(r.alternative).toContain('sans sucre');
  });
  it('ignore les boissons plus anciennes ou sans sucre', () => {
    expect(sugaryDrinks.evaluate(ctx([cola(0), cola(2), cola(9)]))).toBeNull();
    const zero = entry(at(0, 16), 'snack', [item({ name: 'Cola zéro', unit: 'ml', quantityG: 330, carbsG: 0, sugarsG: 0 })]);
    expect(sugaryDrinks.evaluate(ctx([cola(0), cola(1), zero]))).toBeNull();
  });
});

describe('règle 4 : IG élevé récurrent', () => {
  const baguette = (d: number) => entry(at(d, 8), 'breakfast', [item({ name: 'Baguette', carbsG: 34, glycemicIndex: 75, giCategory: 'high' })]);
  it('propose une alternative de la même famille au bout de 4 fois en 14 jours', () => {
    const r = highGiRecurring.evaluate(ctx([baguette(0), baguette(3), baguette(7), baguette(12)]))!;
    expect(r.title).toBe('Baguette revient souvent');
    expect(r.evidence).toBe('4 fois en 14 jours');
    expect(r.alternative).toMatch(/tortilla de blé \(IG 30\)/);
  });
  it('se tait en dessous de 4 fois ou hors fenêtre', () => {
    expect(highGiRecurring.evaluate(ctx([baguette(0), baguette(3), baguette(7)]))).toBeNull();
    expect(highGiRecurring.evaluate(ctx([baguette(0), baguette(3), baguette(7), baguette(20)]))).toBeNull();
  });
  it("n'invente pas d'alternative pour un aliment hors table", () => {
    const x = (d: number) => entry(at(d, 8), 'snack', [item({ name: 'Spécialité maison', carbsG: 30, glycemicIndex: 85, giCategory: 'high' })]);
    const r = highGiRecurring.evaluate(ctx([x(0), x(1), x(2), x(3)]))!;
    expect(r.alternative).toBeUndefined();
  });
});

describe('règle 5 : glucides tardifs', () => {
  it('se déclenche au-delà de 30 % après 21 h', () => {
    const late = Array.from({ length: 7 }, (_, d) => [entry(at(d, 12.5), 'lunch', [item({ carbsG: 50 })]), entry(at(d, 21.5), 'dinner', [item({ carbsG: 50 })])]).flat();
    expect(lateCarbs.evaluate(ctx(late))!.evidence).toBe('50 % de tes glucides après 21 h sur 7 jours');
  });
  it('se tait quand on dîne plus tôt', () => {
    expect(lateCarbs.evaluate(ctx(plainWeek()))).toBeNull();
  });
});

describe('règle 6 : fibres faibles', () => {
  it('se déclenche sous 0,1 g de fibres par gramme de glucides', () => {
    const low = Array.from({ length: 7 }, (_, d) => entry(at(d, 12.5), 'lunch', [item({ carbsG: 80, fiberG: 4 })]));
    expect(lowFiber.evaluate(ctx(low))!.evidence).toBe('0,5 g de fibres pour 10 g de glucides sur 7 jours');
  });
  it('se tait avec assez de fibres ou des fibres non renseignées', () => {
    expect(lowFiber.evaluate(ctx(plainWeek()))).toBeNull();
    const unknown = Array.from({ length: 7 }, (_, d) => entry(at(d, 12.5), 'lunch', [item({ carbsG: 80 })]));
    expect(lowFiber.evaluate(ctx(unknown))).toBeNull();
  });
});

describe('règle 7 : progrès', () => {
  it('félicite une baisse de plus de 10 % sur la semaine', () => {
    const r = progress.evaluate(ctx([...plainWeek(0, 40), ...plainWeek(7, 50)]))!;
    expect(r.tone).toBe('positive');
    expect(r.evidence).toBe("120 g par jour, contre 150 g la semaine d'avant (-20 %)");
  });
  it('se tait si la baisse est faible, ou sans semaine de comparaison', () => {
    expect(progress.evaluate(ctx([...plainWeek(0, 48), ...plainWeek(7, 50)]))).toBeNull();
    expect(progress.evaluate(ctx(plainWeek(0, 40)))).toBeNull();
  });
});

describe('règle 8 : régularité', () => {
  it('signale des totaux journaliers très inégaux sur 14 jours', () => {
    const uneven = Array.from({ length: 10 }, (_, d) => entry(at(d, 12.5), 'lunch', [item({ carbsG: d % 2 ? 60 : 240 })]));
    expect(regularity.evaluate(ctx(uneven))!.evidence).toBe('de 60 g à 240 g par jour sur 14 jours');
  });
  it('se tait quand les journées se ressemblent', () => {
    expect(regularity.evaluate(ctx([...plainWeek(0), ...plainWeek(7)]))).toBeNull();
  });
});

describe('moteur', () => {
  const demo = generateDemoEntries(NOW);
  it('expose les 8 règles, aux identifiants uniques', () => {
    expect(RULES).toHaveLength(8);
    expect(new Set(RULES.map((r) => r.id)).size).toBe(8);
  });
  it('affiche au plus 3 recos, triées par priorité', () => {
    const all = evaluateAll(ctx(demo, { dailyCarbGoalG: 400 }));
    expect(all.length).toBeGreaterThan(3);
    const shown = selectInsights(ctx(demo, { dailyCarbGoalG: 400 }));
    expect(shown).toHaveLength(3);
    expect(shown.map((i) => i.id)).toEqual(all.slice(0, 3).map((i) => i.id));
    expect(shown[0]!.priority).toBeGreaterThanOrEqual(shown[2]!.priority);
  });
  it('respecte les recos masquées', () => {
    const first = selectInsights(ctx(demo, { dailyCarbGoalG: 400 }))[0]!;
    const after = selectInsights(ctx(demo, { dailyCarbGoalG: 400, hiddenInsights: [first.id] }));
    expect(after.map((i) => i.id)).not.toContain(first.id);
  });
  it('est déterministe', () => {
    expect(evaluateAll(ctx(demo))).toEqual(evaluateAll(ctx(demo)));
  });
  it('ne parle jamais de traitement, quelle que soit la reco', () => {
    const scenarios = [ctx(demo, { dailyCarbGoalG: 400 }), ctx([...plainWeek(0, 40), ...plainWeek(7, 50)])];
    for (const c of scenarios) {
      for (const i of evaluateAll(c)) {
        expect(`${i.title} ${i.body} ${i.evidence} ${i.alternative ?? ''}`).not.toMatch(/insulin|dose|bolus|traitement|glyc[ée]mie|m[ée]dicament/i);
      }
    }
  });
});
