import Dexie, { type Table } from 'dexie';
import { DEFAULT_SETTINGS, type Entry, type ProductCache, type Settings } from './types';

interface SettingsRow {
  key: 'main';
  value: Settings;
}

export class GluDB extends Dexie {
  entries!: Table<Entry, string>;
  productCache!: Table<ProductCache, string>;
  settings!: Table<SettingsRow, string>;

  constructor(name = 'glu') {
    super(name);
    // v1 : schéma initial. Ajouter les migrations ici (this.version(2)...upgrade()).
    this.version(1).stores({
      entries: 'id, eatenAt, mealSlot, source',
      productCache: 'barcode',
      settings: 'key',
    });
  }
}

export const db = new GluDB();

export async function loadSettings(): Promise<Settings> {
  const row = await db.settings.get('main');
  return { ...DEFAULT_SETTINGS, ...(row?.value ?? {}) };
}

export async function saveSettings(value: Settings): Promise<void> {
  await db.settings.put({ key: 'main', value });
}

export function entriesBetween(from: Date, to: Date): Promise<Entry[]> {
  return db.entries.where('eatenAt').between(from.toISOString(), to.toISOString(), true, false).sortBy('eatenAt');
}

/** Efface toutes les données locales (entrées, cache produits, réglages). */
export async function wipeAll(): Promise<void> {
  await db.transaction('rw', db.entries, db.productCache, db.settings, async () => {
    await Promise.all([db.entries.clear(), db.productCache.clear(), db.settings.clear()]);
  });
}
