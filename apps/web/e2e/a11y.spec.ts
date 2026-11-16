import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { onboard } from './helpers';

async function check(page: Page, label: string): Promise<void> {
  await page.waitForTimeout(700); // laisse les animations d'entrée se terminer
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${label} · ${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`accessibilité des écrans, thème ${scheme === 'light' ? 'clair' : 'sombre'}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto('/');
    await check(page, 'onboarding');
    await onboard(page, '180');

    await page.goto('/settings');
    await page.getByRole('button', { name: 'Charger des données de démo' }).click();
    await expect(page.getByText(/entrées de démo ajoutées/)).toBeVisible();
    await check(page, 'réglages');

    for (const route of ['/', '/history', '/stats', '/insights', '/scan']) {
      await page.goto(route);
      await check(page, route);
    }

    await page.goto('/history');
    await page.getByRole('tab', { name: 'Semaine' }).click();
    await check(page, 'historique semaine');
    await page.getByRole('tab', { name: 'Mois' }).click();
    await check(page, 'historique mois');

    await page.goto('/');
    await page.getByRole('list').getByRole('link').first().click();
    await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeVisible();
    await check(page, 'édition');
  });
}
