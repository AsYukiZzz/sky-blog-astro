import { expect, test } from '@playwright/test';
import {
    createBackgroundSite,
    wallpaperSource,
} from '../fixtures/site-background';

let site: Awaited<ReturnType<typeof createBackgroundSite>>;

test.beforeAll(async () => {
    test.setTimeout(120_000);
    site = await createBackgroundSite({
        background: { position: 'center top' },
    });
});

test.afterAll(async () => {
    await site?.close();
});

test('all page families render the same fixed wallpaper and crop alignment', async ({
    page,
}) => {
    for (const path of [
        '/',
        '/archives/',
        '/categories/',
        '/tags/',
        '/columns/',
        '/moments/',
        '/links/',
        '/posts/format-example/',
        '/sitemap/',
        '/404.html',
    ]) {
        await page.goto(`${site.origin}${path}`);
        const background = page.locator('[data-site-background]');
        await expect(background).toHaveCount(1);
        await expect(background).toHaveCSS('position', 'fixed');
        await expect(background.locator('img')).toHaveAttribute(
            'src',
            wallpaperSource,
        );
        await expect(background.locator('img')).toHaveCSS(
            'object-position',
            '50% 0%',
        );
    }
});

for (const width of [375, 1440]) {
    test(`wallpaper stays still as the Hero and cards scroll at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(site.origin);
        const background = page.locator('[data-site-background]');
        const before = await background.boundingBox();
        await page.evaluate(() =>
            scrollTo({ top: innerHeight + 300, behavior: 'instant' }),
        );
        await expect
            .poll(() => page.evaluate(() => scrollY))
            .toBeGreaterThan(300);
        expect(await background.boundingBox()).toEqual(before);
        expect(
            await page
                .locator('.home-hero')
                .evaluate((el) => el.getBoundingClientRect().bottom),
        ).toBeLessThan(0);
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBe(true);
    });
}

test('client navigation and browser history preserve the wallpaper instance', async ({
    page,
}) => {
    await page.goto(`${site.origin}/archives/`);
    await page.locator('[data-site-background]').evaluate((el) => {
        (el as HTMLElement).dataset.instance = 'original';
    });
    await page
        .getByRole('link', { name: 'Sky Blog 首页', exact: true })
        .click();
    await expect(page).toHaveURL(`${site.origin}/`);
    await expect(page.locator('[data-site-background]')).toHaveAttribute(
        'data-instance',
        'original',
    );
    await page.goBack();
    await expect(page).toHaveURL(`${site.origin}/archives/`);
    await expect(page.locator('[data-site-background]')).toHaveAttribute(
        'data-instance',
        'original',
    );
    await page.goForward();
    await expect(page.locator('[data-site-background]')).toHaveAttribute(
        'data-instance',
        'original',
    );
});

test('wallpaper renders without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
        const page = await context.newPage();
        await page.goto(`${site.origin}/posts/format-example/`);
        const image = page.locator('[data-site-wallpaper]');
        await expect
            .poll(() =>
                image.evaluate((el: HTMLImageElement) => el.naturalWidth),
            )
            .toBeGreaterThan(0);
        await expect(page.locator('[data-site-background]')).toHaveCSS(
            'position',
            'fixed',
        );
    } finally {
        await context.close();
    }
});

test('an unavailable wallpaper leaves the theme background and content usable', async ({
    page,
}) => {
    await page.route('**/forest.svg?site=wallpaper', (route) =>
        route.fulfill({ status: 404, body: '' }),
    );
    await page.goto(site.origin);
    const color = await page
        .locator('[data-site-background]')
        .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(color).not.toBe('rgba(0, 0, 0, 0)');
    await expect(
        page.locator('.home-hero').getByRole('heading', { level: 1 }),
    ).toBeVisible();
    await expect(page.locator('[data-home-card="author"]')).toBeAttached();
});

test('the default solid configuration renders no wallpaper request', async ({
    page,
}) => {
    await page.goto('/archives/');
    await expect(page.locator('[data-site-background]')).toHaveCount(1);
    await expect(page.locator('[data-site-wallpaper]')).toHaveCount(0);
});
