import { expect, test } from '@playwright/test';
import type { HomeHeroConfig, WallpaperConfig } from '../../src/types/config';
import { createBackgroundSite } from '../fixtures/site-background';

const firstImage = '/images/forest.svg?wallpaper-info=first';
const secondImage = '/images/mist.svg?wallpaper-info=second';
const firstAuthor = '山间 <b> & "雾"';
const firstPublication = 'https://www.pixiv.net/artworks/456?lang=zh&mode=full';
const secondPublication = 'https://weibo.com/artist/sea';
const links = {
    x: 'https://x.com/artist',
    weibo: 'https://weibo.com/artist',
    pixiv: 'https://www.pixiv.net/users/123',
};
type WallpaperSnapshotWindow = Window & {
    wallpaperSwaps?: Array<{ name: string; url: string | null }>;
};
const wallpapers: WallpaperConfig[] = [
    {
        id: 'forest',
        image: firstImage,
        author: { name: firstAuthor, url: firstPublication, links },
    },
    {
        id: 'sea',
        image: secondImage,
        author: {
            name: '海边画师',
            url: secondPublication,
            links: { x: links.x, weibo: links.weibo },
        },
    },
    { id: 'unknown', image: '/images/forest.svg?unknown' },
    {
        id: 'disabled',
        image: '/images/forest.svg?disabled',
        author: { name: '隐藏的作者', links: { pixiv: links.pixiv } },
    },
    {
        id: 'name-only',
        image: '/images/mist.svg?name-only',
        author: { name: '仅署名的作者' },
    },
    {
        id: 'long',
        image: '/images/forest.svg?long',
        author: { name: '名字较长的画师 Artist '.repeat(12), links },
    },
];
const hero: HomeHeroConfig = {
    size: 'full',
    default: {
        title: 'Sky',
        subtitle: 'Wallpaper notebook',
        position: 'top-right',
        showAuthor: true,
        authorPosition: 'bottom-left',
    },
    byWallpaper: {
        sea: {
            title: 'Sea',
            subtitle: 'A calm horizon',
            position: 'bottom-right',
            authorPosition: 'bottom-right',
        },
        disabled: {
            title: 'Title remains visible',
            subtitle: '',
            position: 'top-left',
            showAuthor: false,
            authorPosition: 'bottom-right',
        },
        'name-only': {
            showTitle: false,
            title: 'Hidden title',
            subtitle: '',
            position: 'top-left',
            authorPosition: 'bottom-right',
        },
        long: {
            title: '记录生活与思考 A Wandering Notebook '.repeat(3),
            subtitle: '记录生活，分享思考',
            position: 'bottom-left',
            authorPosition: 'bottom-left',
        },
    },
};
let site: Awaited<ReturnType<typeof createBackgroundSite>>;
let compact: Awaited<ReturnType<typeof createBackgroundSite>>;
let solid: Awaited<ReturnType<typeof createBackgroundSite>>;

test.beforeAll(async () => {
    test.setTimeout(120_000);
    site = await createBackgroundSite({ background: { wallpapers }, hero });
    compact = await createBackgroundSite({
        background: { wallpapers },
        hero: { ...hero, size: 'compact' },
    });
    solid = await createBackgroundSite({
        background: { type: 'solid', wallpapers },
        hero,
    });
});
test.afterAll(async () => {
    await Promise.all([site?.close(), compact?.close(), solid?.close()]);
});

