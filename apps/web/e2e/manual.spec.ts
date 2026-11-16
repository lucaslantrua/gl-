import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('ajout manuel puis modification et suppression', async ({ page }) => {
  await onboard(page);
  await page.getByRole('link', { name: 'Ou ajoute-le à la main' }).click();

  const sheet = page.getByRole('dialog', { name: 'Ajouter un aliment' });
  await sheet.getByLabel('Nom').fill('Baguette');
  await expect(sheet.getByText(/Repère IG : 75/)).toBeVisible();
  await sheet.getByLabel('Quantité', { exact: true }).fill('60');
  await sheet.getByLabel('Glucides pour cette quantité (g)').fill('34');
  await sheet.getByRole('button', { name: 'Ajouter' }).click();

  await expect(page.getByTestId('item-carbs')).toHaveText('~34');
  await expect(page.getByText('IG haut')).toBeVisible();
  await page.getByLabel('Quantité en g').fill('120');
  await expect(page.getByTestId('item-carbs')).toHaveText('~68');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByTestId('today-total')).toHaveText('68g');
  await page.getByRole('link', { name: /Baguette/ }).click();
  await page.getByRole('button', { name: 'Supprimer cette entrée' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(page.getByTestId('today-total')).toHaveText('0g');
});

test("l'app fonctionne hors ligne pour l'ajout manuel", async ({ page, context }) => {
  await onboard(page);
  // Le service worker doit avoir mis l'app en cache avant de couper le réseau.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await page.getByTestId('today-total').waitFor();
  await page.getByRole('link', { name: 'Ou ajoute-le à la main' }).click();
  const sheet = page.getByRole('dialog', { name: 'Ajouter un aliment' });
  await sheet.getByLabel('Nom').fill('Pomme');
  await sheet.getByLabel('Quantité', { exact: true }).fill('150');
  await sheet.getByLabel('Glucides pour cette quantité (g)').fill('17');
  await sheet.getByRole('button', { name: 'Ajouter' }).click();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByTestId('today-total')).toHaveText('17g');
});
