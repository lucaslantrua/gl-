/** Client Open Food Facts : appel, normalisation, cache mémoire. Données © contributeurs Open Food Facts, licence ODbL. */
import { OFF_CACHE_TTL_MS, OFF_NEGATIVE_CACHE_TTL_MS } from './config.ts';

export interface Product {
  barcode: string;
  name: string;
  brand: string | null;
  unit: 'g' | 'ml';
  per100: { carbs: number; sugars: number | null; fiber: number | null; protein: number | null; fat: number | null };
  servingQuantity: number | null;
  packageQuantity: number | null;
  nutriscore: string | null;
  imageUrl: string | null;
  isBeverage: boolean;
  categories: string[];
}

export class OffUnavailable extends Error {}

const OFF_URL = 'https://world.openfoodfacts.org/api/v2/product/';
const OFF_FIELDS = 'product_name,brands,quantity,product_quantity,serving_size,serving_quantity,nutriments,nutriscore_grade,image_front_small_url,categories_tags';

function num(value: unknown): number | null {
  if (value == null || typeof value === 'boolean' || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Fiche OFF → forme Glu. null si les glucides pour 100 g manquent. */
export function normalise(barcode: string, product: Record<string, unknown>): Product | null {
  const nutriments = (product.nutriments ?? {}) as Record<string, unknown>;
  const carbs = num(nutriments.carbohydrates_100g);
  if (carbs === null) return null;
  const tags = Array.isArray(product.categories_tags) ? product.categories_tags : [];
  const categories = tags.filter((c): c is string => typeof c === 'string');
  const isBeverage = categories.includes('en:beverages');
  const grade = String(product.nutriscore_grade ?? '').trim().toLowerCase();
  return {
    barcode,
    name: String(product.product_name ?? '').trim() || 'Produit sans nom',
    brand: String(product.brands ?? '').split(',')[0]!.trim() || null,
    unit: isBeverage ? 'ml' : 'g',
    per100: { carbs, sugars: num(nutriments.sugars_100g), fiber: num(nutriments.fiber_100g), protein: num(nutriments.proteins_100g), fat: num(nutriments.fat_100g) },
    servingQuantity: num(product.serving_quantity) || null,
    packageQuantity: num(product.product_quantity) || null,
    nutriscore: ['a', 'b', 'c', 'd', 'e'].includes(grade) ? grade : null,
    imageUrl: typeof product.image_front_small_url === 'string' && product.image_front_small_url ? product.image_front_small_url : null,
    isBeverage,
    categories,
  };
}

/**
 * Cache mémoire borné (LRU + TTL). Il ne contient que des fiches produits publiques, jamais de donnée utilisateur.
 * Une Edge Function est sans état : le cache vit le temps de l'instance, le front garde sa propre copie.
 */
export class MemoryCache<T> {
  #map = new Map<string, { value: T; expires: number }>();
  constructor(private max = 500, private now: () => number = Date.now) {}

  get(key: string): T | undefined {
    const hit = this.#map.get(key);
    if (!hit) return undefined;
    if (hit.expires <= this.now()) {
      this.#map.delete(key);
      return undefined;
    }
    this.#map.delete(key);
    this.#map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    this.#map.delete(key);
    this.#map.set(key, { value, expires: this.now() + ttlMs });
    if (this.#map.size > this.max) this.#map.delete(this.#map.keys().next().value!);
  }
}

export type ProductCache = MemoryCache<Product | null>;

/** Produit normalisé, ou null s'il est inconnu ou inutilisable. */
export async function getProduct(barcode: string, deps: { fetch: typeof fetch; cache: ProductCache; userAgent: string }): Promise<Product | null> {
  const cached = deps.cache.get(barcode);
  if (cached !== undefined) return cached;

  let res: Response;
  try {
    res = await deps.fetch(`${OFF_URL}${barcode}.json?fields=${OFF_FIELDS}`, {
      headers: { 'User-Agent': deps.userAgent, Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
  } catch (e) {
    throw new OffUnavailable(e instanceof Error ? e.name : 'network');
  }
  if (res.status === 404) {
    deps.cache.set(barcode, null, OFF_NEGATIVE_CACHE_TTL_MS);
    return null;
  }
  if (!res.ok) throw new OffUnavailable(`HTTP ${res.status}`);

  let body: { status?: number; product?: unknown };
  try {
    body = await res.json();
  } catch {
    throw new OffUnavailable('invalid JSON');
  }
  const raw = body?.product;
  const product = raw && typeof raw === 'object' && body.status !== 0 ? normalise(barcode, raw as Record<string, unknown>) : null;
  deps.cache.set(barcode, product, product ? OFF_CACHE_TTL_MS : OFF_NEGATIVE_CACHE_TTL_MS);
  return product;
}
