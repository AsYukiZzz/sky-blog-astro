import { expect, test } from '@playwright/test';
import type { HeroPosition, HomeHeroConfig } from '../../src/types/config';
import { createBackgroundSite } from '../fixtures/site-background';

const firstImage = '/images/forest.svg?wallpaper=first';
const lastImage = '/images/mist.svg?wallpaper=last';
const wallpapers = [
    { id: 'forest', image: firstImage },
    { id: 'sea', image: lastImage },
];
const hero: HomeHeroConfig = {
    size: 'full',
    default: {
        title: 'Default notebook',
        subtitle: '',
        position: 'bottom-left',
    },
    byWallpaper: {
        sea: {
            title: 'Sea <b> & "notes"',
            subtitle: 'A calm horizon',
            position: 'top-right',
        },
    },
};
let site: Awaited<ReturnType<typeof createBackgroundSite>>;

test.beforeAll(async () => {
    test.setTimeout(120_000);
    site = await createBackgroundSite({ background: { wallpapers }, hero });
});
test.afterAll(async () => site?.close());

test('refresh selects a wallpaper again, matches its Hero, and allows repeated choices', async ({
    page,
}) => {
    await page.addInitScript(() => {
        Math.random = () => (window.name === 'first' ? 0 : 0.999);
    });
    await page.goto(site.origin);
    const background = page.locator('[data-site-background]');
    const heading = page.locator('.home-hero-title');
    await expect(background).toHaveAttribute('data-wallpaper-id', 'sea');
    await expect(background.locator('img')).toHaveAttribute('src', lastImage);
    await expect(heading).toHaveText('Sea <b> & "notes"');
    await expect(heading.locator('b')).toHaveCount(0);
    await expect(page.locator('.home-hero-subtitle')).toBeVisible();
    await expect(page.locator('.home-hero')).toHaveAttribute(
        'data-hero-position',
        'top-right',
    );

    await page.evaluate(() => {
        window.name = 'first';
    });
    await page.reload();
    await expect(background).toHaveAttribute('data-wallpaper-id', 'forest');
    await expect(heading).toHaveText('Default notebook');
    await expect(page.locator('.home-hero-subtitle')).toBeHidden();
    await page.evaluate(() => {
        window.name = 'last';
    });
    await page.reload();
    await expect(heading).toHaveText('Sea <b> & "notes"');
    await page.reload();
    await expect(background).toHaveAttribute('data-wallpaper-id', 'sea');
    await expect(heading).toHaveText('Sea <b> & "notes"');
});

test('client navigation from another page matches the persistent wallpaper before swapping home', async ({
    page,
}) => {
    await page.addInitScript(() => {
        Math.random = () => 0.999;
        const observed = window as Window & { heroSwaps?: string[] };
        observed.heroSwaps = [];
        document.addEventListener('astro:before-swap', (event) => {
            const transition = event as Event & {
                newDocument: Document;
                swap: () => void;
            };
            const swap = transition.swap;
            transition.swap = () => {
                const heading =
                    transition.newDocument.querySelector('.home-hero-title');
                if (heading)
                    observed.heroSwaps?.push(heading.textContent ?? '');
                swap();
            };
        });
    });
    await page.goto(`${site.origin}/archives/`);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await page.locator('[data-site-background]').evaluate((node) => {
        (node as HTMLElement).dataset.instance = 'original';
    });
    await page.locator('.site-nav [data-theme-toggle]').click();
    await page
        .getByRole('link', { name: 'Sky Blog 首页', exact: true })
        .click();
    await expect(page).toHaveURL(`${site.origin}/`);
    await expect(page.locator('.home-hero-title')).toHaveText(
        'Sea <b> & "notes"',
    );
    await expect(page.locator('html')).toHaveAttribute(
        'data-color-scheme',
        'dark',
    );
    await page.goBack();
    await expect(page).toHaveURL(`${site.origin}/archives/`);
    await page.goForward();
    await expect(page).toHaveURL(`${site.origin}/`);
    await expect(page.locator('[data-site-background]')).toHaveAttribute(
        'data-instance',
        'original',
    );
    await expect(page.locator('[data-site-background]')).toHaveAttribute(
        'data-wallpaper-id',
        'sea',
    );
    await expect(page.locator('.home-hero-title')).toHaveText(
        'Sea <b> & "notes"',
    );
    expect(
        await page.evaluate(
            () => (window as Window & { heroSwaps?: string[] }).heroSwaps,
        ),
    ).toEqual(['Sea <b> & "notes"', 'Sea <b> & "notes"']);
});

