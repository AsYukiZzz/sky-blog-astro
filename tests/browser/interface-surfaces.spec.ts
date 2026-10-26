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

test('independent pages have a reading surface and a separate comment surface', async ({
    page,
}) => {
    await page.route('https://giscus.app/**', (route) =>
        route.fulfill({ contentType: 'text/javascript', body: '' }),
    );
    await page.goto(`${site.origin}/pages/privacy/`);
    await expect(page.locator('#article-content').locator('..')).toHaveCSS(
        'backdrop-filter',
        'blur(32px) saturate(1.3)',
    );
    await expect(page.locator('#page-title')).toBeVisible();
    await expect(page.locator('.comments-section')).toHaveCSS(
        'backdrop-filter',
        'blur(32px) saturate(1.3)',
    );
    expect(
        await page.locator('.comments-section').evaluate((el) => {
            for (
                let parent = el.parentElement;
                parent;
                parent = parent.parentElement
            ) {
                if (getComputedStyle(parent).backdropFilter !== 'none')
                    return false;
            }
            return true;
        }),
    ).toBe(true);
});

for (const scheme of ['light', 'dark'] as const) {
    test(`search and global interaction surfaces use ${scheme} glass`, async ({
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
        await page.locator('.site-nav [data-open-search]').click();
        const search = page.locator('#search-dialog');
        await expect(search).toBeVisible();
        await expect(search).toHaveCSS(
            'backdrop-filter',
            'blur(32px) saturate(1.3)',
        );
        await expect(search.locator('input')).toHaveCSS('opacity', '1');
        await page.keyboard.press('Escape');
        await expect(search).not.toBeVisible();
        await expect(page.locator('.sky-dock')).toHaveCSS(
            'backdrop-filter',
            'blur(32px) saturate(1.3)',
        );
        await expect(page.locator('.site-footer')).toHaveCSS(
            'backdrop-filter',
            'blur(32px) saturate(1.3)',
        );
        await page.locator('[data-open-article-posts]').click();
        await expect(page.locator('#article-posts-dialog')).toHaveCSS(
            'backdrop-filter',
            'blur(32px) saturate(1.3)',
        );
        await page.keyboard.press('Escape');
        await page.locator('.nav-dropdown > summary').first().click();
        await expect(page.locator('.dropdown-panel').first()).toHaveCSS(
            'backdrop-filter',
            'blur(32px) saturate(1.3)',
        );
    });
}

test('mobile navigation shares the global material and keeps its links operable', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${site.origin}/archives/`);
    await page.locator('[data-menu-toggle]').click();
    const menu = page.getByRole('dialog', { name: '移动端导航' });
    await expect(menu).toHaveCSS('backdrop-filter', 'blur(32px) saturate(1.3)');
    await menu.getByRole('link', { name: '专栏', exact: true }).click();
    await expect(page).toHaveURL(`${site.origin}/columns/`);
    await expect(page.locator('.columns-overview')).toBeVisible();
});
