import { expect, test } from '@playwright/test';
import { createBackgroundSite } from '../fixtures/site-background';

test('serif weights reuse local variable subsets and survive partial navigation', async ({
    page,
}) => {
    const fontRequests: string[] = [];
    page.on('request', (request) => {
        if (request.resourceType() === 'font') fontRequests.push(request.url());
    });
    await page.goto('/archives/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('body')).toHaveCSS(
        'font-family',
        /Noto Serif SC Variable/,
    );
    const loadedWeights = await page.evaluate(async () => {
        const result: string[][] = [];
        for (const weight of [400, 600, 700, 900]) {
            const faces = await document.fonts.load(
                `${weight} 20px "Noto Serif SC Variable"`,
                '博客性能优化，Привет café',
            );
            result.push(faces.map((face) => face.weight));
        }
        return result;
    });
    expect(loadedWeights[0].length).toBeGreaterThan(0);
    for (const weights of loadedWeights) {
        expect(weights).toEqual(loadedWeights[0]);
        expect(weights.every((weight) => weight === '200 900')).toBe(true);
    }
    const notoRequests = fontRequests.filter((url) =>
        url.includes('noto-serif-sc'),
    );
    expect(notoRequests.length).toBeGreaterThan(0);
    expect(new Set(notoRequests).size).toBe(notoRequests.length);
    expect(
        notoRequests.every(
            (url) =>
                url.startsWith(new URL(page.url()).origin) &&
                /wght-normal.*\.woff2$/.test(url),
        ),
    ).toBe(true);
    await page.evaluate(() => {
        (window as Window & { fontTestBody?: HTMLElement }).fontTestBody =
            document.body;
    });
    await page.locator('.site-nav .brand').click();
    await expect(page).toHaveURL('/');
    expect(
        await page.evaluate(
            () =>
                (window as Window & { fontTestBody?: HTMLElement })
                    .fontTestBody === document.body,
        ),
    ).toBe(true);
    await expect(page.locator('.home-hero-title')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(
        await page.evaluate(() =>
            document.fonts.check('400 24px "Noto Serif SC Variable"', '博客'),
        ),
    ).toBe(true);
});

test('serif fonts work without JavaScript at a narrow viewport', async ({
    browser,
    baseURL,
}) => {
    const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 375, height: 812 },
    });
    try {
        const page = await context.newPage();
        await page.goto(`${baseURL}/posts/format-example/`);
        await page.evaluate(() => document.fonts.ready);
        expect(
            await page.evaluate(() =>
                [...document.fonts].some(
                    (face) =>
                        face.family.includes('Noto Serif SC Variable') &&
                        face.status === 'loaded',
                ),
            ),
        ).toBe(true);
        await expect(page.locator('#article-content')).toBeVisible();
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBe(true);
    } finally {
        await context.close();
    }
});

test('a failed Chinese font leaves fallback text and controls usable', async ({
    page,
}) => {
    await page.route('**/*noto-serif-sc*.woff2', (route) => route.abort());
    await page.goto('/posts/format-example/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await expect(page.locator('#article-content')).toBeVisible();
    await page.locator('.site-nav [data-open-search]').click();
    await expect(page.locator('#search-dialog')).toBeVisible();
});

test('development resolves the conditional font stylesheet and its files', async ({
    page,
}) => {
    test.setTimeout(120_000);
    const site = await createBackgroundSite({ developmentMode: 'development' });
    try {
        await page.goto(`${site.origin}/archives/`);
        // Vite can reload the first document after dependency discovery.
        await expect(async () => {
            const weights = await page.evaluate(async () =>
                (
                    await document.fonts.load(
                        '600 20px "Noto Serif SC Variable"',
                        '博客',
                    )
                ).map((face) => face.weight),
            );
            expect(weights.length).toBeGreaterThan(0);
            expect(weights.every((weight) => weight === '200 900')).toBe(true);
        }).toPass({ timeout: 15_000 });
    } finally {
        await site.close();
    }
});

test.describe('system font configuration', () => {
    let site: Awaited<ReturnType<typeof createBackgroundSite>>;
    test.beforeAll(async () => {
        test.setTimeout(120_000);
        site = await createBackgroundSite({
            font: 'sans',
            hero: {
                size: 'full',
                default: {
                    title: '博客 Sky Journal',
                    subtitle: '记录生活与思考',
                    position: 'bottom-left',
                },
                byWallpaper: {},
            },
        });
    });
    test.afterAll(async () => site?.close());

    test('home and article do not declare or download Chinese webfonts', async ({
        page,
    }) => {
        const fonts: string[] = [];
        page.on('request', (request) => {
            if (request.resourceType() === 'font') fonts.push(request.url());
        });
        await page.goto(site.origin);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('body')).toHaveCSS(
            'font-family',
            /system-ui/,
        );
        await expect(page.locator('.home-hero-title')).toHaveCSS(
            'font-family',
            /Caveat/,
        );
        await expect(page.locator('.home-hero-title')).toHaveText(
            '博客 Sky Journal',
        );
        expect(
            await page.evaluate(
                () =>
                    [...document.fonts].filter((face) =>
                        /Noto Serif SC/.test(face.family),
                    ).length,
            ),
        ).toBe(0);
        await page.locator('a[href="/posts/format-example/"]').first().click();
        await expect(page).toHaveURL(`${site.origin}/posts/format-example/`);
        await page.evaluate(() => document.fonts.ready);
        expect(fonts.filter((url) => url.includes('noto-serif-sc'))).toEqual(
            [],
        );
        expect(
            await page.evaluate(() =>
                [...document.fonts].some((face) =>
                    /Noto Serif SC/.test(face.family),
                ),
            ),
        ).toBe(false);
        await expect(page.locator('#article-content')).toBeVisible();
    });
});
