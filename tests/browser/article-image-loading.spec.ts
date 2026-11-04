import { expect, test } from '@playwright/test';
import { createBackgroundSite } from '../fixtures/site-background';
import { imageBody } from '../fixtures/article-images';

let site: Awaited<ReturnType<typeof createBackgroundSite>>;
test.beforeAll(async () => {
    test.setTimeout(120_000);
    site = await createBackgroundSite({ articleBody: imageBody });
});
test.afterAll(async () => site?.close());

test('first-screen image has reserved space, remains eager and holds the initial cover', async ({
    page,
}) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/images/dusk.svg?image=first', async (route) => {
        await gate;
        await route.continue().catch(() => {});
    });
    try {
        await page.goto(`${site.origin}/posts/format-example/`, {
            waitUntil: 'domcontentloaded',
        });
        const image = page.getByRole('img', {
            name: '首屏正文图',
            exact: true,
        });
        await expect(image).toHaveAttribute('loading', 'eager');
        await expect(image).toHaveAttribute('width', '960');
        await expect(image).toHaveAttribute('height', '560');
        expect((await image.boundingBox())!.height).toBeGreaterThan(100);
        await expect(page.locator('[data-page-loading]')).toBeVisible();
        release();
        await expect(page.locator('[data-page-loading]')).toBeHidden();
    } finally {
        release();
    }
});

test('offscreen requests wait for scrolling and their layout stays stable during decoding', async ({
    page,
}) => {
    const requested: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    page.on('request', (request) => {
        if (request.url().includes('image=body-'))
            requested.push(request.url());
    });
    await page.route('**/images/dusk.svg?image=body-*', async (route) => {
        await gate;
        await route.continue().catch(() => {});
    });
    try {
        await page.goto(`${site.origin}/posts/format-example/`, {
            waitUntil: 'domcontentloaded',
        });
        await expect(page.locator('[data-page-loading]')).toBeHidden();
        const image = page.getByRole('img', { name: '延迟图片0', exact: true });
        await expect(image).toHaveAttribute('loading', 'lazy');
        const before = (await image.boundingBox())!;
        expect(before.height).toBeGreaterThan(100);
        expect(requested).toEqual([]);
        await image.scrollIntoViewIfNeeded();
        await expect.poll(() => requested.length).toBeGreaterThan(0);
        expect(requested.length).toBeLessThan(25);
        release();
        await expect
            .poll(() =>
                image.evaluate(
                    (node) =>
                        (node as HTMLImageElement).complete &&
                        (node as HTMLImageElement).naturalWidth > 0,
                ),
            )
            .toBe(true);
        const after = (await image.boundingBox())!;
        expect(after.width).toBeCloseTo(before.width, 1);
        expect(after.height).toBeCloseTo(before.height, 1);
        expect(after.width / after.height).toBeCloseTo(960 / 560, 2);
        await image.click();
        const dialog = page.getByRole('dialog', { name: '图片预览' });
        await expect(dialog).toBeVisible();
        await expect(dialog.locator('img')).toHaveAttribute(
            'src',
            `${site.origin}/images/dusk.svg?image=body-0`,
        );
    } finally {
        release();
    }
});

test('reserved dimensions and image content remain available without JavaScript', async ({
    browser,
}) => {
    const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 390, height: 844 },
    });
    try {
        const page = await context.newPage();
        await page.goto(`${site.origin}/posts/format-example/`);
        const image = page.getByRole('img', { name: '延迟图片0', exact: true });
        await expect(image).toHaveAttribute('loading', 'lazy');
        await expect(image).toHaveAttribute('width', '960');
        await image.scrollIntoViewIfNeeded();
        await expect
            .poll(() =>
                image.evaluate(
                    (node) =>
                        (node as HTMLImageElement).complete &&
                        (node as HTMLImageElement).naturalWidth > 0,
                ),
            )
            .toBe(true);
        const bounds = (await image.boundingBox())!;
        expect(bounds.width / bounds.height).toBeCloseTo(960 / 560, 2);
    } finally {
        await context.close();
    }
});

test('partial navigation keeps loading policies and original-image previews', async ({
    page,
}) => {
    await page.goto(site.origin);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await page.locator('a[href="/posts/format-example/"]').first().click();
    await expect(page).toHaveURL(`${site.origin}/posts/format-example/`);
    const first = page.getByRole('img', { name: '首屏正文图', exact: true });
    await expect(first).toHaveAttribute('loading', 'eager');
    await expect(
        page.getByRole('img', { name: '延迟图片24', exact: true }),
    ).toHaveAttribute('loading', 'lazy');
    await first.click();
    const dialog = page.getByRole('dialog', { name: '图片预览' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('img')).toHaveAttribute(
        'src',
        `${site.origin}/images/dusk.svg?image=first`,
    );
});
