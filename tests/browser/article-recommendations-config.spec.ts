import { expect, test } from '@playwright/test';
import { createColumnsSite } from '../fixtures/columns-site';

test('the configured maximum limits both footer lists without limiting the Dock dialog', async ({
    page,
}) => {
    test.setTimeout(120_000);
    const site = await createColumnsSite({
        recommendations: { enabled: true, maxItems: 1 },
        popularPosts: ['p03', 'p01', 'p02'],
    });
    try {
        await page.goto(`${site.origin}/posts/format-example/`);
        const footer = page.getByRole('region', {
            name: '继续阅读',
            exact: true,
        });
        const links = footer.getByRole('tabpanel').getByRole('link');
        await expect(links).toHaveCount(1);
        await expect(links).toHaveAttribute('href', '/posts/p03/');
        await footer
            .getByRole('tab', { name: '最新文章', exact: true })
            .click();
        await expect(links).toHaveCount(1);
        await expect(links).toHaveAttribute(
            'href',
            '/posts/standalone-example/',
        );
        await page.locator('.article-heading').scrollIntoViewIfNeeded();
        await page
            .locator('.sky-dock')
            .getByRole('button', { name: '发现文章' })
            .click();
        const dialog = page.getByRole('dialog', { name: '文章推荐' });
        await expect(dialog).toBeVisible();
        expect(
            await dialog.getByRole('tabpanel').getByRole('link').count(),
        ).toBeGreaterThan(1);
    } finally {
        await site.close();
    }
});

test('disabling footer recommendations removes the card and preserves article navigation and Dock discovery', async ({
    page,
}) => {
    test.setTimeout(120_000);
    const site = await createColumnsSite({
        recommendations: { enabled: false, maxItems: 5 },
    });
    try {
        await page.goto(`${site.origin}/posts/format-example/`);
        await expect(
            page.getByRole('region', {
                name: '继续阅读',
                exact: true,
                includeHidden: true,
            }),
        ).toHaveCount(0);
        await expect(
            page.getByRole('region', { name: '版权信息', exact: true }),
        ).toBeVisible();
        await expect(
            page.getByRole('navigation', { name: '相邻文章' }),
        ).toBeVisible();
        await page
            .locator('.sky-dock')
            .getByRole('button', { name: '发现文章' })
            .click();
        await expect(
            page.getByRole('dialog', { name: '文章推荐' }),
        ).toBeVisible();
    } finally {
        await site.close();
    }
});

test('an invalid footer maximum reports the configuration field instead of building an empty card', async () => {
    test.setTimeout(120_000);
    const build = createColumnsSite({
        recommendations: { enabled: true, maxItems: 0 },
    }).then(async (site) => {
        await site.close();
    });
    await expect(build).rejects.toThrow(
        /theme\.post\.recommendations\.maxItems/,
    );
});
