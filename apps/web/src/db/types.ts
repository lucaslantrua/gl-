export type Source = 'plate_photo' | 'barcode' | 'label_photo' | 'manual';
export type Confidence = 'manufacturer' | 'estimate';
export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'other';
export type GiCategory = 'low' | 'medium' | 'high';
export type Theme = 'light' | 'dark' | 'system';

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner', 'other'];

export interface FoodItem {
  id: string;
  name: string;
  /** Quantité réellement consommée (g ou ml). */
  quantityG: number;
  unit: 'g' | 'ml';
  /** Glucides pour la quantité consommée. */
  carbsG: number;
  carbsMinG?: number;
  carbsMaxG?: number;
  sugarsG?: number;
  fiberG?: number;
  proteinG?: number;
  fatG?: number;
  glycemicIndex?: number;
  giCategory?: GiCategory;
  confidence: Confidence;
  barcode?: string;
  offImageUrl?: string;
}

export interface Entry {
  id: string;
  createdAt: string;
  eatenAt: string;
  mealSlot: MealSlot;
  source: Source;
  photoThumb?: Blob;
  items: FoodItem[];
  totalCarbsG: number;
  note?: string;
}

export interface Settings {
  dailyCarbGoalG?: number;
  mealSplit?: Record<MealSlot, number>;
  units: 'g';
  theme: Theme;
  onboardingDone: boolean;
  disclaimerAcceptedAt?: string;
  /** Recos masquées par l'utilisateur (ids de règles). */
  hiddenInsights?: string[];
}

export interface OffProduct {
  barcode: string;
  name: string;
  brand?: string | null;
  unit: 'g' | 'ml';
  per100: {
    carbs: number;
    sugars?: number | null;
    fiber?: number | null;
    protein?: number | null;
    fat?: number | null;
  };
  servingQuantity?: number | null;
  nutriscore?: string | null;
  imageUrl?: string | null;
  isBeverage: boolean;
  categories?: string[];
  packageQuantity?: number | null;
}

export interface ProductCache {
  barcode: string;
  payload: OffProduct;
  fetchedAt: string;
}

export const DEFAULT_SETTINGS: Settings = {
  units: 'g',
  theme: 'system',
  onboardingDone: false,
};