test('the plain author text opens wallpaper details and ordered source links on click', async ({
    page,
}) => {
    await page.addInitScript(() => {
        Math.random = () => 0;
    });
    await page.goto(site.origin);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    const trigger = page.getByRole('button', { name: /壁纸作者/ });
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText(firstAuthor);
    await expect(trigger.locator('b, svg')).toHaveCount(0);
    await expect(page.locator('.home-hero').getByRole('link')).toHaveCount(0);
    for (const scheme of ['light', 'dark']) {
        if (scheme === 'dark')
            await page.locator('.site-nav [data-theme-toggle]').click();
        await expect(trigger).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        await expect(trigger).toHaveCSS('backdrop-filter', 'none');
        await expect(trigger).toHaveCSS('box-shadow', 'none');
        await expect(trigger).toHaveCSS('border-top-width', '0px');
        await page.mouse.move(0, 0);
        const name = trigger.locator('.home-hero-author-name');
        const prefix = trigger.locator('.home-hero-author-prefix');
        const idleColor = await name.evaluate(
            (element) => getComputedStyle(element).color,
        );
        const prefixColor = await prefix.evaluate(
            (element) => getComputedStyle(element).color,
        );
        const idleBounds = await trigger.boundingBox();
        await expect(name).toHaveCSS('text-decoration-line', 'none');
        await trigger.hover();
        expect(
            await name.evaluate((element) => getComputedStyle(element).color),
        ).not.toBe(idleColor);
        await expect(name).toHaveCSS('text-decoration-line', 'none');
        await expect(trigger).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        await expect(prefix).toHaveCSS('color', prefixColor);
        expect(await trigger.boundingBox()).toEqual(idleBounds);
    }
    await trigger.click();
    const panel = page.getByRole('dialog', { name: '壁纸信息', exact: true });
    await expect(panel).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(panel.locator('[data-wallpaper-author-name]')).toHaveText(
        firstAuthor,
    );
    await expect(panel.locator('[data-wallpaper-author-name] b')).toHaveCount(
        0,
    );
    await expect(
        panel.getByRole('img', { name: '当前壁纸预览' }),
    ).toHaveAttribute('src', firstImage);
    const publication = panel.getByRole('link', {
        name: '查看壁纸发布页',
        exact: true,
    });
    await expect(publication).toHaveAttribute('href', firstPublication);
    await expect(publication).toHaveAttribute('target', '_blank');
    await expect(publication).toHaveAttribute('rel', /noopener noreferrer/);
    expect(
        await panel
            .locator('[data-wallpaper-sources]')
            .getByRole('link')
            .evaluateAll((items) =>
                items.map((item) => item.getAttribute('aria-label')),
            ),
    ).toEqual(['Pixiv', 'Weibo', 'X']);
    for (const [label, href] of [
        ['Pixiv', links.pixiv],
        ['Weibo', links.weibo],
        ['X', links.x],
    ]) {
        const link = panel.getByRole('link', { name: label, exact: true });
        await expect(link).toHaveAttribute('href', href);
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', /noopener/);
    }
    await trigger.click();
    await expect(panel).toBeHidden();
    await trigger.click();
    await expect(panel).toBeVisible();
    await page.locator('.home-hero-title').click();
    await expect(panel).toBeHidden();
    await trigger.click();
    await page
        .getByRole('button', { name: '关闭壁纸信息', exact: true })
        .click();
    await expect(panel).toBeHidden();
});

