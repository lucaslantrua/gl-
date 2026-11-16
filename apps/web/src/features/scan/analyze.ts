import { useDraft, type Draft, type DraftItem } from '@/app/stores';
import type { FoodItem, OffProduct } from '@/db/types';
import { analyzePlate, ApiError, getProduct, readLabel, type PlateItem } from '@/lib/api';
import { giCategoryOf, itemFromPer100, uid } from '@/lib/nutrition';

const opt = (v: number | null | undefined): number | undefined => (typeof v === 'number' ? v : undefined);

export function plateItemToDraft(p: PlateItem): DraftItem {
  const gi = opt(p.glycemicIndex);
  const ref: FoodItem = {
    id: uid(),
    name: p.name,
    quantityG: p.estimatedQuantityG,
    unit: p.unit === 'ml' ? 'ml' : 'g',
    carbsG: p.carbsG,
    carbsMinG: p.carbsMinG,
    carbsMaxG: p.carbsMaxG,
    sugarsG: opt(p.sugarsG),
    fiberG: opt(p.fiberG),
    proteinG: opt(p.proteinG),
    fatG: opt(p.fatG),
    glycemicIndex: gi,
    giCategory: gi != null ? giCategoryOf(gi) : undefined,
    confidence: 'estimate',
  };
  return { ref, quantityG: ref.quantityG, box: p.box ?? undefined };
}

export function productToDraft(product: OffProduct, source: Draft['source'], photo?: Blob): Draft {
  const quantity = product.servingQuantity && product.servingQuantity > 0 ? product.servingQuantity : product.isBeverage ? 330 : 100;
  // Référence à 100 g/ml : les recalculs partent des valeurs exactes de la fiche, sans cumul des arrondis.
  const ref = itemFromPer100(product, 100);
  return { source, status: 'ready', photo, product, items: [{ ref, quantityG: quantity }] };
}

function fail(e: unknown): void {
  useDraft.getState().patchDraft({ status: 'error', error: e instanceof ApiError ? e.message : "L'analyse a échoué. Réessaie ou ajoute l'aliment à la main." });
}

/** Lance l'analyse d'une photo de plat. Le brouillon passe de "analyzing" à "ready" ou "error". */
export function startPlateAnalysis(photo: Blob): void {
  const { setDraft, patchDraft } = useDraft.getState();
  setDraft({ source: 'plate_photo', status: 'analyzing', photo, items: [] });
  analyzePlate(photo).then((r) => {
    if (useDraft.getState().draft?.photo !== photo) return; // l'utilisateur est passé à autre chose
    patchDraft({ status: 'ready', items: r.items.map(plateItemToDraft), notes: r.notes || undefined });
  }, fail);
}

export function startLabelAnalysis(photo: Blob): void {
  const { setDraft } = useDraft.getState();
  setDraft({ source: 'label_photo', status: 'analyzing', photo, items: [] });
  readLabel(photo).then((r) => {
    if (useDraft.getState().draft?.photo !== photo) return;
    if (r.per100.carbs == null) return fail(new ApiError(422, 'Les glucides ne sont pas lisibles sur cette photo. Rapproche-toi du tableau nutritionnel.'));
    const product: OffProduct = {
      barcode: '',
      name: r.name ?? 'Produit (étiquette)',
      unit: r.unit,
      per100: { ...r.per100, carbs: r.per100.carbs },
      servingQuantity: r.servingQuantity,
      isBeverage: r.unit === 'ml',
    };
    const draft = productToDraft(product, 'label_photo', photo);
    draft.items.forEach((i) => delete i.ref.barcode);
    setDraft(draft);
  }, fail);
}

/** Cherche un produit par code-barres et prépare le brouillon. Lève ApiError (404 si inconnu). */
export async function loadProductDraft(barcode: string): Promise<void> {
  const product = await getProduct(barcode);
  useDraft.getState().setDraft(productToDraft(product, 'barcode'));
}
