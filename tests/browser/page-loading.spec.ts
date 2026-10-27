import { expect, test, type Page } from '@playwright/test';
import { createBackgroundSite } from '../fixtures/site-background';

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

async function holdNavigation(page: Page, path: string) {
    const requested = deferred();
    const release = deferred();
    await page.route(`${site.origin}${path}`, async (route) => {
        requested.resolve();
        await release.promise;
        if (!route.request().failure()) await route.continue();
    });
    return { requested: requested.promise, release: release.resolve };
}

test('slow navigation shows a centered animated wave and clears it when ready', async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(`${site.origin}/archives/`);
    const layer = page.locator('[data-page-loading]');
    await expect(layer).toBeHidden();
    const gate = await holdNavigation(page, '/posts/format-example/');
    try {
        await page
            .locator('.archive-post h4 a[href="/posts/format-example/"]')
            .click();
        await gate.requested;
        await expect(layer).toBeVisible();
        await expect(layer).toHaveAttribute('role', 'status');
        await expect(
            layer.getByText('正在加载', { exact: true }),
        ).toBeVisible();
        await expect(layer.locator('[data-loading-bar]')).toHaveCount(7);
        await expect(page.locator('main')).toHaveAttribute('aria-busy', 'true');
        const nav = (await page.locator('.site-nav').boundingBox())!;
        const mask = (await layer.boundingBox())!;
        expect(mask.y).toBeCloseTo(nav.y + nav.height, 0);
        const blur = await layer.evaluate(
            (el) => getComputedStyle(el).backdropFilter,
        );
        expect(blur).toMatch(/blur\([1-9][\d.]*px\)/);
        await expect(layer).toHaveCSS('pointer-events', 'auto');
        const bounds = (await layer
            .locator('[data-loading-content]')
            .boundingBox())!;
        const viewport = page.viewportSize()!;
        expect(bounds.x + bounds.width / 2).toBeCloseTo(viewport.width / 2, 0);
        expect(bounds.y + bounds.height / 2).toBeCloseTo(
            nav.height + (viewport.height - nav.height) / 2,
            0,
        );
        const bars = layer.locator('[data-loading-bar]');
        const transforms = () =>
            bars.evaluateAll((elements) =>
                elements.map((el) => getComputedStyle(el).transform),
            );
        const before = await transforms();
        await expect.poll(transforms).not.toEqual(before);
        gate.release();
        await expect(page).toHaveURL(`${site.origin}/posts/format-example/`);
        await expect(layer).toBeHidden();
        await expect(layer).toHaveCount(1);
        await expect(page.locator('main')).not.toHaveAttribute(
            'aria-busy',
            'true',
        );
    } finally {
        gate.release();
    }
});

