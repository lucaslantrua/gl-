import { expect, test } from '@playwright/test';
import { ean13Png, NUTELLA, onboard, platePng } from './helpers';

test('scan code-barres : produit connu, quantité, enregistrement', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/products/3017620422003', (route) => {
    calls++;
    return route.fulfill({ json: NUTELLA });
  });
  await onboard(page, '150');
  await page.goto('/scan?mode=barcode');
  await page.getByTestId('scan-file').setInputFiles({ name: 'code.png', mimeType: 'image/png', buffer: await ean13Png('3017620422003') });

  await expect(page).toHaveURL(/\/entry\/new/);
  await expect(page.getByLabel("Nom de l'aliment")).toHaveValue('Nutella · Ferrero');
  await expect(page.getByText('donnée fabricant')).toBeVisible();
  // Portion fabricant par défaut : 15 g → 8,6 g de glucides.
  await expect(page.getByTestId('item-carbs')).toHaveText('8,6');
  await expect(page.getByText('IG bas')).toBeVisible();

  await page.getByRole('button', { name: '100 g', exact: true }).click();
  await expect(page.getByTestId('item-carbs')).toHaveText('57,5');
  await expect(page.getByTestId('sugar-cubes')).toHaveText('= 11 morceaux de sucre');
  await page.getByRole('button', { name: 'Moitié du paquet' }).click();
  await expect(page.getByTestId('item-carbs')).toHaveText('115');
  await page.getByRole('button', { name: '100 g', exact: true }).click();

  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByTestId('today-total')).toHaveText('58g');
  await expect(page.getByText('il te reste 93 g')).toBeVisible();
  await expect(page.getByRole('link', { name: /Nutella/ })).toBeVisible();
  expect(calls).toBe(1);
});

test('scan code-barres : produit inconnu → propose la photo d’étiquette', async ({ page }) => {
  await page.route('**/api/products/*', (route) => route.fulfill({ status: 404, json: { detail: 'Produit introuvable.' } }));
  await page.route('**/api/vision/label', (route) =>
    route.fulfill({ json: { name: 'Biscuits', unit: 'g', per100: { carbs: 64, sugars: 22, fiber: null, protein: 7, fat: 18 }, servingQuantity: 30, confidence: 'manufacturer' } }),
  );
  await onboard(page);
  await page.goto('/scan?mode=barcode');
  await page.getByRole('button', { name: 'Saisir' }).click();
  await page.getByLabel('Les chiffres sous le code-barres').fill('4006381333931');
  await page.getByRole('button', { name: 'Chercher' }).click();
  await expect(page.getByRole('dialog', { name: 'Produit introuvable' })).toBeVisible();
  await page.getByRole('button', { name: "Photographier l'étiquette" }).click();
  await expect(page.getByRole('tab', { name: 'Étiquette' })).toHaveAttribute('aria-selected', 'true');

  await page.getByTestId('scan-file').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: await platePng() });
  await expect(page.getByLabel("Nom de l'aliment")).toHaveValue('Biscuits');
  await expect(page.getByTestId('item-carbs')).toHaveText('19,2');
  await expect(page.getByText('donnée fabricant')).toBeVisible();
});

test('photo de plat : estimation avec fourchette et badge', async ({ page }) => {
  await page.route('**/api/vision/plate', async (route) => {
    await new Promise((r) => setTimeout(r, 400));
    await route.fulfill({
      json: {
        items: [
          { name: 'Pâtes cuites', estimatedQuantityG: 220, unit: 'g', carbsG: 66, carbsMinG: 55, carbsMaxG: 80, fiberG: 4, proteinG: 12, glycemicIndex: 50, giCategory: 'low', box: { x: 0.2, y: 0.2, w: 0.4, h: 0.4 } },
          { name: 'Sauce tomate', estimatedQuantityG: 90, unit: 'g', carbsG: 7, carbsMinG: 4, carbsMaxG: 11, sugarsG: 5, box: { x: 0.5, y: 0.4, w: 0.2, h: 0.2 } },
        ],
        notes: 'Sauce tomate probablement sucrée, impact faible.',
        overallConfidence: 'medium',
      },
    });
  });
  await onboard(page);
  await page.goto('/scan');
  await page.getByTestId('scan-file').setInputFiles({ name: 'plat.png', mimeType: 'image/png', buffer: await platePng() });
  await expect(page.getByText('Analyse en cours…')).toBeVisible();
  await expect(page.getByLabel("Nom de l'aliment").first()).toHaveValue('Pâtes cuites');
  await expect(page.getByText('entre 55 et 80 g')).toBeVisible();
  await expect(page.getByText('estimation').first()).toBeVisible();
  await expect(page.getByTestId('entry-total')).toHaveText('~73 g');
  await expect(page.getByText('entre 59 et 91 g')).toBeVisible();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByTestId('today-total')).toHaveText('73g');
});