test('keyboard activation, tab order and Escape return focus to the author entry', async ({
    page,
}) => {
    await page.addInitScript(() => {
        Math.random = () => 0;
    });
    await page.goto(site.origin);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    const trigger = page.getByRole('button', { name: /壁纸作者/ });
    await trigger.focus();
    await expect(trigger).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('Enter');
    await expect(
        page.getByRole('dialog', { name: '壁纸信息', exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(
        page.getByRole('button', { name: '关闭壁纸信息', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-wallpaper-info]')).toBeHidden();
    await expect(trigger).toBeFocused();
    await page.keyboard.press('Space');
    await expect(
        page.getByRole('dialog', { name: '壁纸信息', exact: true }),
    ).toBeVisible();
});

for (const [index, position] of [
    [0, 'bottom-left'],
    [1, 'bottom-right'],
] as const) {
    test(`${position} author aligns with cards while the popup stays centered`, async ({
        page,
    }) => {
        await page.addInitScript(
            (sample) => {
                Math.random = () => sample;
            },
            (index + 0.1) / wallpapers.length,
        );
        for (const width of [320, 600, 768, 1440, 1920]) {
            await page.setViewportSize({ width, height: 900 });
            await page.goto(site.origin);
            await expect(page.locator('[data-page-loading]')).toBeHidden();
            await page.evaluate(() => document.fonts.ready);
            const trigger = page.getByRole('button', { name: /壁纸作者/ });
            const bounds = (await trigger.boundingBox())!;
            const cards = (await page
                .locator('.home-card-grid')
                .boundingBox())!;
            const title = (await page
                .locator('.home-hero-content')
                .boundingBox())!;
            if (position === 'bottom-left')
                expect(bounds.x).toBeCloseTo(cards.x, 0);
            else
                expect(bounds.x + bounds.width).toBeCloseTo(
                    cards.x + cards.width,
                    0,
                );
            expect(title.y + title.height).toBeLessThanOrEqual(bounds.y - 12);
            await trigger.click();
            const panel = page.getByRole('dialog', {
                name: '壁纸信息',
                exact: true,
            });
            await expect(panel).toBeVisible();
            const card = (await panel.boundingBox())!;
            expect(card.x).toBeGreaterThanOrEqual(15.5);
            expect(card.y).toBeGreaterThanOrEqual(15.5);
            expect(card.x + card.width).toBeLessThanOrEqual(width - 15.5);
            expect(card.y + card.height).toBeLessThanOrEqual(884.5);
            expect(card.x + card.width / 2).toBeCloseTo(width / 2, 0);
            expect(card.y + card.height / 2).toBeCloseTo(450, 0);
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth,
                ),
            ).toBe(true);
        }
    });
}

test('popup details track the persistent wallpaper before home is swapped and close on history navigation', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
        Math.random = () => 1.1 / 6;
        (window as WallpaperSnapshotWindow).wallpaperSwaps = [];
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
                const name = transition.newDocument.querySelector(
                    '[data-wallpaper-author-name]',
                );
                if (name)
                    (window as WallpaperSnapshotWindow).wallpaperSwaps?.push({
                        name: name.textContent ?? '',
                        url:
                            transition.newDocument
                                .querySelector('[data-wallpaper-url]')
                                ?.getAttribute('href') ?? null,
                    });
                swap();
            };
        });
    });
    await page
        .getByRole('link', { name: 'Sky Blog 首页', exact: true })
        .click();
    const trigger = page.getByRole('button', { name: /壁纸作者/ });
    await expect(trigger).toContainText('海边画师');
    expect(
        await page.evaluate(
            () => (window as WallpaperSnapshotWindow).wallpaperSwaps,
        ),
    ).toEqual([{ name: '海边画师', url: secondPublication }]);
    await trigger.click();
    await expect(
        page.getByRole('dialog', { name: '壁纸信息', exact: true }),
    ).toBeVisible();
    await expect(page.locator('[data-wallpaper-info-image]')).toHaveAttribute(
        'src',
        secondImage,
    );
    await expect(
        page.getByRole('link', { name: '查看壁纸发布页', exact: true }),
    ).toHaveAttribute('href', secondPublication);
    await page.goBack();
    await expect(page).toHaveURL(`${site.origin}/archives/`);
    await expect(
        page.locator('[data-wallpaper-info]:popover-open'),
    ).toHaveCount(0);
    await page.goForward();
    await expect(trigger).toContainText('海边画师');
    await expect(page.locator('[data-wallpaper-info]')).toBeHidden();
    await trigger.click();
    await expect(
        page.getByRole('dialog', { name: '壁纸信息', exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-wallpaper-info]')).toBeHidden();
    expect(errors).toEqual([]);
});

test('refresh updates the trigger, preview and configured platforms without stale author details', async ({
    page,
}) => {
    await page.addInitScript((count) => {
        Math.random = () => (Number(window.name || '0') + 0.1) / count;
    }, wallpapers.length);
    await page.goto(site.origin);
    const trigger = page.getByRole('button', { name: /壁纸作者/ });
    await expect(trigger).toContainText(firstAuthor);
    await trigger.click();
    await page.evaluate(() => {
        window.name = '1';
    });
    await page.reload();
    await expect(trigger).toContainText('海边画师');
    await expect(page.locator('[data-wallpaper-info]')).toBeHidden();
    await trigger.click();
    const panel = page.getByRole('dialog', { name: '壁纸信息', exact: true });
    await expect(
        panel.getByRole('link', { name: '查看壁纸发布页', exact: true }),
    ).toHaveAttribute('href', secondPublication);
    expect(
        await panel
            .locator('[data-wallpaper-sources]')
            .getByRole('link')
            .evaluateAll((items) =>
                items.map((item) => item.getAttribute('aria-label')),
            ),
    ).toEqual(['Weibo', 'X']);
    await expect(
        panel.getByRole('img', { name: '当前壁纸预览' }),
    ).toHaveAttribute('src', secondImage);
    await page.evaluate(() => {
        window.name = '2';
    });
    await page.reload();
    await expect(trigger).toHaveCount(0);
    await expect(page.locator('[data-wallpaper-info]')).toBeHidden();
    await expect(page.locator('[data-wallpaper-url]')).toBeHidden();
    await expect(page.locator('[data-wallpaper-url]')).not.toHaveAttribute(
        'href',
    );
});

