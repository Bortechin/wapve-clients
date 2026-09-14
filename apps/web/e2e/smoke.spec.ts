import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

async function selectLocale(page: Page, baseURL: string | undefined, locale: 'en' | 'tr') {
  const url = new URL('/', baseURL ?? 'http://127.0.0.1:3000').toString();
  await page.context().addCookies([{ name: 'wapve_locale', value: locale, url }]);
}

test('Turkish login is responsive and accessible', async ({ page, baseURL }) => {
  await selectLocale(page, baseURL, 'tr');
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Tekrar hoş geldin' })).toBeVisible();
  await expect(page.getByLabel('E-posta veya kullanıcı adı')).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('English registration renders translated content', async ({ page, baseURL }) => {
  await selectLocale(page, baseURL, 'en');
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Join the Wapve wave' })).toBeVisible();
  await expect(page.getByLabel('Alpha invite code')).toHaveCount(0);
  await expect(page.getByText(/without an invite code/i)).toHaveCount(0);
});

test('language picker changes locale and unsupported browser languages fall back to English', async ({
  page,
  baseURL,
}) => {
  await page.context().clearCookies();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'fr-FR,fr;q=0.9' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Your voice, your people/ })).toBeVisible();

  await selectLocale(page, baseURL, 'tr');
  await page.goto('/security');
  await page.locator('summary[aria-label="Dil seç"]').click();
  await expect(page.getByRole('listbox', { name: 'Dil seç' })).toBeVisible();
  await page.getByRole('option', { name: /English/ }).click();
  await expect(
    page.getByRole('heading', { name: 'A secure foundation from day one.' }),
  ).toBeVisible();
});

test('public marketing pages are navigable and accessible', async ({ page, baseURL }) => {
  await selectLocale(page, baseURL, 'en');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Your voice, your people/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create a free account' })).toBeVisible();
  await expect(page.getByText('@wapve')).toBeVisible();
  await expect(page.getByText(/huseyinsari/i)).toHaveCount(0);
  await expect(page.getByText('Communities meet on the same wave')).toHaveCount(0);
  await expect(page.getByText('Wapve Studio')).toHaveCount(0);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  await page.goto('/features');
  await expect(
    page.getByRole('heading', { name: 'Working today. Coming tomorrow.' }),
  ).toBeVisible();

  await page.goto('/security');
  await expect(
    page.getByRole('heading', { name: 'A secure foundation from day one.' }),
  ).toBeVisible();

  await page.goto('/roadmap');
  await expect(page.getByRole('heading', { name: 'Wapve grows in waves.' })).toBeVisible();

  await page.goto('/wapve-plus');
  await expect(page.getByRole('heading', { name: 'Your style, with no price tag.' })).toBeVisible();

  await page.goto('/faq');
  await expect(
    page.getByRole('heading', { name: 'Straight answers to common questions.' }),
  ).toBeVisible();

  await page.goto('/support');
  await expect(page.getByRole('heading', { name: 'HELP CENTER' })).toBeVisible();

  await page.goto('/blog');
  await expect(
    page.getByRole('heading', { name: 'Directly from the people building Wapve.' }),
  ).toBeVisible();
});

test('public pages do not create horizontal viewport overflow', async ({ page, baseURL }) => {
  test.setTimeout(90_000);
  await selectLocale(page, baseURL, 'tr');
  const routes = [
    '/',
    '/features',
    '/security',
    '/roadmap',
    '/wapve-plus',
    '/faq',
    '/support',
    '/blog',
    '/login',
    '/register',
    '/legal/privacy',
    '/legal/terms',
    '/legal/copyright',
  ];

  for (const route of routes) {
    await page.goto(route);
    const layout = await page.evaluate(() => {
      // Next's development toolbar lives outside the application surface and
      // can add a shadow-DOM scroll width that does not exist in production.
      document.querySelectorAll('nextjs-portal').forEach((portal) => portal.remove());
      const surface = document.querySelector<HTMLElement>('main') ?? document.body;
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        clipped: ['hidden', 'clip'].includes(getComputedStyle(surface).overflowX),
        offenders: [...surface.querySelectorAll<HTMLElement>('*')]
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              element: `${element.tagName.toLowerCase()}.${element.className}`,
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            };
          })
          .filter(({ left, right }) => left < -1 || right > window.innerWidth + 1)
          .slice(0, 8),
      };
    });
    expect(
      layout.overflow <= 1 || layout.offenders.length === 0,
      `${route} has visible horizontal overflow: ${JSON.stringify(layout.offenders)}`,
    ).toBe(true);
  }
});

test('the bundled GTCRN WebAssembly module is allowed by CSP', async ({ page }) => {
  await page.goto('/tr/login');
  const compiled = await page.evaluate(async () => {
    const response = await fetch('/audio/gtcrn.wasm');
    if (!response.ok) throw new Error(`GTCRN WASM returned ${response.status}`);
    await WebAssembly.compile(await response.arrayBuffer());
    return true;
  });
  expect(compiled).toBe(true);
});
