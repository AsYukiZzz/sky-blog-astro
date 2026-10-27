import { expect, test } from '@playwright/test';
import { createBackgroundSite } from '../fixtures/site-background';

const titleText = 'Sky Journal';
let site: Awaited<ReturnType<typeof createBackgroundSite>>;

test.beforeAll(async () => {
    test.setTimeout(120_000);
    site = await createBackgroundSite({
        hero: {
            title: titleText,
            subtitle: '记录生活，分享思考',
            size: 'full',
        },
    });
});
test.afterAll(async () => site?.close());

for (const width of [375, 1440]) {
    test(`Hero displays the configured title with the local Caveat font at ${width}px`, async ({
        page,
    }) => {
        const fonts: string[] = [];
        page.on('request', (request) => {
            if (request.resourceType() === 'font') fonts.push(request.url());
        });
        await page.setViewportSize({ width, height: 900 });
        await page.goto(site.origin);
        await page.evaluate(() => document.fonts.ready);
        const hero = page.getByRole('region', { name: '首页封面' });
        const title = hero.getByRole('heading', { level: 1, name: titleText });
        await expect(title).toHaveCSS('font-family', /Caveat/);
        expect(
            await title.evaluate(
                async () =>
                    (
                        await document.fonts.load(
                            '400 104px Caveat',
                            'Sky Journal',
                        )
                    ).length,
            ),
        ).toBeGreaterThan(0);
        const caveatRequests = fonts.filter((url) => /caveat/i.test(url));
        expect(caveatRequests.length).toBeGreaterThan(0);
        expect(
            caveatRequests.every((url) => url.startsWith(`${site.origin}/`)),
        ).toBe(true);
        await expect(hero.getByRole('heading', { level: 1 })).toHaveCount(1);
        await expect(title).toHaveCSS('-webkit-text-stroke-width', '0px');
        await expect(title).toHaveCSS('text-shadow', 'none');
        const bounds = (await hero.boundingBox())!;
        const titleBounds = (await title.boundingBox())!;
        const subtitle = (await hero
            .locator('.home-hero-subtitle')
            .boundingBox())!;
        expect(titleBounds.x - bounds.x).toBeCloseTo(24, 0);
        expect(titleBounds.y).toBeGreaterThan(64);
        expect(titleBounds.y + titleBounds.height).toBeLessThan(subtitle.y);
        expect(
            bounds.y + bounds.height - subtitle.y - subtitle.height,
        ).toBeCloseTo(24, 0);
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBe(true);
    });
}

test('Hero remains plain text and shares the fixed wallpaper in both themes', async ({
    page,
}) => {
    await page.goto(site.origin);
    for (const scheme of ['light', 'dark']) {
        if (scheme === 'dark')
            await page.locator('.site-nav [data-theme-toggle]').click();
        await expect(page.locator('html')).toHaveAttribute(
            'data-color-scheme',
            scheme,
        );
        await expect(page.locator('.home-hero-title')).toBeVisible();
        await expect(page.locator('.home-hero')).toHaveCSS(
            'backdrop-filter',
            'none',
        );
        await expect(page.locator('.home-hero')).toHaveCSS(
            'background-color',
            'rgba(0, 0, 0, 0)',
        );
        await expect(page.locator('[data-site-background]')).toHaveCount(1);
        await expect(page.locator('[data-site-background]')).toHaveCSS(
            'position',
            'fixed',
        );
    }
});

test('Hero and its configured text render without JavaScript', async ({
    browser,
}) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
        const page = await context.newPage();
        await page.goto(site.origin);
        const title = page.getByRole('heading', { level: 1, name: titleText });
        await expect(title).toBeVisible();
        await expect(title).toHaveCSS('font-family', /Caveat/);
        expect(
            await page.evaluate(
                async () =>
                    (
                        await document.fonts.load(
                            '400 104px Caveat',
                            'Sky Journal',
                        )
                    ).length,
            ),
        ).toBeGreaterThan(0);
    } finally {
        await context.close();
    }
});

test('an unavailable Caveat font leaves the title and page usable', async ({
    page,
}) => {
    await page.route(
        (url) => /caveat.*\.woff2?$/i.test(url.pathname),
        (route) => route.abort('failed'),
    );
    await page.goto(site.origin);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await expect(page.locator('main')).not.toHaveAttribute('inert');
    await expect(
        page.getByRole('heading', { level: 1, name: titleText }),
    ).toBeVisible();
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
    ).toBe(true);
});

test('client navigation and history retain the selected font and color scheme', async ({
    page,
}) => {
    await page.goto(`${site.origin}/archives/`);
    await page.locator('.site-nav [data-theme-toggle]').click();
    await page
        .getByRole('link', { name: 'Sky Blog 首页', exact: true })
        .click();
    await expect(page).toHaveURL(`${site.origin}/`);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute(
        'data-color-scheme',
        'dark',
    );
    await expect(page.locator('.home-hero-title')).toHaveText(titleText);
    expect(
        await page.evaluate(
            async () =>
                (await document.fonts.load('400 104px Caveat', 'Sky Journal'))
                    .length,
        ),
    ).toBeGreaterThan(0);
    await page.goBack();
    await expect(page).toHaveURL(`${site.origin}/archives/`);
    await page.goForward();
    await expect(page).toHaveURL(`${site.origin}/`);
    await expect(page.locator('.home-hero-title')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute(
        'data-color-scheme',
        'dark',
    );
});

test('long mixed-language titles wrap without clipping on a narrow compact Hero', async ({
    page,
}) => {
    test.setTimeout(120_000);
    const compact = await createBackgroundSite({
        hero: {
            title: '记录生活与思考 A Wandering Notebook '.repeat(6),
            subtitle: '记录生活，分享思考',
            size: 'compact',
        },
    });
    try {
        await page.setViewportSize({ width: 375, height: 500 });
        await page.goto(compact.origin);
        await page.evaluate(() => document.fonts.ready);
        const hero = page.locator('.home-hero');
        const bounds = (await hero.boundingBox())!;
        const heading = (await hero
            .getByRole('heading', { level: 1 })
            .boundingBox())!;
        const subtitle = (await hero
            .locator('.home-hero-subtitle')
            .boundingBox())!;
        expect(heading.y).toBeGreaterThanOrEqual(64);
        expect(heading.y + heading.height).toBeLessThan(subtitle.y);
        expect(subtitle.y + subtitle.height).toBeLessThanOrEqual(
            bounds.y + bounds.height - 23,
        );
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBe(true);
    } finally {
        await compact.close();
    }
});

test('Hero stays static when page entrance animations are enabled', async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => {
        const observed = window as Window & { heroAnimated?: boolean };
        observed.heroAnimated = false;
        const sample = () => {
            const hero = document.querySelector('.home-hero');
            if (
                hero
                    ?.getAnimations({ subtree: true })
                    .some((animation) => animation.playState === 'running')
            )
                observed.heroAnimated = true;
            requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
    });
    await page.goto(site.origin);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await page.waitForTimeout(800);
    expect(
        await page.evaluate(
            () => (window as Window & { heroAnimated?: boolean }).heroAnimated,
        ),
    ).toBe(false);
});