test('local controls and anchors do not restart loading after initial readiness', async ({
    page,
}) => {
    await page.goto(`${site.origin}/posts/format-example/`);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await page.evaluate(() => {
        document.documentElement.dataset.loadingShows = '0';
        const layer = document.querySelector<HTMLElement>(
            '[data-page-loading]',
        )!;
        new MutationObserver(() => {
            if (!layer.hidden) {
                const root = document.documentElement;
                root.dataset.loadingShows = String(
                    Number(root.dataset.loadingShows) + 1,
                );
            }
        }).observe(layer, {
            attributes: true,
            attributeFilter: ['hidden'],
        });
    });
    const layer = page.locator('[data-page-loading]');
    await expect(layer).toHaveCount(1);
    await page.locator('.site-nav [data-theme-toggle]').click();
    await page
        .getByRole('button', { name: '搜索', exact: true })
        .first()
        .click();
    await page.keyboard.press('Escape');
    await page.locator('.article-side [data-toc-link]').first().click();
    await expect(page).toHaveURL(/#.+/);
    await page.waitForTimeout(220);
    await expect(layer).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute(
        'data-loading-shows',
        '0',
    );
});

test('a superseded request and a stale page-load event cannot hide the current wave', async ({
    page,
}) => {
    await page.goto(`${site.origin}/archives/`);
    const first = await holdNavigation(page, '/posts/format-example/');
    const next = await holdNavigation(page, '/links/');
    const layer = page.locator('[data-page-loading]');
    try {
        await page
            .locator('.archive-post h4 a[href="/posts/format-example/"]')
            .click();
        await first.requested;
        await expect(layer).toBeVisible();
        await page.locator('.desktop-nav a[href="/links/"]').click();
        await next.requested;
        await expect(layer).toBeVisible();
        first.release();
        await page.evaluate(() =>
            document.dispatchEvent(new Event('astro:page-load')),
        );
        await expect(layer).toHaveAttribute('data-state', 'visible');
        next.release();
        await expect(page).toHaveURL(`${site.origin}/links/`);
        await expect(layer).toBeHidden();
    } finally {
        first.release();
        next.release();
    }
});

test('the persistent wave stays above the swapped page until blocking scripts finish', async ({
    page,
}) => {
    await page.goto(`${site.origin}/archives/`);
    const html = deferred();
    const script = deferred();
    const scriptRequested = deferred();
    await page.route(`${site.origin}/posts/format-example/`, async (route) => {
        const response = await route.fetch();
        const body = (await response.text()).replace(
            '</body>',
            '<script type="module" src="/loading-ready.js"></script></body>',
        );
        await html.promise;
        await route.fulfill({ response, body });
    });
    await page.route(`${site.origin}/loading-ready.js`, async (route) => {
        scriptRequested.resolve();
        await script.promise;
        await route.fulfill({ contentType: 'text/javascript', body: '' });
    });
    const layer = page.locator('[data-page-loading]');
    await layer.evaluate(
        (el) => ((el as HTMLElement).dataset.instance = 'original'),
    );
    try {
        await page
            .locator('.archive-post h4 a[href="/posts/format-example/"]')
            .click();
        await expect(layer).toBeVisible();
        html.resolve();
        await scriptRequested.promise;
        await expect(page).toHaveURL(`${site.origin}/posts/format-example/`);
        await expect(layer).toBeVisible();
        await expect(layer).toHaveAttribute('data-instance', 'original');
        expect(await layer.evaluate((el) => el.matches(':popover-open'))).toBe(
            true,
        );
        await expect(page.locator('main')).toHaveAttribute('aria-busy', 'true');
        script.resolve();
        await expect(layer).toBeHidden();
        await expect(layer).toHaveCount(1);
    } finally {
        html.resolve();
        script.resolve();
    }
});

test('an old page-load after two swaps cannot finish the newer pending scripts', async ({
    page,
}) => {
    await page.goto(`${site.origin}/archives/`);
    const firstScript = deferred();
    const secondScript = deferred();
    const firstRequested = deferred();
    const secondRequested = deferred();
    const oldPageLoad = deferred();
    await page.exposeBinding('observedPageLoad', () => oldPageLoad.resolve());
    await page.evaluate(() => {
        document.addEventListener(
            'astro:page-load',
            () => {
                (window as Window & { observedPageLoad?: () => void })
                    .observedPageLoad!();
            },
            { once: true },
        );
    });
    for (const [path, source, ready, release] of [
        [
            '/posts/format-example/',
            '/first-page-ready.js',
            firstRequested,
            firstScript,
        ],
        ['/links/', '/second-page-ready.js', secondRequested, secondScript],
    ] as const) {
        await page.route(`${site.origin}${path}`, async (route) => {
            const response = await route.fetch();
            const body = (await response.text()).replace(
                '</body>',
                `<script type="module" src="${source}"></script></body>`,
            );
            await route.fulfill({ response, body });
        });
        await page.route(`${site.origin}${source}`, async (route) => {
            ready.resolve();
            await release.promise;
            await route.fulfill({ contentType: 'text/javascript', body: '' });
        });
    }
    const layer = page.locator('[data-page-loading]');
    try {
        await page
            .locator('.archive-post h4 a[href="/posts/format-example/"]')
            .click();
        await firstRequested.promise;
        await page.locator('.desktop-nav a[href="/links/"]').click();
        await secondRequested.promise;
        await expect(page).toHaveURL(`${site.origin}/links/`);
        await expect(layer).toHaveAttribute('data-state', 'visible');
        firstScript.resolve();
        await oldPageLoad.promise;
        await expect(layer).toHaveAttribute('data-state', 'visible');
        await expect(page.locator('main')).toHaveAttribute('aria-busy', 'true');
        secondScript.resolve();
        await expect(layer).toBeHidden();
    } finally {
        firstScript.resolve();
        secondScript.resolve();
    }
});

test('a failed preparation hides the wave before the full-page fallback finishes', async ({
    page,
}) => {
    await page.goto(`${site.origin}/archives/`);
    const request = deferred();
    const fallback = deferred();
    const fallbackRequested = deferred();
    const hidden = deferred();
    let hiddenState: unknown;
    await page.exposeBinding('loadingHidden', (_source, state) => {
        hiddenState = state;
        hidden.resolve();
    });
    await page.evaluate(() => {
        const layer = document.querySelector<HTMLElement>(
            '[data-page-loading]',
        )!;
        new MutationObserver(() => {
            if (layer.hidden) {
                (
                    window as Window & {
                        loadingHidden?: (state: unknown) => void;
                    }
                ).loadingHidden!({
                    hidden: layer.hidden,
                    busy:
                        document
                            .querySelector('main')
                            ?.getAttribute('aria-busy') === 'true',
                });
            }
        }).observe(layer, { attributes: true, attributeFilter: ['hidden'] });
    });
    await page.route(`${site.origin}/posts/format-example/`, async (route) => {
        if (route.request().isNavigationRequest()) {
            fallbackRequested.resolve();
            await fallback.promise;
            await route.fulfill({
                contentType: 'text/html',
                body: '<!doctype html><title>Fallback</title><h1>Fallback</h1>',
            });
        } else {
            await request.promise;
            await route.fulfill({
                status: 503,
                contentType: 'text/plain',
                body: 'Unavailable',
            });
        }
    });
    const layer = page.locator('[data-page-loading]');
    try {
        await page
            .locator('.archive-post h4 a[href="/posts/format-example/"]')
            .click();
        await expect(layer).toBeVisible();
        request.resolve();
        await fallbackRequested.promise;
        // Playwright waits for a pending hard navigation before resolving locators.
        // Observe cleanup from the old document while the fallback response is held.
        await hidden.promise;
        expect(hiddenState).toEqual({ hidden: true, busy: false });
        fallback.resolve();
        await expect(
            page.getByRole('heading', { name: 'Fallback' }),
        ).toBeVisible();
    } finally {
        request.resolve();
        fallback.resolve();
    }
});

test('slow back and forward navigation reuse the same loading surface', async ({
    page,
}) => {
    await page.goto(`${site.origin}/posts/format-example/`);
    const layer = page.locator('[data-page-loading]');
    await layer.evaluate(
        (el) => ((el as HTMLElement).dataset.instance = 'history'),
    );
    await page.locator('.site-nav .brand').click();
    await expect(page).toHaveURL(`${site.origin}/`);
    const back = await holdNavigation(page, '/posts/format-example/');
    const forward = await holdNavigation(page, '/');
    try {
        const backward = page.goBack();
        await back.requested;
        await expect(layer).toBeVisible();
        back.release();
        await backward;
        await expect(page).toHaveURL(`${site.origin}/posts/format-example/`);
        await expect(layer).toBeHidden();
        const forwardNavigation = page.goForward();
        await forward.requested;
        await expect(layer).toBeVisible();
        forward.release();
        await forwardNavigation;
        await expect(layer).toBeHidden();
        await expect(layer).toHaveAttribute('data-instance', 'history');
        await expect(layer).toHaveCount(1);
    } finally {
        back.release();
        forward.release();
    }
});

test('the first client visit to home finishes after its inline module runs', async ({
    page,
}) => {
    await page.goto(`${site.origin}/archives/`);
    const gate = await holdNavigation(page, '/');
    const layer = page.locator('[data-page-loading]');
    try {
        await page.locator('.site-nav .brand').click();
        await gate.requested;
        await expect(layer).toBeVisible();
        gate.release();
        await expect(page).toHaveURL(`${site.origin}/`);
        await expect(page.locator('.hero-title')).toBeVisible();
        await expect(layer).toBeHidden();
        await expect(page.locator('main')).not.toHaveAttribute(
            'aria-busy',
            'true',
        );
    } finally {
        gate.release();
    }
});

for (const popover of [true, false]) {
    test(`mobile reduced-motion wave stays centered with ${popover ? 'native top-layer' : 'fixed fallback'}`, async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        if (!popover) {
            await page.addInitScript(() => {
                Object.defineProperty(HTMLElement.prototype, 'showPopover', {
                    value: undefined,
                });
                Object.defineProperty(document, 'startViewTransition', {
                    value: undefined,
                });
            });
        }
        await page.goto(`${site.origin}/archives/`);
        const gate = await holdNavigation(page, '/posts/format-example/');
        const layer = page.locator('[data-page-loading]');
        try {
            await page
                .locator('.archive-post h4 a[href="/posts/format-example/"]')
                .click();
            await gate.requested;
            await expect(layer).toBeVisible();
            await expect(layer.locator('[data-loading-bar]').first()).toHaveCSS(
                'animation-name',
                'none',
            );
            const box = (await layer
                .locator('[data-loading-content]')
                .boundingBox())!;
            expect(box.x + box.width / 2).toBeCloseTo(195, 0);
            expect(box.y + box.height / 2).toBeCloseTo(454, 0);
            expect((await layer.boundingBox())!.y).toBeCloseTo(64, 0);
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth,
                ),
            ).toBe(true);
            expect(await page.locator('dialog:modal').count()).toBe(0);
            gate.release();
            await expect(layer).toBeHidden();
        } finally {
            gate.release();
        }
    });
}

