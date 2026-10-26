import { expect, test } from '@playwright/test';
import { createBackgroundSite } from '../fixtures/site-background';

for (const appearance of ['transparent', 'glass'] as const) {
    test.describe(`post header appearance ${appearance}`, () => {
        let site: Awaited<ReturnType<typeof createBackgroundSite>>;

        test.beforeAll(async () => {
            test.setTimeout(120_000);
            site = await createBackgroundSite({
                headerAppearance: appearance,
                glass: {
                    blur: 18,
                    saturation: 1.15,
                    opacity: { light: 0.64, dark: 0.52 },
                },
            });
        });

        test.afterAll(async () => {
            await site?.close();
        });

        for (const width of [390, 1440]) {
            test(`configured surface and global material apply at ${width}px`, async ({
                page,
            }) => {
                await page.setViewportSize({ width, height: 1000 });
                await page.goto(`${site.origin}/posts/format-example/`);
                const heading = page.locator('.article-heading');
                const body = page.locator('.article-paper');
                for (const scheme of ['light', 'dark']) {
                    if (scheme === 'dark') {
                        await page
                            .locator('.site-nav [data-theme-toggle]')
                            .click();
                    }
                    await expect(page.locator('html')).toHaveAttribute(
                        'data-color-scheme',
                        scheme,
                    );
                    await expect(heading).toHaveCSS(
                        'backdrop-filter',
                        appearance === 'glass'
                            ? 'blur(18px) saturate(1.15)'
                            : 'none',
                    );
                    await expect(body).toHaveCSS(
                        'backdrop-filter',
                        'blur(18px) saturate(1.15)',
                    );
                    const bodyColor = await body.evaluate(
                        (el) => getComputedStyle(el).backgroundColor,
                    );
                    expect(bodyColor).toContain(
                        scheme === 'light' ? '0.64' : '0.52',
                    );
                    await expect(heading).toHaveCSS(
                        'background-color',
                        appearance === 'glass' ? bodyColor : 'rgba(0, 0, 0, 0)',
                    );
                }
                await expect(heading.locator('h1')).toBeVisible();
                await expect(
                    heading.locator('.article-description'),
                ).toBeVisible();
                await expect(heading.locator('.article-cover')).toBeVisible();
                await expect(
                    heading.locator('.article-cover-clip'),
                ).toBeVisible();
                await expect(page.locator('[data-site-background]')).toHaveCSS(
                    'position',
                    'fixed',
                );
                expect(
                    await page.evaluate(
                        () =>
                            document.documentElement.scrollWidth <= innerWidth,
                    ),
                ).toBe(true);
            });
        }
    });
}
