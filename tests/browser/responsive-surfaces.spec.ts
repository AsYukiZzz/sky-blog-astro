import { expect, test } from '@playwright/test';
import { createBackgroundSite } from '../fixtures/site-background';

let site: Awaited<ReturnType<typeof createBackgroundSite>>;
test.beforeAll(async () => {
    test.setTimeout(120_000);
    site = await createBackgroundSite({ recommendations: true });
});
test.afterAll(async () => {
    await site?.close();
});

for (const viewport of [
    { width: 1024, height: 600 },
    { width: 667, height: 375 },
    { width: 390, height: 844 },
]) {
    test(`long article headings stay below navigation at ${viewport.width}x${viewport.height}`, async ({
        page,
    }) => {
        await page.setViewportSize(viewport);
        await page.goto(`${site.origin}/posts/format-example/`);
        await page.evaluate(() => document.fonts.ready);
        for (const title of [
            '个人博客全站外观改造设计开发验证实践'.repeat(3).slice(0, 50),
            '个人博客全站外观改造设计开发验证实践'.repeat(6),
            'TypeScriptAstroMigration'.repeat(8),
        ]) {
            await page.locator('.article-heading h1').evaluate((el, title) => {
                el.textContent = title;
            }, title);
            const layout = await page
                .locator('.article-heading')
                .evaluate((el) => {
                    const heading = el.getBoundingClientRect();
                    const header = el
                        .closest('header')!
                        .getBoundingClientRect();
                    const navigation = document
                        .querySelector('.site-nav')!
                        .getBoundingClientRect();
                    const title = el.querySelector('h1')!;
                    return {
                        top: heading.top,
                        bottom: heading.bottom,
                        headerBottom: header.bottom,
                        navigationBottom: navigation.bottom,
                        titleFits: title.scrollWidth <= title.clientWidth,
                        horizontalOverflow:
                            document.documentElement.scrollWidth > innerWidth,
                    };
                });
            expect(layout.top).toBeGreaterThanOrEqual(layout.navigationBottom);
            expect(layout.bottom).toBeLessThanOrEqual(layout.headerBottom);
            expect(layout.titleFits).toBe(true);
            expect(layout.horizontalOverflow).toBe(false);
            await expect(page.locator('.article-heading h1')).toHaveText(title);
        }
    });
}

for (const viewport of [
    { width: 390, height: 844 },
    { width: 667, height: 375 },
]) {
    test(`mobile reading dialogs retain their dimensions at ${viewport.width}px`, async ({
        page,
    }) => {
        await page.setViewportSize(viewport);
        await page.goto(`${site.origin}/posts/format-example/`);
        await page.locator('.mobile-toc summary').click();
        await page.locator('.mobile-toc [data-open-toc]').click();
        const directory = page.locator('#article-toc-dialog');
        await expect(directory).toHaveCSS('width', `${viewport.width - 24}px`);
        await expect(directory).toHaveCSS(
            'height',
            `${viewport.height - 24}px`,
        );
        await expect(directory).toHaveCSS('padding', '20px');
        await expect(directory.locator('.article-toc-link').first()).toHaveCSS(
            'padding',
            '10px 12px',
        );
        const nested = directory
            .locator('.article-toc-tree .article-toc-tree')
            .first();
        await expect(nested).toHaveCSS('margin-left', '9px');
        await expect(nested).toHaveCSS('padding-left', '9px');
        await page.keyboard.press('Escape');
        await page.locator('[data-open-article-posts]').click();
        const discovery = page.locator('#article-posts-dialog');
        await expect(discovery).toHaveCSS('width', `${viewport.width - 24}px`);
        await expect(discovery).toHaveCSS(
            'height',
            `${viewport.height - 24}px`,
        );
        await expect(discovery).toHaveCSS('padding', '20px');
    });
}

test('phone reading controls and code blocks retain their responsive spacing', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${site.origin}/posts/format-example/`);
    const code = page.locator('#article-content pre').first();
    await expect(code).toHaveCSS('font-size', '13px');
    await expect(code).toHaveCSS('padding-left', '16px');
    expect(
        await code.evaluate((el) => getComputedStyle(el, '::before').left),
    ).toBe('16px');
    await expect(page.locator('#article-content')).toHaveCSS(
        'font-size',
        '16px',
    );
    const next = page.locator('.post-neighbor-next');
    await expect(next).toHaveCSS('min-height', '112px');
    await expect(next).toHaveCSS('border-left-width', '0px');
    await expect(next).toHaveCSS('align-items', 'flex-start');
    await expect(next).toHaveCSS('text-align', 'left');
    await expect(page.locator('.copyright-box')).toHaveCSS('padding', '16px');
});
