import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createBackgroundSite } from '../fixtures/site-background';
import {
    flushWidgetIdle,
    holdWidgetIdle,
} from '../fixtures/sakana-performance';

let site: Awaited<ReturnType<typeof createBackgroundSite>>;
test.beforeAll(async () => {
    test.setTimeout(120_000);
    site = await createBackgroundSite({ sakana: { showOnMobile: true } });
});
test.afterAll(async () => site?.close());

async function styles(page: Page) {
    return page.evaluate(() => {
        const css = [...document.styleSheets]
            .map((sheet) => {
                try {
                    return [...sheet.cssRules]
                        .map((rule) => rule.cssText)
                        .join('');
                } catch {
                    return '';
                }
            })
            .join('');
        return {
            home: css.includes('.home-hero-content'),
            article: css.includes('--art-radius-lg'),
            sakana: css.includes('.sakana-widget-app'),
        };
    });
}

async function navigate(page: Page, path: string) {
    await page.evaluate((path) => {
        const a = document.createElement('a');
        a.href = path;
        a.textContent = '测试页面跳转';
        a.id = 'style-test-navigation';
        document.body.append(a);
    }, path);
    await page.locator('#style-test-navigation').click();
    await expect(page).toHaveURL(site.origin + path);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
}

for (const [path, home, article] of [
    ['/', true, false],
    ['/archives/', false, false],
    ['/posts/format-example/', false, true],
    ['/pages/privacy/', false, true],
    ['/pages/terms/', false, true],
    ['/moments/format-example/', false, true],
    ['/links/', false, false],
] as const) {
    test(`direct ${path} loads only its page styles`, async ({ page }) => {
        await page.goto(site.origin + path);
        await expect
            .poll(() => styles(page))
            .toEqual({ home, article, sakana: false });
        expect(
            await page
                .locator('body')
                .evaluate((node) => getComputedStyle(node).transitionDuration),
        ).toBe('0s');
    });
}

test('shared body styles follow page, moment and article client navigation', async ({
    page,
}) => {
    await page.goto(site.origin);
    for (const path of [
        '/pages/privacy/',
        '/moments/format-example/',
        '/posts/format-example/',
    ]) {
        await navigate(page, path);
        await expect(page.locator('#article-content')).toBeVisible();
        await expect
            .poll(() => styles(page))
            .toEqual({ home: false, article: true, sakana: false });
    }
    await navigate(page, '/archives/');
    await expect
        .poll(() => styles(page))
        .toEqual({ home: false, article: false, sakana: false });
});

