import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) errors.push(m.text());
  });
  return errors;
}

async function swReady(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15_000 }).catch(() => page.reload());
}

test('all screens render without errors, CSP violations or horizontal overflow', async ({ page }) => {
  const errors = watchErrors(page);
  for (const [path, heading] of [['/', 'Salam'], ['/agenda/', 'Agenda'], ['/budget/', 'Büdcə'], ['/notes/', 'Notlar'], ['/settings/', 'İdarə paneli'], ['/reports/', 'Hesabatlar']]) {
    await page.goto(path);
    await expect(page.getByText(heading).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
  }
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('task: create via Quick Add, persists after reload, complete', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Sürətli əlavə et').click();
  await page.getByText('Yeni tapşırıq').click();
  await page.getByPlaceholder('Məs. Hesabatı hazırlamaq').fill('E2E tapşırıq');
  await page.getByRole('button', { name: 'Yadda saxla' }).click();
  await expect(page.getByText('Tapşırıq əlavə edildi')).toBeVisible();
  await page.reload();
  const box = page.getByRole('checkbox', { name: 'E2E tapşırıq tamamlandı' }).first();
  await expect(box).toBeVisible();
  await box.click();
  await expect(box).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'E2E tapşırıq tamamlandı' }).first()).toHaveAttribute('aria-checked', 'true');
});

test('expense quick entry: Enter saves, totals use integer qəpik, last category remembered', async ({ page }) => {
  await page.goto('/budget/');
  await page.getByLabel('Sürətli əlavə et').click();
  await page.getByText('Xərc əlavə et').click();
  await page.getByRole('button', { name: 'Qida', exact: true }).click();
  const amount = page.getByPlaceholder('0,00');
  await amount.fill('12,50');
  await amount.press('Enter');
  await expect(page.getByText('Xərc əlavə edildi')).toBeVisible();
  // second entry: category preselected
  await page.getByLabel('Sürətli əlavə et').click();
  await page.getByText('Xərc əlavə et').click();
  await expect(page.getByRole('button', { name: 'Qida', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByPlaceholder('0,00').fill('0,29');
  await page.getByPlaceholder('0,00').press('Enter');
  await expect(page.getByPlaceholder('0,00')).toBeHidden(); // sheet closes only after the write committed
  await expect(page.getByText('12,79\u00a0₼').first()).toBeVisible(); // live query updated
  await page.reload();
  await expect(page.getByText('12,79 ₼').first()).toBeVisible();
});

test('note: auto-save, word count, delete asks for confirmation', async ({ page }) => {
  await page.goto('/notes/');
  await page.getByLabel('Yeni qeyd').click();
  await page.getByPlaceholder('Başlıq').fill('E2E qeyd');
  await page.getByPlaceholder('Yazmağa başlayın…').fill('Birinci sətir\n• ikinci sətir');
  await expect(page.getByText('5 söz')).toBeVisible();
  await expect(page.getByText('Avtomatik yadda saxlanıldı')).toBeVisible();
  await page.getByLabel('Bağla').click();
  await page.reload();
  await expect(page.getByText('E2E qeyd')).toBeVisible();
  await page.getByLabel('Əlavə seçimlər').first().click();
  await page.getByRole('button', { name: 'Sil' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: 'Ləğv et' }).click();
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await expect(page.locator('h3', { hasText: 'E2E qeyd' })).toBeVisible();
});

test('offline: app shell and data load without network', async ({ page, context }) => {
  await page.goto('/');
  await swReady(page);
  await page.getByLabel('Sürətli əlavə et').click();
  await page.getByText('Yeni qeyd').click();
  await page.getByPlaceholder('Başlıq').fill('Oflayn qeyd');
  await page.waitForTimeout(800);
  await context.setOffline(true);
  for (const path of ['/', '/agenda/', '/budget/', '/notes/', '/settings/']) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
  }
  await page.goto('/notes/');
  await expect(page.getByText('Oflayn qeyd')).toBeVisible();
  await expect(page.getByText(/Oflayn rejim/)).toBeVisible();
  await page.goto('/unknown-page/');
  await expect(page.getByText('Oflayn rejim').first()).toBeVisible(); // offline.html fallback
  await context.setOffline(false);
});

test('service worker update: new version is offered and applied without losing data', async ({ page }) => {
  await page.goto('/');
  await swReady(page);
  await page.getByLabel('Sürətli əlavə et').click();
  await page.getByText('Yeni qeyd').click();
  await page.getByPlaceholder('Başlıq').fill('Yeniləmədən əvvəl');
  await page.waitForTimeout(800);
  await page.goto('/notes/');

  const swPath = 'out/sw.js';
  const original = readFileSync(swPath, 'utf8');
  try {
    // Simulate a new deployment: different cache version
    writeFileSync(swPath, original.replace(/const BUILD = "([^"]+)"/, 'const BUILD = "$1-next"'));
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()));
    await expect(page.getByText('Yeni versiya hazırdır')).toBeVisible({ timeout: 20_000 });
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Yenilə', exact: true }).click()]);
    await expect(page.getByText('Yeniləmədən əvvəl')).toBeVisible();
    const caches = await page.evaluate(() => window.caches.keys());
    expect(caches.filter((k) => k.startsWith('myagenda-'))).toHaveLength(1); // old cache cleaned up
    expect(caches[0]).toContain('-next');
  } finally {
    writeFileSync(swPath, original);
  }
});
