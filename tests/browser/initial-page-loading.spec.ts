import { expect, test } from '@playwright/test';
import {
    createBackgroundSite,
    wallpaperSource,
} from '../fixtures/site-background';

let site: Awaited<ReturnType<typeof createBackgroundSite>>;
test.beforeAll(async () => {
    test.setTimeout(120_000);
    site = await createBackgroundSite();
});
test.afterAll(async () => site?.close());

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

test('initial loading blocks background Tab focus before modules and DOMContentLoaded finish', async ({
    page,
}) => {
    const modules = deferred();
    await page.route('**/_astro/*.js', async (route) => {
        await modules.promise;
        await route.continue();
    });
    try {
        await page.goto(`${site.origin}/archives/`, { waitUntil: 'commit' });
        const layer = page.locator('[data-page-loading]');
        await expect(layer).toBeVisible();
        await expect(page.locator('main')).toBeAttached();
        for (const key of ['Tab', 'Shift+Tab']) {
            await page.keyboard.press(key);
            expect(
                await page.evaluate(
                    () =>
                        document.activeElement === document.body ||
                        Boolean(
                            document.activeElement?.closest(
                                '[data-page-loading]',
                            ),
                        ),
                ),
            ).toBe(true);
        }
        modules.resolve();
        await page.waitForLoadState('load');
        await expect(layer).toBeHidden();
        const skip = page.locator('.skip-link');
        await skip.focus();
        await expect(skip).toBeFocused();
    } finally {
        modules.resolve();
    }
});

test('search shortcuts stay disabled during initial loading and recover after release', async ({
    page,
}) => {
    const cover = deferred();
    await page.route(`${site.origin}/images/dusk.svg`, async (route) => {
        await cover.promise;
        await route.continue();
    });
    try {
        await page.goto(`${site.origin}/posts/format-example/`, {
            waitUntil: 'domcontentloaded',
        });
        const layer = page.locator('[data-page-loading]');
        const dialog = page.locator('#search-dialog');
        await expect(layer).toBeVisible();
        for (const key of ['Control+k', 'Meta+k']) {
            await page.keyboard.press(key);
            expect(
                await dialog.evaluate((el) => (el as HTMLDialogElement).open),
            ).toBe(false);
        }
        cover.resolve();
        await expect(layer).toBeHidden();
        await page.keyboard.press('Control+k');
        await expect(dialog).toHaveAttribute('open', '');
        const input = page.locator('[data-search-input]');
        await expect(input).toBeFocused();
        await page.keyboard.type('review');
        await expect(input).toHaveValue('review');
        await page.keyboard.press('Escape');
        await expect(dialog).not.toHaveAttribute('open');
    } finally {
        cover.resolve();
    }
});

test('a first-screen eager moment cover is awaited before its intrinsic dimensions arrive', async ({
    page,
}) => {
    const image = deferred();
    await page.route(`${site.origin}/images/forest.svg`, async (route) => {
        await image.promise;
        await route.continue();
    });
    try {
        await page.goto(`${site.origin}/moments/`, {
            waitUntil: 'domcontentloaded',
        });
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('[data-site-wallpaper]')).toHaveCSS(
            'opacity',
            '1',
        );
        await page.waitForTimeout(100);
        const cover = page
            .locator('main img[src="/images/forest.svg"]')
            .first();
        expect(
            await cover.evaluate((el) => (el as HTMLImageElement).naturalWidth),
        ).toBe(0);
        const layer = page.locator('[data-page-loading]');
        expect(await layer.isVisible()).toBe(true);
        image.resolve();
        await expect(layer).toBeHidden();
        expect((await cover.boundingBox())!.height).toBeGreaterThan(0);
    } finally {
        image.resolve();
    }
});

for (const width of ['20px', 'auto']) {
    test(`a pending zero-height image at the viewport top with ${width} width still blocks initial readiness`, async ({
        page,
    }) => {
        const image = deferred();
        await page.route(`${site.origin}/archives/`, async (route) => {
            const response = await route.fetch();
            const body = (await response.text()).replace(
                '</main>',
                `<img src="/pending-size.svg" alt="" style="position:fixed;top:0;left:0;width:${width};height:auto" /></main>`,
            );
            await route.fulfill({ response, body });
        });
        await page.route(`${site.origin}/pending-size.svg`, async (route) => {
            await image.promise;
            await route.fulfill({
                contentType: 'image/svg+xml',
                body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>',
            });
        });
        try {
            await page.goto(`${site.origin}/archives/`, {
                waitUntil: 'domcontentloaded',
            });
            await page.evaluate(() => document.fonts.ready);
            await expect(page.locator('[data-site-wallpaper]')).toHaveCSS(
                'opacity',
                '1',
            );
            await page.waitForTimeout(100);
            const layer = page.locator('[data-page-loading]');
            expect(await layer.isVisible()).toBe(true);
            image.resolve();
            await expect(layer).toBeHidden();
        } finally {
            image.resolve();
        }
    });
}