test('initial loading waits for the randomly selected image rather than the SSR first image', async ({
    page,
}) => {
    await page.addInitScript(() => {
        Math.random = () => 0.999;
    });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    await page.route(`${site.origin}${lastImage}`, async (route) => {
        await gate;
        await route.continue();
    });
    try {
        await page.goto(site.origin, { waitUntil: 'domcontentloaded' });
        const layer = page.locator('[data-page-loading]');
        await expect(page.locator('[data-site-wallpaper]')).toHaveAttribute(
            'src',
            lastImage,
        );
        await page.waitForTimeout(250);
        await expect(layer).toBeVisible();
        expect(
            await page
                .locator('[data-site-wallpaper]')
                .evaluate((img: HTMLImageElement) => img.naturalWidth),
        ).toBe(0);
        release();
        await expect(layer).toBeHidden();
        await expect(page.locator('[data-site-wallpaper]')).toHaveCSS(
            'opacity',
            '1',
        );
        await expect(page.locator('.home-hero-title')).toHaveText(
            'Sea <b> & "notes"',
        );
    } finally {
        release();
    }
});

test('a failed selected image retains its Hero and reveals the theme background', async ({
    page,
}) => {
    await page.addInitScript(() => {
        Math.random = () => 0.999;
    });
    await page.route(`${site.origin}${lastImage}`, (route) =>
        route.fulfill({ status: 404, body: '' }),
    );
    await page.goto(site.origin);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await expect(page.locator('[data-site-background]')).toHaveAttribute(
        'data-wallpaper-id',
        'sea',
    );
    await expect(page.locator('[data-site-wallpaper]')).toHaveCSS(
        'opacity',
        '0',
    );
    await expect(page.locator('.home-hero-title')).toHaveText(
        'Sea <b> & "notes"',
    );
    await expect(page.locator('.home-hero')).toHaveAttribute(
        'data-hero-position',
        'top-right',
    );
    await expect(page.locator('main')).not.toHaveAttribute('inert');
});

for (const loading of [
    { strategy: 'content' as const, maxWait: 3000 },
    { strategy: 'wallpaper' as const, maxWait: 400 },
]) {
    test(`${loading.strategy}/${loading.maxWait} releases a slow selected wallpaper and restores it later`, async ({
        page,
    }) => {
        test.setTimeout(120_000);
        const slow = await createBackgroundSite({
            background: { wallpapers },
            hero,
            loading,
        });
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        try {
            await page.addInitScript(() => {
                Math.random = () => 0.999;
            });
            await page.route(`${slow.origin}${lastImage}`, async (route) => {
                await gate;
                await route.continue();
            });
            await page.goto(slow.origin, { waitUntil: 'domcontentloaded' });
            await expect(page.locator('[data-page-loading]')).toBeHidden({
                timeout: 1400,
            });
            await expect(page.locator('[data-site-wallpaper]')).toHaveAttribute(
                'src',
                lastImage,
            );
            await expect(page.locator('[data-site-wallpaper]')).toHaveCSS(
                'opacity',
                '0',
            );
            await expect(page.locator('.home-hero-title')).toHaveText(
                'Sea <b> & "notes"',
            );
            release();
            await expect(page.locator('[data-site-wallpaper]')).toHaveCSS(
                'opacity',
                '1',
            );
        } finally {
            release();
            await slow.close();
        }
    });
}

for (const background of [
    { type: 'solid' as const, wallpapers },
    { type: 'image' as const, wallpapers: [] },
]) {
    test(`${background.type} with ${background.wallpapers.length} candidates uses the required default Hero`, async ({
        page,
    }) => {
        test.setTimeout(120_000);
        const fallback = await createBackgroundSite({
            background,
            hero: { ...hero, byWallpaper: {} },
        });
        try {
            const requests: string[] = [];
            page.on('request', (request) => {
                if (request.url().includes('wallpaper='))
                    requests.push(request.url());
            });
            await page.goto(fallback.origin);
            await expect(page.locator('[data-site-wallpaper]')).toHaveCount(0);
            await expect(page.locator('.home-hero-title')).toHaveText(
                'Default notebook',
            );
            await expect(page.locator('.home-hero-subtitle')).toBeHidden();
            expect(requests).toEqual([]);
        } finally {
            await fallback.close();
        }
    });
}