test('an author-only entry remains usable when titles are hidden and no sources are configured', async ({
    page,
}) => {
    await page.addInitScript(() => {
        Math.random = () => 4.1 / 6;
    });
    await page.goto(site.origin);
    await expect(page.locator('.home-hero-content')).toBeHidden();
    await page.getByRole('button', { name: /壁纸作者/ }).click();
    const panel = page.getByRole('dialog', { name: '壁纸信息', exact: true });
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-wallpaper-author-name]')).toHaveText(
        '仅署名的作者',
    );
    await expect(panel.getByRole('link')).toHaveCount(0);
    await expect(panel.locator('[data-wallpaper-sources]')).toBeHidden();
    await expect(panel.locator('[data-wallpaper-url]')).toBeHidden();
    await expect(panel.locator('[data-wallpaper-url]')).not.toHaveAttribute(
        'href',
    );
});

test('showAuthor and solid backgrounds suppress the trigger and its popup', async ({
    page,
}) => {
    await page.addInitScript(() => {
        Math.random = () => 3.1 / 6;
    });
    await page.goto(site.origin);
    await expect(page.getByRole('button', { name: /壁纸作者/ })).toHaveCount(0);
    await expect(page.locator('.home-hero-title')).toBeVisible();
    await page.goto(solid.origin);
    await expect(page.getByRole('button', { name: /壁纸作者/ })).toHaveCount(0);
    await expect(page.locator('[data-wallpaper-info]')).toBeHidden();
});

test('a closed popup never downloads an unselected SSR wallpaper preview', async ({
    page,
}) => {
    const requests: string[] = [];
    page.on('request', (request) => {
        if (request.url().includes('wallpaper-info='))
            requests.push(request.url());
    });
    await page.addInitScript(() => {
        Math.random = () => 1.1 / 6;
    });
    await page.goto(site.origin);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    expect(requests.some((url) => url.includes('wallpaper-info=first'))).toBe(
        false,
    );
    await page.getByRole('button', { name: /壁纸作者/ }).click();
    const preview = page.getByRole('img', { name: '当前壁纸预览' });
    await expect(preview).toHaveAttribute('src', secondImage);
    await expect
        .poll(() =>
            preview.evaluate((image: HTMLImageElement) => image.naturalWidth),
        )
        .toBeGreaterThan(0);
    expect(requests.some((url) => url.includes('wallpaper-info=first'))).toBe(
        false,
    );
});

test('the first wallpaper details remain clickable with JavaScript disabled', async ({
    browser,
}) => {
    const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 375, height: 800 },
    });
    try {
        const page = await context.newPage();
        await page.goto(site.origin);
        const trigger = page.getByRole('button', { name: /壁纸作者/ });
        await expect(trigger).toContainText(firstAuthor);
        await trigger.click();
        const panel = page.getByRole('dialog', {
            name: '壁纸信息',
            exact: true,
        });
        await expect(panel).toBeVisible();
        await expect(
            panel.getByRole('img', { name: '当前壁纸预览' }),
        ).toHaveAttribute('src', firstImage);
        await expect(
            panel.locator('[data-wallpaper-sources]').getByRole('link'),
        ).toHaveCount(3);
        await expect(
            panel.getByRole('link', { name: '查看壁纸发布页', exact: true }),
        ).toHaveAttribute('href', firstPublication);
        const centered = (await panel.boundingBox())!;
        expect(centered.x + centered.width / 2).toBeCloseTo(187.5, 0);
        expect(centered.y + centered.height / 2).toBeCloseTo(400, 0);
        await page.keyboard.press('Escape');
        await expect(panel).toBeHidden();
    } finally {
        await context.close();
    }
});

