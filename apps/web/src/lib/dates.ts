import type { MealSlot } from '@/db/types';

export const DAY_MS = 86_400_000;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Lundi comme premier jour de la semaine. */
export function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  return addDays(s, -((s.getDay() + 6) % 7));
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Clé de jour en heure locale : YYYY-MM-DD. */
export function dayKey(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${x.getFullYear()}-${m}-${day}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

/** Index 0 = lundi … 6 = dimanche. */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export const WEEKDAYS_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
export const WEEKDAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Créneau repas déduit de l'heure. */
export function slotForDate(d: Date): MealSlot {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 5 && h < 10.5) return 'breakfast';
  if (h >= 11.5 && h < 14.5) return 'lunch';
  if (h >= 15.5 && h < 18) return 'snack';
  if (h >= 18.5 && h < 22.5) return 'dinner';
  return 'other';
}

export const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Petit-déj',
  lunch: 'Déjeuner',
  snack: 'Goûter',
  dinner: 'Dîner',
  other: 'Autre',
};

export function formatTime(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${String(x.getHours()).padStart(2, '0')}h${String(x.getMinutes()).padStart(2, '0')}`;
}

export function formatDayLong(d: Date, now = new Date()): string {
  if (isSameDay(d, now)) return "Aujourd'hui";
  if (isSameDay(d, addDays(now, -1))) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatDayShort(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function formatMonth(d: Date): string {
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/** Valeur pour <input type="datetime-local"> en heure locale. */
export function toLocalInput(d: Date): string {
  return `${dayKey(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Heure décimale moyenne → "16h30". */
export function formatDecimalHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(mm === 60 ? hh + 1 : hh).padStart(2, '0')}h${String(mm === 60 ? 0 : mm).padStart(2, '0')}`;
}
