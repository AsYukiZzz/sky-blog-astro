import { expect, test } from '@playwright/test';
import {
    createBackgroundSite,
    wallpaperSource,
} from '../fixtures/site-background';

let site: Awaited<ReturnType<typeof createBackgroundSite>>;

test.beforeAll(async () => {
    test.setTimeout(120_000);
    site = await createBackgroundSite({
        coverlessPost: true,
        updatedPost: true,
    });
});

test.afterAll(async () => {
    await site?.close();
});

for (const width of [390, 1440]) {
    test(`article header keeps taxonomy above the title in a compact ${width}px card`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(`${site.origin}/posts/format-example/`);
        await page.evaluate(() => document.fonts.ready);
        const heading = page.locator('.article-heading');
        const category = (await heading
            .getByRole('navigation', { name: '文章分类' })
            .boundingBox())!;
        const tags = (await heading
            .getByRole('navigation', { name: '文章标签' })
            .boundingBox())!;
        const title = (await heading.locator('h1').boundingBox())!;
        const card = (await heading.boundingBox())!;
        const metadata = (await heading
            .locator('.article-meta')
            .boundingBox())!;
        expect(category.y + category.height).toBeLessThanOrEqual(title.y);
        expect(tags.y + tags.height).toBeLessThanOrEqual(title.y);
        expect(Math.abs(category.y - tags.y)).toBeLessThan(2);
        expect(card.height).toBeLessThan(width < 640 ? 480 : 260);
        expect(metadata.height).toBeLessThanOrEqual(26);
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBe(true);
    });
}

