import { db } from '@/db/db';
import type { GiCategory, OffProduct } from '@/db/types';

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';
const LOCAL_PRODUCT_TTL_MS = 30 * 86_400_000;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface PlateItem {
  name: string;
  estimatedQuantityG: number;
  unit?: 'g' | 'ml' | null;
  carbsG: number;
  carbsMinG: number;
  carbsMaxG: number;
  sugarsG?: number | null;
  fiberG?: number | null;
  proteinG?: number | null;
  fatG?: number | null;
  glycemicIndex?: number | null;
  giCategory?: GiCategory | null;
  box?: { x: number; y: number; w: number; h: number } | null;
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
}

const FALLBACK: Record<number, string> = {
  404: 'Introuvable.',
  413: "L'image est trop lourde.",
  415: "Ce format d'image n'est pas pris en charge.",
  422: "L'analyse n'a rien donné d'exploitable. Réessaie avec une photo plus nette.",
  429: 'Trop de demandes à la suite. Réessaie dans une minute.',
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new ApiError(0, "Pas de connexion. Tu peux quand même ajouter l'aliment à la main.");
  }
  if (!res.ok) {
    let detail: unknown;
    try {
      detail = ((await res.json()) as { detail?: unknown }).detail;
    } catch {
      /* corps non JSON */
    }
    throw new ApiError(res.status, typeof detail === 'string' ? detail : (FALLBACK[res.status] ?? 'Le service ne répond pas. Réessaie dans un instant.'));
  }
  return (await res.json()) as T;
}

/** Produit par code-barres : cache local (IndexedDB) puis backend (proxy Open Food Facts). */
export async function getProduct(barcode: string): Promise<OffProduct> {
  const cached = await db.productCache.get(barcode);
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < LOCAL_PRODUCT_TTL_MS) return cached.payload;
  try {
    const payload = await request<OffProduct>(`/api/products/${encodeURIComponent(barcode)}`);
    await db.productCache.put({ barcode, payload, fetchedAt: new Date().toISOString() });
    return payload;
  } catch (e) {
    // Hors ligne : une fiche en cache, même ancienne, vaut mieux que rien.
    if (cached && e instanceof ApiError && e.status === 0) return cached.payload;
    throw e;
  }
}

function imageForm(image: Blob): FormData {
  const form = new FormData();
  form.append('image', image, image.type === 'image/webp' ? 'photo.webp' : 'photo.jpg');
  return form;
}

export function analyzePlate(image: Blob): Promise<PlateResponse> {
  return request<PlateResponse>('/api/vision/plate', { method: 'POST', body: imageForm(image) });
}

export function readLabel(image: Blob): Promise<LabelResponse> {
  return request<LabelResponse>('/api/vision/label', { method: 'POST', body: imageForm(image) });
}
