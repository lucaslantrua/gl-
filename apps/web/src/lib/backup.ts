import { db, loadSettings, saveSettings } from '@/db/db';
import { DEFAULT_SETTINGS, type Entry, type ProductCache, type Settings } from '@/db/types';
import { formatTime, dayKey } from './dates';
import { totalCarbs } from './nutrition';

type ExportedEntry = Omit<Entry, 'photoThumb'> & { photoThumb?: string };

export interface Backup {
  app: 'glu';
  version: 1;
  exportedAt: string;
  settings: Settings;
  entries: ExportedEntry[];
  productCache: ProductCache[];
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob();
}

export async function buildBackup(): Promise<Backup> {
  const [entries, productCache, settings] = await Promise.all([db.entries.toArray(), db.productCache.toArray(), loadSettings()]);
  return {
    app: 'glu',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    productCache,
    entries: await Promise.all(
      entries.map(async ({ photoThumb, ...e }) => ({ ...e, ...(photoThumb ? { photoThumb: await blobToDataUrl(photoThumb) } : {}) })),
    ),
  };
}

/** Vérifie la forme d'une sauvegarde. Lève une erreur lisible si elle est invalide. */
export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Ce fichier n'est pas un JSON valide.");
  }
  const b = data as Partial<Backup>;
  if (!b || b.app !== 'glu' || !Array.isArray(b.entries)) throw new Error("Ce fichier n'est pas une sauvegarde Glu.");
  for (const e of b.entries) {
    if (typeof e?.id !== 'string' || typeof e.eatenAt !== 'string' || Number.isNaN(Date.parse(e.eatenAt)) || !Array.isArray(e.items)) {
      throw new Error('La sauvegarde contient une entrée illisible.');
    }
  }
  return { app: 'glu', version: 1, exportedAt: b.exportedAt ?? '', settings: { ...DEFAULT_SETTINGS, ...(b.settings ?? {}) }, entries: b.entries, productCache: Array.isArray(b.productCache) ? b.productCache : [] };
}

/** Importe une sauvegarde : les entrées de même id sont remplacées. */
export async function importBackup(text: string): Promise<number> {
  const b = parseBackup(text);
  const entries: Entry[] = await Promise.all(
    b.entries.map(async ({ photoThumb, ...e }) => ({
      ...e,
      totalCarbsG: totalCarbs(e.items),
      ...(photoThumb ? { photoThumb: await dataUrlToBlob(photoThumb) } : {}),
    })),
  );
  await db.transaction('rw', db.entries, db.productCache, async () => {
    await db.entries.bulkPut(entries);
    await db.productCache.bulkPut(b.productCache);
  });
  await saveSettings(b.settings);
  return entries.length;
}

const CSV_COLS = ['date', 'heure', 'creneau', 'source', 'aliment', 'quantite', 'unite', 'glucides_g', 'glucides_min_g', 'glucides_max_g', 'sucres_g', 'fibres_g', 'proteines_g', 'lipides_g', 'ig', 'fiabilite', 'code_barres', 'note'];

function cell(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV des entrées : une ligne par item. */
export function entriesToCsv(entries: Pick<Entry, 'eatenAt' | 'mealSlot' | 'source' | 'items' | 'note'>[]): string {
  const lines = [CSV_COLS.join(',')];
  for (const e of [...entries].sort((a, b) => a.eatenAt.localeCompare(b.eatenAt))) {
    const d = new Date(e.eatenAt);
    for (const i of e.items) {
      lines.push(
        [dayKey(d), formatTime(d).replace('h', ':'), e.mealSlot, e.source, i.name, i.quantityG, i.unit, i.carbsG, i.carbsMinG, i.carbsMaxG, i.sugarsG, i.fiberG, i.proteinG, i.fatG, i.glycemicIndex, i.confidence === 'estimate' ? 'estimation' : 'fabricant', i.barcode, e.note]
          .map(cell)
          .join(','),
      );
    }
  }
  return lines.join('\n') + '\n';
}

export function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