test('initial visit and refresh cover the entire page until the wallpaper is decoded', async ({
    page,
}) => {
    let image = deferred();
    await page.route(`${site.origin}${wallpaperSource}`, async (route) => {
        await image.promise;
        await route.continue();
    });
    try {
        for (const refresh of [false, true]) {
            image = deferred();
            if (refresh) await page.reload({ waitUntil: 'domcontentloaded' });
            else
                await page.goto(`${site.origin}/archives/`, {
                    waitUntil: 'domcontentloaded',
                });
            const layer = page.locator('[data-page-loading]');
            await expect(layer).toBeVisible();
            await expect(layer).toHaveAttribute('data-phase', 'initial');
            await expect(
                layer.getByText('Sky Blog', { exact: true }),
            ).toBeVisible();
            await expect(
                layer.getByText('正在加载', { exact: true }),
            ).toBeVisible();
            const box = (await layer.boundingBox())!;
            expect(box).toMatchObject({ x: 0, y: 0, width: 1280, height: 900 });
            await expect(page.locator('html')).toHaveAttribute(
                'aria-busy',
                'true',
            );
            await expect(page.locator('main')).toHaveAttribute('inert', '');
            await expect(page.locator('[data-site-wallpaper]')).toHaveCSS(
                'opacity',
                '0',
            );
            image.resolve();
            await expect(layer).toBeHidden();
            await expect(page.locator('[data-site-wallpaper]')).toHaveCSS(
                'opacity',
                '1',
            );
            await expect(page.locator('main')).not.toHaveAttribute('inert');
            await expect(page.locator('html')).not.toHaveAttribute('aria-busy');
        }
    } finally {
        image.resolve();
    }
});

test('a wallpaper timeout reveals usable content and a late decoded image fades in', async ({
    page,
}) => {
    const image = deferred();
    await page.route(`${site.origin}${wallpaperSource}`, async (route) => {
        await image.promise;
        await route.continue();
    });
    try {
        await page.goto(`${site.origin}/archives/`, {
            waitUntil: 'domcontentloaded',
        });
        const layer = page.locator('[data-page-loading]');
        await expect(layer).toBeVisible();
        await expect(layer).toBeHidden({ timeout: 4500 });
        const wallpaper = page.locator('[data-site-wallpaper]');
        await expect(wallpaper).toHaveCSS('opacity', '0');
        await expect(page.locator('main')).not.toHaveAttribute('inert');
        image.resolve();
        await expect(wallpaper).toHaveCSS('opacity', '1');
        await expect(layer).toBeHidden();
        expect(
            await wallpaper.evaluate(
                (el) => (el as HTMLImageElement).naturalWidth,
            ),
        ).toBeGreaterThan(0);
    } finally {
        image.resolve();
    }
});

test('downloaded wallpaper still waits for decoding before revealing the page', async ({
    page,
}) => {
    await page.addInitScript(() => {
        const decode = HTMLImageElement.prototype.decode;
        HTMLImageElement.prototype.decode = async function () {
            await decode.call(this);
            if (this.matches('[data-site-wallpaper]')) {
                await new Promise<void>((resolve) => {
                    (
                        window as Window & {
                            releaseWallpaperDecode?: () => void;
                        }
                    ).releaseWallpaperDecode = resolve;
                });
            }
        };
    });
    await page.goto(`${site.origin}/archives/`, {
        waitUntil: 'domcontentloaded',
    });
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    typeof (
                        window as Window & {
                            releaseWallpaperDecode?: () => void;
                        }
                    ).releaseWallpaperDecode,
            ),
        )
        .toBe('function');
    await expect(page.locator('[data-page-loading]')).toBeVisible();
    await expect(page.locator('[data-site-wallpaper]')).toHaveCSS(
        'opacity',
        '0',
    );
    await page.evaluate(() =>
        (window as Window & { releaseWallpaperDecode?: () => void })
            .releaseWallpaperDecode!(),
    );
    await expect(page.locator('[data-page-loading]')).toBeHidden();
});

test('a failed wallpaper leaves the theme background and does not block reading', async ({
    page,
}) => {
    await page.route(`${site.origin}${wallpaperSource}`, (route) =>
        route.fulfill({ status: 404, body: '' }),
    );
    await page.goto(`${site.origin}/archives/`);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await expect(page.locator('[data-site-wallpaper]')).toHaveCSS(
        'opacity',
        '0',
    );
    await expect(page.locator('main')).not.toHaveAttribute('inert');
});

