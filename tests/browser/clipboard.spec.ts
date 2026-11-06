import { expect, test } from '@playwright/test';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

for (const path of ['/posts/format-example/', '/moments/format-example/']) {
    test(`copying ${path} uses the current host without query parameters or anchors`, async ({
        page,
    }) => {
        await page.goto(`${path}?utm_source=test#article-content`);
        await expect(page.locator('[data-page-loading]')).toBeHidden();
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
            'href',
            `https://example.com${path}`,
        );
        await page.evaluate(() => navigator.clipboard.writeText(''));

        await page
            .getByRole('button', { name: '复制链接', exact: true })
            .click();

        await expect
            .poll(() => page.evaluate(() => navigator.clipboard.readText()))
            .toBe(`http://127.0.0.1:4399${path}`);
        await expect(page.locator('.toast-status')).toHaveText(
            '已复制到剪贴板',
        );
    });
}

test('sharing passes the current article URL to the native share API', async ({
    page,
}) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'share', {
            value: async (data: ShareData) => {
                (window as Window & { sharedData?: ShareData }).sharedData =
                    data;
            },
        });
    });
    await page.goto('/posts/format-example/?utm_source=test#article-content');
    await expect(page.locator('[data-page-loading]')).toBeHidden();

    await page.getByRole('button', { name: '分享文章', exact: true }).click();

    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    (window as Window & { sharedData?: ShareData }).sharedData,
            ),
        )
        .toEqual({
            title: await page.title(),
            url: 'http://127.0.0.1:4399/posts/format-example/',
        });
});

test('sharing without native support copies the current moment URL', async ({
    page,
}) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'share', { value: undefined });
    });
    await page.goto('/moments/format-example/?utm_source=test#article-content');
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await page.evaluate(() => navigator.clipboard.writeText(''));

    await page.getByRole('button', { name: '分享', exact: true }).click();

    await expect
        .poll(() => page.evaluate(() => navigator.clipboard.readText()))
        .toBe('http://127.0.0.1:4399/moments/format-example/');
});

test('copying after client navigation uses the destination article URL', async ({
    page,
}) => {
    await page.goto('/posts/format-example/');
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await page
        .locator('.post-neighbors a[href="/posts/standalone-example/"]')
        .click();
    await expect(page).toHaveURL(
        'http://127.0.0.1:4399/posts/standalone-example/',
    );
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await page.evaluate(() => navigator.clipboard.writeText(''));

    await page.getByRole('button', { name: '复制链接', exact: true }).click();

    await expect
        .poll(() => page.evaluate(() => navigator.clipboard.readText()))
        .toBe('http://127.0.0.1:4399/posts/standalone-example/');
});
