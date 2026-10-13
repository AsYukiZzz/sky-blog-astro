import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) {
    test(`author articles remain readable without hover or layout preferences at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript(() =>
            localStorage.setItem('sky-post-layout', 'magazine'),
        );
        await page.goto('/authors/sky/');
        await page.evaluate(() => document.fonts.ready);

        const content = page.locator('.listing-container');
        const title = content
            .getByRole('heading', {
                level: 2,
                name: 'Markdown 与 MDX 格式示例',
                exact: true,
            })
            .getByRole('link');
        await expect(title).toBeVisible();
        await expect(title).toBeInViewport();
        await expect(content.getByRole('button')).toHaveCount(0);
        await expect(content.locator('aside')).toHaveCount(0);

        const cover = content.getByRole('link', {
            name: '阅读 Markdown 与 MDX 格式示例',
            exact: true,
        });
        await expect(cover).toBeVisible();
        await expect
            .poll(() =>
                cover
                    .locator('img')
                    .evaluate((image: HTMLImageElement) => image.naturalWidth),
            )
            .toBeGreaterThan(0);
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
        ).toBe(true);

        await title.click();
        await expect(page).toHaveURL(/\/posts\/format-example\/$/);
        await expect(page.locator('#article-content')).toBeVisible();
        await page.goBack();
        await expect(title).toBeVisible();
    });
}