for (const width of [390, 1440]) {
    test(`article summary belongs between the title and metadata at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(`${site.origin}/posts/format-example/`);
        const heading = page.locator('.article-heading');
        const summary = heading.locator('.article-description');
        const description =
            '用一篇文章展示标题、列表、引用、表格、代码块、图片，以及 MDX 提示框组件。';
        await expect(summary).toHaveText(description);
        await expect(
            page
                .getByText(description, { exact: true })
                .filter({ visible: true }),
        ).toHaveCount(1);
        await expect(
            page
                .locator('.article-paper')
                .getByText(description, { exact: true }),
        ).toHaveCount(0);
        const title = (await heading.locator('h1').boundingBox())!;
        const excerpt = (await summary.boundingBox())!;
        const metadata = (await heading
            .locator('.article-meta')
            .boundingBox())!;
        const card = (await heading.boundingBox())!;
        expect(excerpt.y).toBeGreaterThanOrEqual(title.y + title.height);
        expect(metadata.y).toBeGreaterThanOrEqual(excerpt.y + excerpt.height);
        expect(metadata.y + metadata.height).toBeLessThanOrEqual(
            card.y + card.height,
        );
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBe(true);
    });
}

test('article metadata distinguishes the author, publication, update and reading time', async ({
    page,
}) => {
    await page.goto(`${site.origin}/posts/format-example/`);
    const heading = page.locator('.article-heading');
    const metadata = heading.locator('.article-meta');
    await expect(metadata.getByRole('link', { name: /Sky/ })).toHaveAttribute(
        'href',
        '/authors/sky/',
    );
    await expect(metadata.locator('time')).toHaveText([
        '2026/09/30',
        '2026/10/20',
    ]);
    await expect(metadata.locator('time').last()).toHaveAttribute(
        'datetime',
        '2026-10-20T10:30:00.000Z',
    );
    await expect(
        heading.getByRole('navigation', { name: '文章分类' }),
    ).toBeVisible();
    await expect(
        heading.getByRole('navigation', { name: '文章标签' }).getByRole('link'),
    ).toHaveCount(2);
});

for (const scheme of ['light', 'dark'] as const) {
    test(`article cover sits beside the title on the shared ${scheme} background`, async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.addInitScript(
            (scheme) => localStorage.setItem('sky-theme', scheme),
            scheme,
        );
        await page.goto(`${site.origin}/posts/format-example/`);
        const heading = page.locator('.article-heading');
        const cover = heading.locator('img[src="/images/dusk.svg"]');
        await expect(heading).toHaveCSS('backdrop-filter', 'none');
        await expect(heading).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        await expect(heading).toHaveCSS('background-image', 'none');
        await expect(heading).toHaveCSS('box-shadow', 'none');
        await expect(heading).toHaveCSS('border-top-width', '0px');
        await expect(cover).toHaveCount(1);
        await expect
            .poll(() =>
                cover.evaluate((image: HTMLImageElement) => image.naturalWidth),
            )
            .toBeGreaterThan(0);
        const title = (await heading.locator('h1').boundingBox())!;
        const image = (await cover.boundingBox())!;
        const decoration = heading.locator('.article-cover-clip');
        await expect(decoration).toHaveCount(1);
        await expect(decoration).toHaveAttribute('aria-hidden', 'true');
        await expect(decoration).toHaveAttribute('focusable', 'false');
        await expect(decoration).toHaveCSS('pointer-events', 'none');
        const clip = (await decoration.boundingBox())!;
        expect(clip.y).toBeLessThan(image.y);
        expect(clip.y + clip.height).toBeGreaterThan(image.y);
        expect(clip.x).toBeGreaterThanOrEqual(image.x);
        expect(clip.x + clip.width).toBeLessThanOrEqual(image.x + image.width);
        const card = (await heading.boundingBox())!;
        const frame = (await page.locator('.article-grid').boundingBox())!;
        expect(image.x).toBeGreaterThanOrEqual(title.x + title.width);
        expect(image.x + image.width).toBeLessThanOrEqual(card.x + card.width);
        expect(card.x).toBeCloseTo(frame.x, 0);
        expect(card.width).toBeCloseTo(frame.width, 0);
        expect(
            await heading.evaluate((el) => {
                for (
                    let parent = el.parentElement;
                    parent && parent.tagName !== 'BODY';
                    parent = parent.parentElement
                ) {
                    const style = getComputedStyle(parent);
                    if (
                        style.backgroundImage !== 'none' ||
                        style.backgroundColor !== 'rgba(0, 0, 0, 0)'
                    )
                        return false;
                }
                return true;
            }),
        ).toBe(true);
        const wallpaper = page.locator('[data-site-background]');
        await expect(wallpaper).toHaveCount(1);
        await expect(wallpaper.locator('img')).toHaveAttribute(
            'src',
            wallpaperSource,
        );
        const before = await wallpaper.boundingBox();
        await page.locator('.article-paper').scrollIntoViewIfNeeded();
        expect(await wallpaper.boundingBox()).toEqual(before);
    });
}

test('phone article header stacks its cover after the title and metadata', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${site.origin}/posts/format-example/`);
    const heading = page.locator('.article-heading');
    const cover = heading.locator('img[src="/images/dusk.svg"]');
    await expect(cover).toHaveCount(1);
    const metadata = (await heading.locator('.article-meta').boundingBox())!;
    const image = (await cover.boundingBox())!;
    const clip = (await heading.locator('.article-cover-clip').boundingBox())!;
    const card = (await heading.boundingBox())!;
    expect(image.y).toBeGreaterThanOrEqual(metadata.y + metadata.height);
    expect(clip.y).toBeGreaterThanOrEqual(metadata.y + metadata.height);
    expect(clip.y).toBeLessThan(image.y);
    expect(image.width).toBeGreaterThan(card.width * 0.8);
    expect(image.y + image.height).toBeLessThanOrEqual(card.y + card.height);
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
    ).toBe(true);
});

test('an article without a cover uses the whole title card', async ({
    page,
}) => {
    for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(`${site.origin}/posts/standalone-example/`);
        const heading = page.locator('.article-heading');
        await expect(
            heading.locator('img[src="/images/dusk.svg"]'),
        ).toHaveCount(0);
        await expect(heading.locator('.article-cover-clip')).toHaveCount(0);
        const card = (await heading.boundingBox())!;
        const frame = (await page.locator('.article-grid').boundingBox())!;
        const title = (await heading.locator('h1').boundingBox())!;
        expect(card.width).toBeCloseTo(frame.width, 0);
        expect(title.width).toBeGreaterThan(card.width * 0.8);
    }
});

test('article title and cover render together without JavaScript', async ({
    browser,
}) => {
    const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 1440, height: 1000 },
    });
    try {
        const page = await context.newPage();
        await page.goto(`${site.origin}/posts/format-example/`);
        const cover = page.locator(
            '.article-heading img[src="/images/dusk.svg"]',
        );
        await expect(cover).toHaveCount(1);
        await expect
            .poll(() =>
                cover.evaluate((image: HTMLImageElement) => image.naturalWidth),
            )
            .toBeGreaterThan(0);
        await expect(page.locator('.article-heading h1')).toBeVisible();
        await expect(page.locator('.article-cover-clip')).toHaveCount(1);
        await expect(page.locator('[data-site-background]')).toHaveCSS(
            'position',
            'fixed',
        );
    } finally {
        await context.close();
    }
});
