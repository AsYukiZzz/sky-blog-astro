import { expect, test, type Page } from '@playwright/test';
import { createBackgroundSite } from '../fixtures/site-background';

const firstImage = '/images/forest.svg?performance=unselected';
const selectedImage = 'https://wallpaper.example.test/selected.svg';
const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#7b9baf"/></svg>';
let site: Awaited<ReturnType<typeof createBackgroundSite>>;

test.beforeAll(async () => {
    test.setTimeout(120_000);
    site = await createBackgroundSite({
        background: {
            wallpapers: [
                { id: 'first', image: firstImage },
                { id: 'selected', image: selectedImage },
            ],
        },
    });
});
test.afterAll(async () => site?.close());

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => (Math.random = () => 0.999));
    await page.route(selectedImage, (route) =>
        route.fulfill({ contentType: 'image/svg+xml', body: svg }),
    );
});

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => (resolve = done));
    return { promise, resolve };
}

async function observeReveal(page: Page) {
    await page.addInitScript(() => {
        const scope = window as Window & {
            wallpaperReveal?: { opacity: number; ready: boolean; time: number };
        };
        let seenInitial = false;
        new MutationObserver(() => {
            const layer = document.querySelector<HTMLElement>(
                '[data-page-loading]',
            );
            const image = document.querySelector<HTMLImageElement>(
                '[data-site-wallpaper]',
            );
            if (!layer) return;
            if (!layer.hidden && layer.dataset.phase === 'initial')
                seenInitial = true;
            if (seenInitial && layer.hidden && image && !scope.wallpaperReveal)
                scope.wallpaperReveal = {
                    opacity: Number(getComputedStyle(image).opacity),
                    ready:
                        image.dataset.wallpaperState === 'ready' &&
                        image.naturalWidth > 0,
                    time: performance.now(),
                };
        }).observe(document, {
            subtree: true,
            attributes: true,
            attributeFilter: ['hidden', 'data-phase'],
        });
    });
}

test('ready wallpaper and usable content reveal before pending fonts finish', async ({
    page,
}) => {
    const fonts = deferred();
    await page.route('**/*.woff2', async (route) => {
        await fonts.promise;
        await route.continue();
    });
    try {
        await page.goto(`${site.origin}/archives/`, {
            waitUntil: 'domcontentloaded',
        });
        await expect
            .poll(() => page.evaluate(() => document.fonts.status))
            .toBe('loading');
        await expect(page.locator('[data-page-loading]')).toBeHidden({
            timeout: 1200,
        });
        expect(await page.evaluate(() => document.fonts.status)).toBe(
            'loading',
        );
        await expect(page.locator('main')).not.toHaveAttribute('inert');
        await page.locator('.site-nav [data-open-search]').click();
        await expect(page.locator('#search-dialog')).toBeVisible();
    } finally {
        fonts.resolve();
    }
});

for (const reducedMotion of ['reduce', 'no-preference'] as const) {
    test(`wallpaper is fully visible at the exact cover exit with ${reducedMotion}`, async ({
        page,
    }) => {
        await page.emulateMedia({ reducedMotion });
        await observeReveal(page);
        await page.addInitScript(() => {
            const decode = HTMLImageElement.prototype.decode;
            HTMLImageElement.prototype.decode = async function () {
                await decode.call(this);
                if (this.matches('[data-site-wallpaper]'))
                    await new Promise<void>(
                        (resolve) =>
                            ((
                                window as Window & {
                                    releaseReadyWallpaper?: () => void;
                                }
                            ).releaseReadyWallpaper = resolve),
                    );
            };
        });
        await page.goto(`${site.origin}/archives/`, {
            waitUntil: 'domcontentloaded',
        });
        await page.evaluate(() => document.fonts.ready);
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        typeof (
                            window as Window & {
                                releaseReadyWallpaper?: () => void;
                            }
                        ).releaseReadyWallpaper,
                ),
            )
            .toBe('function');
        await expect(page.locator('[data-site-wallpaper]')).toHaveCSS(
            'opacity',
            '0',
        );
        await expect(page.locator('[data-page-loading]')).toBeVisible();
        await page.evaluate(() =>
            (window as Window & { releaseReadyWallpaper?: () => void })
                .releaseReadyWallpaper!(),
        );
        await expect(page.locator('[data-page-loading]')).toBeHidden();
        expect(
            await page.evaluate(
                () =>
                    (
                        window as Window & {
                            wallpaperReveal?: {
                                opacity: number;
                                ready: boolean;
                            };
                        }
                    ).wallpaperReveal,
            ),
        ).toMatchObject({ opacity: 1, ready: true });
    });
}

