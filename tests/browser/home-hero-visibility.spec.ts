import { expect, test } from '@playwright/test';
import { createBackgroundSite } from '../fixtures/site-background';

let site: Awaited<ReturnType<typeof createBackgroundSite>>;

test.beforeAll(async () => {
    test.setTimeout(120_000);
    site = await createBackgroundSite({
        background: {
            wallpapers: [
                { id: 'forest', image: '/images/forest.svg' },
                { id: 'sea', image: '/images/mist.svg' },
            ],
        },
        hero: {
            size: 'full',
            default: {
                showTitle: false,
                title: 'Hidden notebook',
                subtitle: 'This subtitle is also hidden',
                position: 'bottom-left',
            },
            byWallpaper: {
                sea: {
                    showTitle: true,
                    title: 'Visible notebook',
                    subtitle: 'A visible subtitle',
                    position: 'top-right',
                },
            },
        },
    });
});

test.afterAll(async () => site?.close());

test('refresh switches the entire title area while preserving the full Hero height', async ({
    page,
}) => {
    await page.addInitScript(() => {
        Math.random = () => (window.name === 'sea' ? 0.999 : 0);
    });
    await page.goto(site.origin);
    const content = page.locator('.home-hero-content');
    await expect(content).toBeHidden();
    await expect(page.locator('.home-hero-title')).toBeHidden();
    await expect(page.locator('.home-hero-subtitle')).toBeHidden();
    const hero = page.locator('.home-hero');
    await expect(hero).toBeVisible();
    expect((await hero.boundingBox())!.height).toBeGreaterThanOrEqual(900);

    await page.evaluate(() => {
        window.name = 'sea';
    });
    await page.reload();
    await expect(content).toBeVisible();
    await expect(page.locator('.home-hero-title')).toHaveText(
        'Visible notebook',
    );
    await expect(page.locator('.home-hero-subtitle')).toBeVisible();
    await page.evaluate(() => {
        window.name = 'forest';
    });
    await page.reload();
    await expect(content).toBeHidden();
});

test('returning home synchronizes visibility before the persistent wallpaper page is swapped', async ({
    page,
}) => {
    await page.addInitScript(() => {
        Math.random = () => 0.999;
        (window as Window & { titleVisibility?: boolean[] }).titleVisibility =
            [];
    });
    await page.goto(`${site.origin}/archives/`);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await page.evaluate(() => {
        document.addEventListener('astro:before-swap', (event) => {
            const transition = event as Event & {
                newDocument: Document;
                swap: () => void;
            };
            const swap = transition.swap;
            transition.swap = () => {
                const title =
                    transition.newDocument.querySelector<HTMLElement>(
                        '.home-hero-content',
                    );
                if (title)
                    (
                        window as Window & { titleVisibility?: boolean[] }
                    ).titleVisibility?.push(title.hasAttribute('hidden'));
                swap();
            };
        });
    });
    await page
        .getByRole('link', { name: 'Sky Blog 首页', exact: true })
        .click();
    await expect(page).toHaveURL(`${site.origin}/`);
    await expect(page.locator('.home-hero-content')).toBeVisible();
    expect(
        await page.evaluate(
            () =>
                (window as Window & { titleVisibility?: boolean[] })
                    .titleVisibility,
        ),
    ).toEqual([false]);
    await page.goBack();
    await expect(page).toHaveURL(`${site.origin}/archives/`);
    await page.goForward();
    await expect(page.locator('.home-hero-content')).toBeVisible();
});

test('without JavaScript the first wallpaper keeps both title lines hidden and retains the Hero', async ({
    browser,
}) => {
    const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 1280, height: 900 },
    });
    try {
        const page = await context.newPage();
        await page.goto(site.origin);
        await expect(page.locator('.home-hero-content')).toBeHidden();
        await expect(page.locator('.home-hero-title')).toBeHidden();
        await expect(page.locator('.home-hero-subtitle')).toBeHidden();
        expect(
            (await page.locator('.home-hero').boundingBox())!.height,
        ).toBeGreaterThanOrEqual(900);
    } finally {
        await context.close();
    }
});