test('a first-screen article cover is included in initial readiness', async ({
    page,
}) => {
    const cover = deferred();
    await page.route(`${site.origin}/images/dusk.svg`, async (route) => {
        await cover.promise;
        await route.continue();
    });
    try {
        await page.goto(`${site.origin}/posts/format-example/`, {
            waitUntil: 'domcontentloaded',
        });
        await expect(page.locator('[data-site-wallpaper]')).toHaveCSS(
            'opacity',
            '1',
        );
        const layer = page.locator('[data-page-loading]');
        await expect(layer).toBeVisible();
        cover.resolve();
        await expect(layer).toBeHidden();
    } finally {
        cover.resolve();
    }
});

test('offscreen and hidden eager images do not hold the initial cover open', async ({
    page,
}) => {
    const image = deferred();
    const requested = deferred();
    await page.route(`${site.origin}/archives/`, async (route) => {
        const response = await route.fetch();
        const body = (await response.text()).replace(
            '</main>',
            '<img src="/offscreen.svg" width="20" height="20" style="position:absolute;top:5000px" /><img src="/offscreen.svg" hidden style="position:fixed;top:0;left:100px;width:20px" /></main>',
        );
        await route.fulfill({ response, body });
    });
    await page.route(`${site.origin}/offscreen.svg`, async (route) => {
        requested.resolve();
        await image.promise;
        await route.fulfill({
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>',
        });
    });
    try {
        await page.goto(`${site.origin}/archives/`, {
            waitUntil: 'domcontentloaded',
        });
        await requested.promise;
        await expect(page.locator('[data-page-loading]')).toBeHidden({
            timeout: 1500,
        });
        await page
            .getByRole('button', { name: '搜索', exact: true })
            .first()
            .click();
        await expect(page.locator('#search-dialog')).toHaveAttribute(
            'open',
            '',
        );
        const loaded = page.waitForLoadState('load');
        image.resolve();
        await loaded;
        await expect(page.locator('#search-dialog')).toHaveAttribute(
            'open',
            '',
        );
    } finally {
        image.resolve();
    }
});

test('the inline timeout still releases the cover when runtime modules are unavailable', async ({
    page,
}) => {
    const modules = deferred();
    await page.route('**/_astro/*.js', async (route) => {
        await modules.promise;
        await route.continue();
    });
    try {
        await page.goto(`${site.origin}/archives/`, { waitUntil: 'commit' });
        await expect(page.locator('[data-page-loading]')).toBeVisible();
        await expect(page.locator('[data-page-loading]')).toBeHidden({
            timeout: 4500,
        });
        await expect(page.locator('main')).not.toHaveAttribute('inert');
        await expect(page.locator('html')).not.toHaveAttribute('aria-busy');
    } finally {
        modules.resolve();
    }
});

test('an old initial completion cannot close a newer navigation loading layer', async ({
    page,
}) => {
    const image = deferred();
    const navigation = deferred();
    await page.route(`${site.origin}${wallpaperSource}`, async (route) => {
        await image.promise;
        await route.continue();
    });
    await page.route(`${site.origin}/links/`, async (route) => {
        await navigation.promise;
        await route.continue();
    });
    try {
        await page.goto(`${site.origin}/archives/`, {
            waitUntil: 'domcontentloaded',
        });
        await expect(page.locator('[data-page-loading]')).toHaveAttribute(
            'data-phase',
            'initial',
        );
        await page
            .locator('.desktop-nav a[href="/links/"]')
            .evaluate((el) => (el as HTMLAnchorElement).click());
        const layer = page.locator('[data-page-loading]');
        await expect(layer).toHaveAttribute('data-state', 'visible');
        await expect(layer).not.toHaveAttribute('data-phase', 'initial');
        image.resolve();
        await expect(page.locator('[data-site-wallpaper]')).toHaveCSS(
            'opacity',
            '1',
        );
        await page.waitForTimeout(200);
        await expect(layer).toHaveAttribute('data-state', 'visible');
        navigation.resolve();
        await expect(page).toHaveURL(`${site.origin}/links/`);
        await expect(layer).toBeHidden();
    } finally {
        image.resolve();
        navigation.resolve();
    }
});

test('mobile initial loading uses a full dark background and static wave with reduced motion', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    const image = deferred();
    await page.route(`${site.origin}${wallpaperSource}`, async (route) => {
        await image.promise;
        await route.continue();
    });
    try {
        await page.goto(`${site.origin}/archives/`, {
            waitUntil: 'domcontentloaded',
        });
        const layer = page.locator('[data-page-loading]');
        await expect(layer).toBeVisible();
        expect((await layer.boundingBox())!).toMatchObject({
            x: 0,
            y: 0,
            width: 390,
            height: 844,
        });
        await expect(page.locator('html')).toHaveAttribute(
            'data-color-scheme',
            'dark',
        );
        await expect(layer.locator('[data-loading-bar]').first()).toHaveCSS(
            'animation-name',
            'none',
        );
        image.resolve();
        await expect(layer).toBeHidden();
    } finally {
        image.resolve();
    }
});