test.describe('the seven Hero positions', () => {
    const positions: HeroPosition[] = [
        'top-left',
        'bottom-left',
        'top-right',
        'bottom-right',
        'top-center',
        'bottom-center',
        'center',
    ];
    let positioned: Awaited<ReturnType<typeof createBackgroundSite>>;
    test.beforeAll(async () => {
        test.setTimeout(120_000);
        positioned = await createBackgroundSite({
            background: {
                wallpapers: positions.map((id) => ({
                    id,
                    image: `/images/forest.svg?position=${id}`,
                })),
            },
            hero: {
                size: 'full',
                default: {
                    title: 'Fallback',
                    subtitle: '',
                    position: 'bottom-left',
                },
                byWallpaper: Object.fromEntries(
                    positions.map((position) => [
                        position,
                        {
                            title: 'Sky',
                            subtitle: `${position} note`,
                            position,
                        },
                    ]),
                ),
            },
        });
    });
    test.afterAll(async () => positioned?.close());

    for (const [index, position] of positions.entries()) {
        test(`${position} aligns the whole text group on desktop and mobile`, async ({
            page,
        }) => {
            await page.addInitScript(
                (sample) => {
                    Math.random = () => sample;
                },
                (index + 0.1) / 7,
            );
            for (const width of [375, 600, 768, 1440, 1920]) {
                await page.setViewportSize({ width, height: 900 });
                await page.goto(positioned.origin);
                await page.evaluate(() => document.fonts.ready);
                const region = page.locator('.home-hero');
                await expect(region).toHaveAttribute(
                    'data-hero-position',
                    position,
                );
                const bounds = (await page
                    .locator('.home-hero-content')
                    .boundingBox())!;
                const cards = (await page
                    .locator('.home-card-grid')
                    .boundingBox())!;
                if (position.endsWith('left'))
                    expect(bounds.x).toBeCloseTo(cards.x, 0);
                else if (position.endsWith('right'))
                    expect(bounds.x + bounds.width).toBeCloseTo(
                        cards.x + cards.width,
                        0,
                    );
                else
                    expect(bounds.x + bounds.width / 2).toBeCloseTo(
                        width / 2,
                        0,
                    );
                if (position.startsWith('top-'))
                    expect(bounds.y).toBeCloseTo(112, 0);
                else if (position.startsWith('bottom-'))
                    expect(bounds.y + bounds.height).toBeCloseTo(876, 0);
                else expect(bounds.y + bounds.height / 2).toBeCloseTo(494, 0);
                await expect(region).toHaveCSS(
                    'text-align',
                    position.endsWith('left')
                        ? 'left'
                        : position.endsWith('right')
                          ? 'right'
                          : 'center',
                );
                expect(
                    await page.evaluate(
                        () =>
                            document.documentElement.scrollWidth <= innerWidth,
                    ),
                ).toBe(true);
            }
        });
    }

    test('without JavaScript the first wallpaper and its mapped Hero render together', async ({
        browser,
    }) => {
        const context = await browser.newContext({ javaScriptEnabled: false });
        try {
            const page = await context.newPage();
            await page.goto(positioned.origin);
            await expect(
                page.locator('[data-site-background]'),
            ).toHaveAttribute('data-wallpaper-id', 'top-left');
            await expect(page.locator('.home-hero-title')).toHaveText('Sky');
            await expect(page.locator('.home-hero')).toHaveAttribute(
                'data-hero-position',
                'top-left',
            );
            await expect(page.locator('.home-hero-subtitle')).toHaveText(
                'top-left note',
            );
        } finally {
            await context.close();
        }
    });
});

test('long compact titles remain below navigation and inside right and center layouts', async ({
    page,
}) => {
    test.setTimeout(120_000);
    const positions: HeroPosition[] = ['top-right', 'bottom-right', 'center'];
    const long = await createBackgroundSite({
        background: {
            wallpapers: positions.map((id) => ({
                id,
                image: '/images/forest.svg',
            })),
        },
        hero: {
            size: 'compact',
            default: {
                title: 'Fallback',
                subtitle: '',
                position: 'bottom-left',
            },
            byWallpaper: Object.fromEntries(
                positions.map((position) => [
                    position,
                    {
                        title: '记录生活与思考 A Wandering Notebook '.repeat(6),
                        subtitle: '在风景中记录日常',
                        position,
                    },
                ]),
            ),
        },
    });
    try {
        await page.addInitScript(() => {
            Math.random = () => Number(window.name || '0');
        });
        await page.setViewportSize({ width: 375, height: 500 });
        for (const sample of [0, 0.4, 0.8]) {
            await page.goto(long.origin);
            await page.evaluate((value) => {
                window.name = String(value);
            }, sample);
            await page.reload();
            const heading = (await page
                .locator('.home-hero-title')
                .boundingBox())!;
            const region = (await page.locator('.home-hero').boundingBox())!;
            const subtitle = (await page
                .locator('.home-hero-subtitle')
                .boundingBox())!;
            const cards = (await page
                .locator('.home-card-grid')
                .boundingBox())!;
            expect(heading.y).toBeGreaterThanOrEqual(64);
            expect(heading.x).toBeGreaterThanOrEqual(cards.x - 1);
            expect(heading.x + heading.width).toBeLessThanOrEqual(
                cards.x + cards.width + 1,
            );
            expect(heading.y + heading.height).toBeLessThan(subtitle.y);
            expect(subtitle.y + subtitle.height).toBeLessThanOrEqual(
                region.y + region.height - 23,
            );
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth,
                ),
            ).toBe(true);
        }
    } finally {
        await long.close();
    }
});