test('short viewports keep the popup inside the screen and scrollable', async ({
    page,
}) => {
    await page.addInitScript(() => {
        Math.random = () => 0;
    });
    for (const height of [320, 240]) {
        await page.setViewportSize({ width: 320, height });
        await page.goto(compact.origin);
        await page.getByRole('button', { name: /壁纸作者/ }).click();
        const panel = page.getByRole('dialog', {
            name: '壁纸信息',
            exact: true,
        });
        await expect(panel).toBeVisible();
        const bounds = (await panel.boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(15.5);
        expect(bounds.y).toBeGreaterThanOrEqual(15.5);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(304.5);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(height - 15.5);
        expect(bounds.x + bounds.width / 2).toBeCloseTo(160, 0);
        expect(bounds.y + bounds.height / 2).toBeCloseTo(height / 2, 0);
        const pageScroll = await page.evaluate(() => scrollY);
        await panel.evaluate((element) => {
            element.scrollTop = 32;
        });
        await expect
            .poll(() => panel.evaluate((element) => element.scrollTop))
            .toBeGreaterThan(0);
        await expect(panel).toBeVisible();
        expect(await page.evaluate(() => scrollY)).toBe(pageScroll);
    }
});

test('a one-pixel page scroll closes the popup immediately without locking page scrolling', async ({
    page,
}) => {
    await page.addInitScript(() => {
        Math.random = () => 0;
    });
    await page.setViewportSize({ width: 375, height: 500 });
    await page.goto(site.origin);
    await page.getByRole('button', { name: /壁纸作者/ }).click();
    const panel = page.getByRole('dialog', { name: '壁纸信息', exact: true });
    await expect(panel).toBeVisible();
    const openAtScrollEnd = await page.evaluate(
        () =>
            new Promise<boolean>((resolve) => {
                document.addEventListener(
                    'scroll',
                    () =>
                        resolve(
                            document
                                .querySelector('[data-wallpaper-info]')!
                                .matches(':popover-open'),
                        ),
                    { once: true },
                );
                scrollTo({ top: scrollY + 1, behavior: 'instant' });
            }),
    );
    expect(openAtScrollEnd).toBe(false);
    await expect(panel).toBeHidden();
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
    await expect(
        page.getByRole('button', { name: /壁纸作者/ }),
    ).toHaveAttribute('aria-expanded', 'false');
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.getByRole('button', { name: /壁纸作者/ }).click();
    await page.setViewportSize({ width: 600, height: 700 });
    await expect(panel).toBeVisible();
    await expect
        .poll(async () => {
            const box = (await panel.boundingBox())!;
            return [
                Math.round(box.x + box.width / 2),
                Math.round(box.y + box.height / 2),
            ];
        })
        .toEqual([300, 350]);
});

test('opening after a queued page scroll stays open until another actual scroll', async ({
    page,
}) => {
    await page.addInitScript(() => {
        Math.random = () => 0;
    });
    await page.setViewportSize({ width: 375, height: 500 });
    await page.goto(site.origin);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    const opened = await page.evaluate(() => {
        scrollTo({ top: 1, behavior: 'instant' });
        document
            .querySelector<HTMLButtonElement>('[data-wallpaper-author-toggle]')!
            .click();
        return document
            .querySelector('[data-wallpaper-info]')!
            .matches(':popover-open');
    });
    expect(opened).toBe(true);
    await page.evaluate(
        () =>
            new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
    );
    await expect(
        page.getByRole('dialog', { name: '壁纸信息', exact: true }),
    ).toBeVisible();
    await page.evaluate(() => scrollTo({ top: 2, behavior: 'instant' }));
    await expect(page.locator('[data-wallpaper-info]')).toBeHidden();
});

for (const scheme of ['light', 'dark'] as const) {
    test(`popup motion animates entry and exit in the ${scheme} theme`, async ({
        page,
    }) => {
        await page.emulateMedia({
            reducedMotion: 'no-preference',
            colorScheme: scheme,
        });
        await page.addInitScript((value) => {
            Math.random = () => 0;
            localStorage.setItem('sky-theme', value);
        }, scheme);
        await page.goto(site.origin);
        await expect(page.locator('[data-page-loading]')).toBeHidden();
        const samples = await page.evaluate(async () => {
            const panel = document.querySelector<HTMLElement>(
                '[data-wallpaper-info]',
            )!;
            const trigger = document.querySelector<HTMLButtonElement>(
                '[data-wallpaper-author-toggle]',
            )!;
            const sample = () => {
                const animations = panel.getAnimations();
                const fade = animations.find(
                    (animation) =>
                        animation instanceof CSSTransition &&
                        animation.transitionProperty === 'opacity',
                );
                if (!fade) return null;
                for (const animation of animations) {
                    animation.pause();
                    animation.currentTime =
                        Number(animation.effect!.getTiming().duration) / 2;
                }
                const style = getComputedStyle(panel);
                const value = {
                    opacity: Number(style.opacity),
                    scale: Number(style.scale),
                    translate: style.translate,
                    display: style.display,
                    pointerEvents: style.pointerEvents,
                    inert: panel.inert,
                    duration: Number(fade.effect!.getTiming().duration),
                };
                animations.forEach((animation) => animation.finish());
                return value;
            };
            trigger.click();
            const entry = sample();
            await new Promise(requestAnimationFrame);
            panel
                .querySelector<HTMLButtonElement>('.wallpaper-info-close')!
                .click();
            const exit = sample();
            await new Promise(requestAnimationFrame);
            return {
                entry,
                exit,
                closed: !panel.matches(':popover-open'),
                display: getComputedStyle(panel).display,
            };
        });
        expect(samples.entry).not.toBeNull();
        expect(samples.exit).not.toBeNull();
        for (const sample of [samples.entry!, samples.exit!]) {
            expect(sample.opacity).toBeGreaterThan(0);
            expect(sample.opacity).toBeLessThan(1);
            expect(sample.scale).toBeGreaterThan(0.97);
            expect(sample.scale).toBeLessThan(1);
            const offset = parseFloat(sample.translate.split(' ').at(-1)!);
            expect(offset).toBeGreaterThan(0);
            expect(offset).toBeLessThan(12);
            expect(sample.display).not.toBe('none');
            expect(sample.duration).toBeGreaterThanOrEqual(100);
            expect(sample.duration).toBeLessThanOrEqual(280);
        }
        expect(samples.entry!.inert).toBe(false);
        expect(samples.exit!.inert).toBe(true);
        expect(samples.exit!.pointerEvents).toBe('none');
        expect(samples.closed).toBe(true);
        expect(samples.display).toBe('none');
    });
}

test('popup motion preserves rapid reopen, Escape and outside dismissal', async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => {
        Math.random = () => 0;
    });
    await page.goto(site.origin);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    const reopened = await page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>(
            '[data-wallpaper-info]',
        )!;
        const trigger = document.querySelector<HTMLButtonElement>(
            '[data-wallpaper-author-toggle]',
        )!;
        trigger.click();
        panel.getAnimations().forEach((animation) => animation.finish());
        panel
            .querySelector<HTMLButtonElement>('.wallpaper-info-close')!
            .click();
        const exits = panel.getAnimations();
        exits.forEach((animation) => {
            animation.pause();
            animation.currentTime =
                Number(animation.effect!.getTiming().duration) / 2;
        });
        trigger.click();
        panel.getAnimations().forEach((animation) => animation.finish());
        return {
            open: panel.matches(':popover-open'),
            inert: panel.inert,
            opacity: getComputedStyle(panel).opacity,
        };
    });
    expect(reopened).toEqual({ open: true, inert: false, opacity: '1' });
    const panel = page.locator('[data-wallpaper-info]');
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await page.getByRole('button', { name: /壁纸作者/ }).click();
    await expect(panel).toBeVisible();
    await page.locator('.home-hero-title').click();
    await expect(panel).toBeHidden();
});

