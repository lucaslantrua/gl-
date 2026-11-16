import { describe, expect, it } from 'vitest';
import { generateDemoEntries } from '@/db/seed';
import { at, entry, item, NOW } from '@/test-utils';
import { entriesToCsv, parseBackup } from './backup';
import { isValidEan } from './barcode';
import { dayKey, formatDecimalHour, parseDayKey, slotForDate, startOfWeek, weekdayIndex } from './dates';
import { GI_TABLE, lowerGiAlternative, matchGiByCategories, matchGiByName } from './gi-table';
import { giCategoryOf } from './nutrition';

describe('dates', () => {
  it('déduit le créneau repas de l’heure', () => {
    expect([7.5, 12.5, 16.5, 20, 2, 11].map((h) => slotForDate(at(0, h)))).toEqual(['breakfast', 'lunch', 'snack', 'dinner', 'other', 'other']);
  });
  it('commence la semaine le lundi', () => {
    expect(dayKey(startOfWeek(new Date(2026, 5, 21)))).toBe('2026-06-15'); // dimanche → lundi précédent
    expect(weekdayIndex(new Date(2026, 5, 21))).toBe(6);
  });
  it('fait l’aller-retour des clés de jour', () => {
    expect(dayKey(parseDayKey('2026-01-09'))).toBe('2026-01-09');
  });
  it('formate une heure décimale', () => {
    expect(formatDecimalHour(16.5)).toBe('16h30');
    expect(formatDecimalHour(9.999)).toBe('10h00');
  });
});

describe('table IG', () => {
  it('contient environ 150 aliments, aux identifiants uniques et aux IG plausibles', () => {
    expect(GI_TABLE.length).toBeGreaterThanOrEqual(150);
    expect(new Set(GI_TABLE.map((f) => f.id)).size).toBe(GI_TABLE.length);
    for (const f of GI_TABLE) expect(f.gi, f.name).toBeGreaterThan(0), expect(f.gi, f.name).toBeLessThanOrEqual(100);
  });
  it('associe une catégorie OFF à au plus un aliment', () => {
    const tags = GI_TABLE.flatMap((f) => f.off);
    expect(new Set(tags).size).toBe(tags.length);
  });
  it('choisit la catégorie OFF la plus précise', () => {
    expect(matchGiByCategories(['en:beverages', 'en:sodas', 'en:colas'])?.id).toBe('cola');
    expect(matchGiByCategories(['en:plant-based-foods', 'en:breads', 'en:baguettes'])?.id).toBe('baguette');
  });
  it("n'invente rien quand la catégorie est inconnue", () => {
    expect(matchGiByCategories(['en:meats', 'en:hams'])).toBeUndefined();
    expect(matchGiByCategories([])).toBeUndefined();
  });
  it('retrouve un aliment par son nom, accents et pluriels compris', () => {
    expect(matchGiByName('Riz basmati cuit')?.id).toBe('basmati-rice');
    expect(matchGiByName('Pâtes complètes')?.id).toBe('wholemeal-pasta');
    expect(matchGiByName('Frites')?.id).toBe('fries');
    expect(matchGiByName('Steak haché')).toBeUndefined();
  });
  it('propose une alternative de la même famille à IG plus bas', () => {
    const baguette = GI_TABLE.find((f) => f.id === 'baguette')!;
    const alt = lowerGiAlternative(baguette)!;
    expect(alt.group).toBe('bread');
    expect(alt.gi).toBeLessThanOrEqual(baguette.gi - 10);
    expect(lowerGiAlternative(GI_TABLE.find((f) => f.id === 'hummus')!)).toBeUndefined();
  });
});

describe('codes-barres', () => {
  it('valide la clé de contrôle EAN-13, EAN-8 et UPC-A', () => {
    expect(isValidEan('3017620422003')).toBe(true);
    expect(isValidEan('5449000000996')).toBe(true);
    expect(isValidEan('96385074')).toBe(true);
    expect(isValidEan('036000291452')).toBe(true);
  });
  it('rejette un chiffre faux ou un format inattendu', () => {
    expect(isValidEan('3017620422004')).toBe(false);
    expect(isValidEan('12345')).toBe(false);
    expect(isValidEan('30176204220ab')).toBe(false);
  });
});

describe('export / import', () => {
  it('écrit une ligne CSV par item, avec échappement', () => {
    const e = entry(at(0, 12.5), 'lunch', [item({ name: 'Pâtes, sauce "maison"', quantityG: 220, carbsG: 66, carbsMinG: 55, carbsMaxG: 80 }), item({ name: 'Cola', unit: 'ml', quantityG: 330, carbsG: 35, sugarsG: 35, confidence: 'manufacturer', barcode: '5449000000996' })]);
    const lines = entriesToCsv([e]).trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^date,heure,creneau,source,aliment,quantite,unite,glucides_g/);
    expect(lines[1]).toBe('2026-06-15,12:30,lunch,manual,"Pâtes, sauce ""maison""",220,g,66,55,80,,,,,,estimation,,');
    expect(lines[2]).toBe('2026-06-15,12:30,lunch,manual,Cola,330,ml,35,,,35,,,,,fabricant,5449000000996,');
  });
  it('refuse un fichier qui n’est pas une sauvegarde Glu', () => {
    expect(() => parseBackup('pas du json')).toThrow(/JSON/);
    expect(() => parseBackup('{"app":"autre","entries":[]}')).toThrow(/sauvegarde Glu/);
    expect(() => parseBackup('{"app":"glu","entries":[{"id":"x","eatenAt":"hier","items":[]}]}')).toThrow(/illisible/);
  });
  it('accepte une sauvegarde valide et complète les réglages manquants', () => {
    const e = entry(at(0, 8), 'breakfast', [item({ carbsG: 10 })]);
    const b = parseBackup(JSON.stringify({ app: 'glu', version: 1, entries: [e], settings: { dailyCarbGoalG: 150 } }));
    expect(b.entries).toHaveLength(1);
    expect(b.settings).toMatchObject({ dailyCarbGoalG: 150, theme: 'system', units: 'g' });
  });
});

describe('données de démo', () => {
  const demo = generateDemoEntries(NOW);
  it('génère 30 jours, de façon déterministe', () => {
    expect(new Set(demo.map((e) => dayKey(e.eatenAt))).size).toBe(30);
    expect(generateDemoEntries(NOW)).toEqual(demo);
  });
  it('reste cohérente : totaux, sources, catégories IG, rien dans le futur', () => {
    for (const e of demo) {
      expect(e.totalCarbsG).toBeCloseTo(e.items.reduce((a, i) => a + i.carbsG, 0), 5);
      expect(new Date(e.eatenAt).getTime()).toBeLessThanOrEqual(NOW.getTime());
      for (const i of e.items) {
        if (i.glycemicIndex != null) expect(i.giCategory).toBe(giCategoryOf(i.glycemicIndex));
        if (i.carbsMinG != null) expect(i.confidence).toBe('estimate');
      }
    }
  });
});
