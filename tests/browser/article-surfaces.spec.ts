import { expect, test } from '@playwright/test';
import { createBackgroundSite } from '../fixtures/site-background';

let site: Awaited<ReturnType<typeof createBackgroundSite>>;

test.beforeAll(async () => {
    test.setTimeout(120_000);
    site = await createBackgroundSite({
        comments: true,
        recommendations: true,
    });
});
test.afterAll(async () => {
    await site?.close();
});

for (const scheme of ['light', 'dark'] as const) {
    test(`reading and ancillary cards share ${scheme} glass with a clear backdrop`, async ({
        page,
    }) => {
        await page.addInitScript(
            (scheme) => localStorage.setItem('sky-theme', scheme),
            scheme,
        );
        await page.route('https://giscus.app/**', (route) =>
            route.fulfill({ contentType: 'text/javascript', body: '' }),
        );
        await page.goto(`${site.origin}/posts/format-example/`);
        await expect(page.locator('.article-page')).toHaveCSS(
            'background-color',
            'rgba(0, 0, 0, 0)',
        );
        await expect(page.locator('.article-heading')).toHaveCSS(
            'backdrop-filter',
            'none',
        );
        for (const selector of [
            '.article-paper',
            '.article-footer',
            '.post-neighbors',
            '.article-recommendations',
            '.comments-section',
            '.toc-card',
        ]) {
            const surface = page.locator(selector);
            await expect(surface).toHaveCSS(
                'backdrop-filter',
                'blur(32px) saturate(1.3)',
            );
            await expect(surface).toHaveCSS('opacity', '1');
        }
        const structure = await page
            .locator('.article-footer')
            .evaluate((el) => {
                const ancestors: string[] = [];
                for (
                    let parent = el.parentElement;
                    parent;
                    parent = parent.parentElement
                ) {
                    if (getComputedStyle(parent).backdropFilter !== 'none')
                        ancestors.push(parent.className);
                }
                return ancestors;
            });
        expect(structure).toEqual([]);
        await expect(page.locator('[data-giscus] script')).toHaveAttribute(
            'data-theme',
            scheme,
        );
        await page.locator('.comments-section').evaluate((el) => {
            const iframe = document.createElement('iframe');
            iframe.className = 'giscus-frame';
            el.append(iframe);
            (window as Window & { themeMessages?: unknown[] }).themeMessages =
                [];
            iframe.contentWindow!.postMessage = (message, targetOrigin) => {
                (
                    window as Window & { themeMessages?: unknown[] }
                ).themeMessages!.push({ message, targetOrigin });
            };
        });
        await page.locator('.site-nav [data-theme-toggle]').click();
        const nextScheme = scheme === 'light' ? 'dark' : 'light';
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (window as Window & { themeMessages?: unknown[] })
                            .themeMessages,
                ),
            )
            .toEqual([
                {
                    message: { giscus: { setConfig: { theme: nextScheme } } },
                    targetOrigin: 'https://giscus.app',
                },
            ]);
    });
}

test('mobile inline directory keeps its glass surface while switching column tabs', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('https://giscus.app/**', (route) =>
        route.fulfill({ contentType: 'text/javascript', body: '' }),
    );
    await page.goto(`${site.origin}/posts/format-example/`);
    const directory = page.locator('.mobile-toc');
    await expect(directory).toHaveCSS(
        'backdrop-filter',
        'blur(32px) saturate(1.3)',
    );
    await directory.locator('summary').click();
    await directory.getByRole('tab', { name: '专栏目录', exact: true }).click();
    await expect(directory.locator('[data-tab-kind="column"]')).toHaveAttribute(
        'aria-selected',
        'true',
    );
    await expect(directory).toHaveCSS(
        'backdrop-filter',
        'blur(32px) saturate(1.3)',
    );
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
    ).toBe(true);
});