test('popup motion respects reduced motion and uses the regular exit on page scrolling', async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => {
        Math.random = () => 0;
    });
    await page.goto(site.origin);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    const panel = page.locator('[data-wallpaper-info]');
    const duringEntry = await page.evaluate(() => {
        const element = document.querySelector<HTMLElement>(
            '[data-wallpaper-info]',
        )!;
        document
            .querySelector<HTMLButtonElement>('[data-wallpaper-author-toggle]')!
            .click();
        const animations = element.getAnimations();
        animations.forEach((animation) => {
            animation.pause();
            animation.currentTime =
                Number(animation.effect!.getTiming().duration) / 2;
        });
        return animations.some(
            (animation) =>
                animation instanceof CSSTransition &&
                animation.transitionProperty === 'opacity',
        );
    });
    expect(duringEntry).toBe(true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(panel).toHaveCSS('opacity', '1');
    expect(
        await panel.evaluate((element) => element.getAnimations().length),
    ).toBe(0);
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCSS('display', 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const exits = await page.evaluate(async () => {
        const element = document.querySelector<HTMLElement>(
            '[data-wallpaper-info]',
        )!;
        const trigger = document.querySelector<HTMLButtonElement>(
            '[data-wallpaper-author-toggle]',
        )!;
        const readTransitions = () =>
            element
                .getAnimations()
                .flatMap((animation) =>
                    animation instanceof CSSTransition &&
                    ['opacity', 'scale', 'translate'].includes(
                        animation.transitionProperty,
                    )
                        ? [
                              {
                                  property: animation.transitionProperty,
                                  duration: Number(
                                      animation.effect!.getTiming().duration,
                                  ),
                                  easing: animation.effect!.getTiming().easing,
                              },
                          ]
                        : [],
                )
                .sort((a, b) => a.property.localeCompare(b.property));
        trigger.click();
        element.getAnimations().forEach((animation) => animation.finish());
        element
            .querySelector<HTMLButtonElement>('.wallpaper-info-close')!
            .click();
        const button = readTransitions();
        element.getAnimations().forEach((animation) => animation.finish());
        getComputedStyle(element).display;
        trigger.click();
        element.getAnimations().forEach((animation) => animation.finish());
        const scroll = await new Promise<{
            transitions: ReturnType<typeof readTransitions>;
            open: boolean;
            display: string;
            inert: boolean;
            pointerEvents: string;
        }>((resolve) => {
            document.addEventListener(
                'scroll',
                () => {
                    element.getAnimations().forEach((animation) => {
                        animation.pause();
                        animation.currentTime =
                            Number(animation.effect!.getTiming().duration) / 2;
                    });
                    const style = getComputedStyle(element);
                    resolve({
                        transitions: readTransitions(),
                        open: element.matches(':popover-open'),
                        display: style.display,
                        inert: element.inert,
                        pointerEvents: style.pointerEvents,
                    });
                },
                { once: true },
            );
            scrollTo({ top: scrollY + 1, behavior: 'instant' });
        });
        return { button, scroll };
    });
    expect(exits.button.map((transition) => transition.property)).toEqual([
        'opacity',
        'scale',
        'translate',
    ]);
    expect(exits.scroll.transitions).toEqual(exits.button);
    expect(exits.scroll.open).toBe(false);
    expect(exits.scroll.display).not.toBe('none');
    expect(exits.scroll.inert).toBe(true);
    expect(exits.scroll.pointerEvents).toBe('none');
    await panel.evaluate((element) =>
        element.getAnimations().forEach((animation) => animation.finish()),
    );
    await expect(panel).toHaveCSS('display', 'none');
    const reopened = await page.evaluate(() => {
        const element = document.querySelector<HTMLElement>(
            '[data-wallpaper-info]',
        )!;
        document
            .querySelector<HTMLButtonElement>('[data-wallpaper-author-toggle]')!
            .click();
        return {
            inert: element.inert,
            animating: element
                .getAnimations()
                .some(
                    (animation) =>
                        animation instanceof CSSTransition &&
                        animation.transitionProperty === 'opacity',
                ),
        };
    });
    expect(reopened).toEqual({ inert: false, animating: true });
    await panel.evaluate((element) =>
        element.getAnimations().forEach((animation) => animation.finish()),
    );
    const afterClosingScroll = await page.evaluate(
        () =>
            new Promise<{ animating: boolean; display: string }>((resolve) => {
                const element = document.querySelector<HTMLElement>(
                    '[data-wallpaper-info]',
                )!;
                element
                    .querySelector<HTMLButtonElement>('.wallpaper-info-close')!
                    .click();
                const animating = element
                    .getAnimations()
                    .some(
                        (animation) =>
                            animation instanceof CSSTransition &&
                            animation.transitionProperty === 'opacity',
                    );
                element.getAnimations().forEach((animation) => {
                    animation.pause();
                    animation.currentTime =
                        Number(animation.effect!.getTiming().duration) / 2;
                });
                document.addEventListener(
                    'scroll',
                    () =>
                        resolve({
                            animating,
                            display: getComputedStyle(element).display,
                        }),
                    { once: true },
                );
                scrollTo({ top: scrollY + 1, behavior: 'instant' });
            }),
    );
    expect(afterClosingScroll.animating).toBe(true);
    expect(afterClosingScroll.display).not.toBe('none');
    await panel.evaluate((element) =>
        element.getAnimations().forEach((animation) => animation.finish()),
    );
    await expect(panel).toHaveCSS('display', 'none');
});