test('selected wallpaper starts in the head even before background markup exists', async ({
    page,
}) => {
    const requests: string[] = [];
    page.on('request', (request) => {
        if (
            request.url() === selectedImage ||
            request.url() === `${site.origin}${firstImage}`
        )
            requests.push(request.url());
    });
    await page.route(`${site.origin}/archives/`, async (route) => {
        const response = await route.fetch();
        const html = await response.text();
        await route.fulfill({
            response,
            body: html.slice(0, html.indexOf('<body')) + '</html>',
        });
    });
    await page.goto(`${site.origin}/archives/`);
    await expect(page.locator('[data-site-background]')).toHaveCount(0);
    await expect.poll(() => requests).toEqual([selectedImage]);
    await expect(
        page.locator('head link[rel="preload"][as="image"]'),
    ).toHaveAttribute('href', selectedImage);
    await expect(page.locator('head link[rel="preconnect"]')).toHaveAttribute(
        'href',
        'https://wallpaper.example.test',
    );
});

test('one random selection and preload survive navigation without downloading other candidates', async ({
    page,
}) => {
    const requests: string[] = [];
    page.on('request', (request) => {
        if (
            request.url() === selectedImage ||
            request.url() === `${site.origin}${firstImage}`
        )
            requests.push(request.url());
    });
    await page.goto(`${site.origin}/archives/`);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await expect(page.locator('[data-site-wallpaper]')).toHaveAttribute(
        'src',
        selectedImage,
    );
    expect(requests).toEqual([selectedImage]);
    await page.evaluate(() => {
        const scope = window as Window & {
            initialWallpaperHint?: Element | null;
            wallpaperRandomCalls?: number;
        };
        scope.initialWallpaperHint = document.querySelector(
            'head link[rel="preload"][as="image"]',
        );
        scope.wallpaperRandomCalls = 0;
        Math.random = () => {
            scope.wallpaperRandomCalls!++;
            return 0;
        };
    });
    await page.locator('.archive-post h4 a').first().click();
    await expect(page.locator('#article-content')).toBeVisible();
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await page.goBack();
    await expect(page.locator('main h1')).toContainText('文章归档');
    expect(
        await page.evaluate(() => {
            const scope = window as Window & {
                initialWallpaperHint?: Element | null;
                wallpaperRandomCalls?: number;
            };
            return {
                same:
                    document.querySelector(
                        'head link[rel="preload"][as="image"]',
                    ) === scope.initialWallpaperHint,
                calls: scope.wallpaperRandomCalls,
            };
        }),
    ).toEqual({ same: true, calls: 0 });
    expect(requests).toEqual([selectedImage]);
});

test('without JavaScript only the first wallpaper is loaded and visible', async ({
    browser,
}) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
        const fallbackPage = await context.newPage();
        const requests: string[] = [];
        fallbackPage.on('request', (request) => {
            if (
                request.url() === selectedImage ||
                request.url() === `${site.origin}${firstImage}`
            )
                requests.push(request.url());
        });
        await fallbackPage.goto(`${site.origin}/archives/`);
        const image = fallbackPage.locator('[data-site-wallpaper]');
        await expect(image).toHaveCount(1);
        await expect(image).toHaveAttribute('src', firstImage);
        await expect(image).toBeVisible();
        await expect(image).toBeInViewport();
        await expect
            .poll(() =>
                image.evaluate(
                    (node) => (node as HTMLImageElement).naturalWidth,
                ),
            )
            .toBeGreaterThan(0);
        await expect(fallbackPage.locator('[data-page-loading]')).toBeHidden();
        expect(requests).toEqual([`${site.origin}${firstImage}`]);
    } finally {
        await context.close();
    }
});

test('wallpaper arriving after the deadline keeps its gentle fade', async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const image = deferred();
    await page.route(selectedImage, async (route) => {
        await image.promise;
        await route.fulfill({ contentType: 'image/svg+xml', body: svg });
    });
    try {
        await page.goto(`${site.origin}/archives/`, {
            waitUntil: 'domcontentloaded',
        });
        await expect(page.locator('[data-page-loading]')).toBeHidden({
            timeout: 4500,
        });
        const wallpaper = page.locator('[data-site-wallpaper]');
        await expect(wallpaper).toHaveCSS('opacity', '0');
        image.resolve();
        await expect(wallpaper).toHaveAttribute(
            'data-wallpaper-state',
            'ready',
        );
        const duration = await wallpaper.evaluate(
            (node) => getComputedStyle(node).transitionDuration,
        );
        expect(duration).toBe('0.3s');
        await expect(wallpaper).toHaveCSS('opacity', '1');
    } finally {
        image.resolve();
    }
});