test.describe('optional widget styles', () => {
    test.use({ reducedMotion: 'no-preference' });
    test('vendor CSS waits for idle and survives a persisted widget and history return', async ({
        page,
    }) => {
        await holdWidgetIdle(page);
        await page.goto(site.origin);
        await expect(page.locator('[data-page-loading]')).toBeHidden();
        expect((await styles(page)).sakana).toBe(false);
        await flushWidgetIdle(page);
        await expect(page.locator('.sakana-widget-wrapper')).toBeVisible();
        expect((await styles(page)).sakana).toBe(true);
        await page.evaluate(() => {
            (window as Window & { savedWidget?: Element }).savedWidget =
                document.querySelector('[data-sakana]')!;
        });
        await navigate(page, '/?styles=1');
        expect(
            await page.evaluate(
                () =>
                    (window as Window & { savedWidget?: Element })
                        .savedWidget ===
                    document.querySelector('[data-sakana]'),
            ),
        ).toBe(true);
        expect((await styles(page)).sakana).toBe(true);
        await expect(page.locator('link[data-sakana-styles]')).toHaveCount(1);
        await navigate(page, '/posts/format-example/');
        await expect
            .poll(() => styles(page))
            .toEqual({ home: false, article: true, sakana: false });
        await page.goBack();
        await expect(page).toHaveURL(site.origin + '/?styles=1');
        await expect(page.locator('[data-page-loading]')).toBeHidden();
        await flushWidgetIdle(page);
        await expect(page.locator('.sakana-widget-wrapper')).toBeVisible();
        await expect
            .poll(() => styles(page))
            .toEqual({ home: true, article: false, sakana: true });
        await expect(page.locator('link[data-sakana-styles]')).toHaveCount(1);
    });

    test('saved hide avoids vendor CSS until restore', async ({ page }) => {
        await holdWidgetIdle(page);
        await page.addInitScript(() =>
            localStorage.setItem('sky-sakana-visibility', 'hide'),
        );
        await page.goto(site.origin);
        await expect(page.locator('[data-page-loading]')).toBeHidden();
        await flushWidgetIdle(page);
        expect((await styles(page)).sakana).toBe(false);
        await page.getByRole('button', { name: '显示 Sakana 挂件' }).click();
        await expect(page.locator('.sakana-widget-wrapper')).toBeVisible();
        expect((await styles(page)).sakana).toBe(true);
    });

    test('a failed optional stylesheet can retry without breaking the page', async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await holdWidgetIdle(page);
        let attempts = 0;
        await page.route(/\/_astro\/[^/]+\.css$/, async (route) => {
            const response = await route.fetch();
            const body = await response.body();
            if (
                body.includes(Buffer.from('.sakana-widget-app')) &&
                ++attempts === 1
            )
                await route.abort('failed');
            else await route.fulfill({ response, body });
        });
        await page.goto(site.origin);
        await expect(page.locator('[data-page-loading]')).toBeHidden();
        await flushWidgetIdle(page);
        await expect.poll(() => attempts).toBe(1);
        await expect(page.locator('link[data-sakana-styles]')).toHaveCount(0);
        await expect(page.locator('.sakana-widget-wrapper')).toHaveCount(0);
        await expect(page.locator('main')).toBeVisible();
        await page.evaluate(() =>
            document.dispatchEvent(new Event('visibilitychange')),
        );
        await expect(page.locator('.sakana-widget-wrapper')).toBeVisible();
        expect(attempts).toBe(2);
        expect((await styles(page)).sakana).toBe(true);
        await expect(page.locator('link[data-sakana-styles]')).toHaveCount(1);
        expect(errors).toEqual([]);
    });

    test('leaving while optional CSS is pending cancels the old widget', async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await holdWidgetIdle(page);
        let requested = false;
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        await page.route(/\/_astro\/[^/]+\.css$/, async (route) => {
            const response = await route.fetch();
            const body = await response.body();
            if (body.includes(Buffer.from('.sakana-widget-app'))) {
                requested = true;
                await gate;
            }
            await route.fulfill({ response, body }).catch(() => {});
        });
        try {
            await page.goto(site.origin, { waitUntil: 'domcontentloaded' });
            await expect(page.locator('[data-page-loading]')).toBeHidden();
            await flushWidgetIdle(page);
            await expect.poll(() => requested).toBe(true);
            await navigate(page, '/posts/format-example/');
            release();
            await expect(page.locator('link[data-sakana-styles]')).toHaveCount(
                0,
            );
            await expect(page.locator('.sakana-widget-wrapper')).toHaveCount(0);
            await expect
                .poll(() => styles(page))
                .toEqual({ home: false, article: true, sakana: false });
            expect(errors).toEqual([]);
        } finally {
            release();
        }
    });
});

test('route styles preserve dark mobile layout and article print rules', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(site.origin);
    await expect(page.locator('.home-hero-content')).toBeVisible();
    await navigate(page, '/posts/format-example/');
    await expect(page.locator('#article-content pre').first()).toBeVisible();
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
    ).toBe(true);
    await page.emulateMedia({ media: 'print' });
    expect(
        await page
            .locator('#article-content')
            .evaluate((node) => getComputedStyle(node).color),
    ).toBe('rgb(0, 0, 0)');
});
