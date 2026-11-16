import { create } from 'zustand';
import { loadSettings, saveSettings } from '@/db/db';
import { DEFAULT_SETTINGS, type FoodItem, type OffProduct, type Settings, type Source, type Theme } from '@/db/types';

export function applyTheme(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1A1512' : '#F6EFE4');
  try {
    localStorage.setItem('glu-theme', theme);
  } catch {
    /* stockage indisponible : le thème reste appliqué pour la session */
  }
}

interface SettingsState {
  settings: Settings;
  ready: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Settings>) => Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  ready: false,
  load: async () => {
    const settings = await loadSettings();
    applyTheme(settings.theme);
    set({ settings, ready: true });
  },
  update: async (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    if (patch.theme) applyTheme(patch.theme);
    await saveSettings(settings);
  },
}));

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Item en cours d'édition : `ref` est la valeur de référence, `quantityG` la quantité choisie. */
export interface DraftItem {
  ref: FoodItem;
  quantityG: number;
  box?: Box;
}

export interface Draft {
  source: Source;
  status: 'analyzing' | 'ready' | 'error';
  error?: string;
  photo?: Blob;
  items: DraftItem[];
  notes?: string;
  product?: OffProduct;
}

interface DraftState {
  draft: Draft | null;
  setDraft: (d: Draft | null) => void;
  patchDraft: (p: Partial<Draft>) => void;
}

export const useDraft = create<DraftState>((set, get) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
  patchDraft: (p) => {
    const cur = get().draft;
    if (cur) set({ draft: { ...cur, ...p } });
  },
}));