test('popup motion is removed before client navigation swaps the page', async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => {
        Math.random = () => 0;
    });
    await page.goto(site.origin);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await page.getByRole('button', { name: /壁纸作者/ }).click();
    await page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>(
            '[data-wallpaper-info]',
        )!;
        document.addEventListener(
            'astro:before-swap',
            () => {
                (
                    window as Window & { popupBeforeSwap?: unknown }
                ).popupBeforeSwap = {
                    open: panel.matches(':popover-open'),
                    display: getComputedStyle(panel).display,
                    inert: panel.inert,
                    connected: panel.isConnected,
                };
            },
            { once: true },
        );
        // Activate navigation without auto-scrolling to a below-fold link first.
        document
            .querySelector<HTMLAnchorElement>('a[href="/archives/"]')!
            .click();
    });
    await expect(page).toHaveURL(`${site.origin}/archives/`);
    expect(
        await page.evaluate(
            () =>
                (window as Window & { popupBeforeSwap?: unknown })
                    .popupBeforeSwap,
        ),
    ).toEqual({ open: false, display: 'none', inert: true, connected: true });
    await page
        .getByRole('link', { name: 'Sky Blog 首页', exact: true })
        .click();
    await page.getByRole('button', { name: /壁纸作者/ }).click();
    await expect(
        page.getByRole('dialog', { name: '壁纸信息', exact: true }),
    ).toBeVisible();
});

