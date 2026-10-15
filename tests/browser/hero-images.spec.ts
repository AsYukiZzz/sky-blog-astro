import { expect, test, type Page } from '@playwright/test';
import {
    createHeroSite,
    heroImagePaths as sources,
} from '../fixtures/hero-site';

let site: Awaited<ReturnType<typeof createHeroSite>>;

test.beforeAll(async () => {
    test.setTimeout(120_000);
    site = await createHeroSite();
});

test.afterAll(async () => {
    await site?.close();
});

async function firstImageOnLoad(page: Page) {
    await page.addInitScript(() => {
        Math.random = () => 0;
    });
}

test('the real multi-image configuration serializes candidates and supplies the no-JavaScript fallback', async ({
    browser,
}) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
        const page = await context.newPage();
        await page.goto(site.origin);
        const hero = page.locator('.home-hero > img.hero-media');
        await expect(hero).toHaveAttribute(
            'data-hero-images',
            JSON.stringify(sources),
        );
        expect(await hero.getAttribute('src')).toBeNull();
        const fallback = page.locator('.home-hero noscript img.hero-media');
        await expect(fallback).toHaveAttribute('src', sources[0]);
        await expect
            .poll(() =>
                fallback.evaluate(
                    (image: HTMLImageElement) => image.naturalWidth,
                ),
            )
            .toBeGreaterThan(0);
    } finally {
        await context.close();
    }
});

test('the hero starts loading before unrelated eager images finish and is selected only once', async ({
    page,
}) => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
        release = resolve;
    });
    await page.route('**/hero-test-delayed.svg', async (route) => {
        await pending;
        await route.fulfill({
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
        });
    });
    await firstImageOnLoad(page);
    await page.route(`${site.origin}/`, async (route) => {
        const response = await route.fetch();
        const html = await response.text();
        await route.fulfill({
            response,
            body: html.replace(
                '</body>',
                '<img src="/hero-test-delayed.svg" width="1" height="1" alt=""></body>',
            ),
        });
    });
    try {
        await page.goto(site.origin, { waitUntil: 'domcontentloaded' });
        const hero = page.locator('img[data-hero-images]');
        await expect(hero).toHaveAttribute('src', sources[0]);
        await expect
            .poll(() =>
                hero.evaluate((image: HTMLImageElement) => image.naturalWidth),
            )
            .toBeGreaterThan(0);
        await page.evaluate(() => {
            Math.random = () => 0.999;
        });
        release();
        await page.waitForLoadState('load');
        await expect(hero).toHaveAttribute('src', sources[0]);
    } finally {
        release();
    }
});

test('client navigation and history return choose a fresh hero image', async ({
    page,
}) => {
    await firstImageOnLoad(page);
    await page.goto(site.origin);
    const hero = page.locator('img[data-hero-images]');
    await expect(hero).toHaveAttribute('src', sources[0]);
    await page.goto(`${site.origin}/archives/`);
    await page.evaluate(() => {
        Math.random = () => 0.999;
    });
    await page
        .getByRole('link', { name: 'Sky Blog 首页', exact: true })
        .click();
    await expect(hero).toHaveAttribute('src', sources[1]);
    await page.goBack();
    await expect(page).toHaveURL(/\/archives\/$/);
    await page.evaluate(() => {
        Math.random = () => 0;
    });
    await page.goForward();
    await expect(hero).toHaveAttribute('src', sources[0]);
});

test('restoring the actual homepage from BFCache selects an image again', async ({
    playwright,
    channel,
    headless,
}) => {
    const browser = await playwright.chromium.launch({
        channel,
        headless,
        ignoreDefaultArgs: ['--disable-back-forward-cache'],
    });
    try {
        const page = await browser.newPage({ reducedMotion: 'reduce' });
        await firstImageOnLoad(page);
        await page.addInitScript(() => {
            window.addEventListener('pageshow', (event) => {
                document.documentElement.dataset.heroRestored = String(
                    event.persisted,
                );
            });
        });
        await page.goto(site.origin);
        const hero = page.locator('img[data-hero-images]');
        await expect(hero).toHaveAttribute('src', sources[0]);
        const token = await page.evaluate(() => {
            const token = crypto.randomUUID();
            document.documentElement.dataset.heroToken = token;
            Math.random = () => 0.999;
            return token;
        });
        await page.evaluate((url) => {
            location.assign(url);
        }, `${site.origin}/hero-outside.html`);
        await expect(page).toHaveURL(`${site.origin}/hero-outside.html`);
        await page.goBack({ waitUntil: 'commit' });
        await expect(page.locator('html')).toHaveAttribute(
            'data-hero-restored',
            'true',
        );
        await expect(page.locator('html')).toHaveAttribute(
            'data-hero-token',
            token,
        );
        await expect(hero).toHaveAttribute('src', sources[1]);
    } finally {
        await browser.close();
    }
});
