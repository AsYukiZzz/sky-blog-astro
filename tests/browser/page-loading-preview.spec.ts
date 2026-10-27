import { expect, test } from '@playwright/test';
import { createBackgroundSite } from '../fixtures/site-background';

let site: Awaited<ReturnType<typeof createBackgroundSite>>;

test.beforeAll(async () => {
    test.setTimeout(120_000);
    site = await createBackgroundSite({ developmentMode: 'loading' });
});
test.afterAll(async () => site?.close());

test('loading preview also keeps the initial visit and refresh visible long enough to inspect', async ({
    page,
}) => {
    for (const refresh of [false, true]) {
        if (refresh) await page.reload({ waitUntil: 'commit' });
        else
            await page.goto(`${site.origin}/archives/`, {
                waitUntil: 'commit',
            });
        const layer = page.locator('[data-page-loading]');
        await expect(layer).toBeVisible();
        await expect(layer).toHaveAttribute('data-phase', 'initial');
        await page.waitForTimeout(700);
        await expect(layer).toHaveAttribute('data-state', 'visible');
        await expect(layer).toBeHidden();
        await expect(page.locator('main')).not.toHaveAttribute('inert');
    }
});

test('loading preview keeps the previous content behind the mask before swapping', async ({
    page,
}) => {
    await page.goto(`${site.origin}/archives/`);
    await page.request.get(`${site.origin}/links/`);
    const layer = page.locator('[data-page-loading]');
    await expect(layer).toBeHidden();
    await page.locator('.desktop-nav a[href="/links/"]').click();
    await expect(layer).toBeVisible();
    await expect(layer.getByText('正在加载', { exact: true })).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(`${site.origin}/archives/`);
    await expect(layer).toBeVisible();
    await expect(page).toHaveURL(`${site.origin}/links/`);
    await expect(layer).toBeHidden();
});

test('a second preview navigation replaces the first delay without a stale swap', async ({
    page,
}) => {
    await page.goto(`${site.origin}/archives/`);
    await page.request.get(`${site.origin}/links/`);
    await page.request.get(`${site.origin}/`);
    const layer = page.locator('[data-page-loading]');
    await page.locator('.desktop-nav a[href="/links/"]').click();
    await expect(layer).toBeVisible();
    await page.locator('.site-nav .brand').click();
    await page.waitForTimeout(700);
    await expect(page).toHaveURL(`${site.origin}/archives/`);
    await expect(layer).toBeVisible();
    await expect(page).toHaveURL(`${site.origin}/`);
    await expect(layer).toBeHidden();
    await expect(layer).toHaveCount(1);
});

test('mobile navigation closes before loading so its backdrop leaves the header clear', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${site.origin}/archives/`);
    await page.request.get(`${site.origin}/links/`);
    await page.locator('[data-menu-toggle]').click();
    const menu = page.locator('#mobile-navigation');
    await expect(menu).toHaveAttribute('open', '');
    await menu.locator('a[href="/links/"]').click();
    await expect(page.locator('[data-page-loading]')).toBeVisible();
    expect(await menu.evaluate((el) => (el as HTMLDialogElement).open)).toBe(
        false,
    );
    expect(
        await page.evaluate(() =>
            Boolean(document.elementFromPoint(24, 32)?.closest('.site-nav')),
        ),
    ).toBe(true);
    await expect(page).toHaveURL(`${site.origin}/links/`);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
});