for (const size of ['full', 'compact'] as const) {
    test(`${size} keeps long author text separate from the title and the popup usable`, async ({
        page,
    }) => {
        await page.addInitScript(() => {
            Math.random = () => 5.1 / 6;
        });
        await page.setViewportSize({ width: 320, height: 500 });
        await page.goto(size === 'full' ? site.origin : compact.origin);
        await page.evaluate(() => document.fonts.ready);
        const trigger = page.getByRole('button', { name: /壁纸作者/ });
        const author = (await trigger.boundingBox())!;
        const title = (await page.locator('.home-hero-content').boundingBox())!;
        const cards = (await page.locator('.home-card-grid').boundingBox())!;
        expect(author.x).toBeCloseTo(cards.x, 0);
        expect(author.x + author.width).toBeLessThanOrEqual(
            cards.x + cards.width + 0.5,
        );
        expect(title.y + title.height).toBeLessThanOrEqual(author.y - 12);
        await trigger.click();
        const panel = page.getByRole('dialog', {
            name: '壁纸信息',
            exact: true,
        });
        await expect(panel).toBeVisible();
        const centered = (await panel.boundingBox())!;
        expect(centered.x + centered.width / 2).toBeCloseTo(160, 0);
        expect(centered.y + centered.height / 2).toBeCloseTo(250, 0);
        const source = panel.getByRole('link', { name: 'X', exact: true });
        await source.scrollIntoViewIfNeeded();
        await expect(source).toBeVisible();
        await expect(panel).toBeVisible();
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBe(true);
    });
}