test('wave is hidden without JavaScript and ordinary links remain usable', async ({
    browser,
}) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
        const page = await context.newPage();
        await page.goto(`${site.origin}/archives/`);
        await expect(page.locator('[data-page-loading]')).toBeHidden();
        await page
            .locator('.archive-post h4 a[href="/posts/format-example/"]')
            .click();
        await expect(page).toHaveURL(`${site.origin}/posts/format-example/`);
        await expect(page.locator('[data-page-loading]')).toBeHidden();
    } finally {
        await context.close();
    }
});

test('late initial pageshow does not cancel a navigation started before images finish', async ({
    page,
}) => {
    const image = deferred();
    const initiallyShown = deferred();
    await page.exposeBinding('initialPageShown', () =>
        initiallyShown.resolve(),
    );
    await page.addInitScript(() => {
        window.addEventListener('pageshow', (event) => {
            if (!event.persisted) {
                (window as Window & { initialPageShown?: () => void })
                    .initialPageShown!();
            }
        });
    });
    await page.route(`${site.origin}/images/dusk.svg`, async (route) => {
        await image.promise;
        await route.continue();
    });
    await page.goto(`${site.origin}/posts/format-example/`, {
        waitUntil: 'domcontentloaded',
    });
    const gate = await holdNavigation(page, '/');
    const layer = page.locator('[data-page-loading]');
    try {
        await page.locator('.site-nav .brand').click();
        await gate.requested;
        await expect(layer).toHaveAttribute('data-state', 'visible');
        image.resolve();
        await initiallyShown.promise;
        await expect(layer).toHaveAttribute('data-state', 'visible');
        gate.release();
        await expect(page).toHaveURL(`${site.origin}/`);
        await expect(layer).toBeHidden();
    } finally {
        image.resolve();
        gate.release();
    }
});
