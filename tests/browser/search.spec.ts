import { expect, test } from '@playwright/test';

const articlePath = '/posts/format-example/';
const exampleTitle = 'Markdown 与 MDX 格式示例';

test('the navigation search opens in place and its article result navigates without leaving a modal behind', async ({
    page,
}) => {
    const originPath = '/moments/format-example/';
    await page.goto(originPath);
    await page
        .locator('.site-nav')
        .getByRole('button', { name: '搜索', exact: true })
        .click({ modifiers: ['Control'] });
    const dialog = page.getByRole('dialog', { name: '搜索内容', exact: true });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(`http://127.0.0.1:4399${originPath}`);
    const input = dialog.getByRole('searchbox', { name: '搜索关键词' });
    await expect(input).toBeFocused();
    await input.fill('Markdown');
    const result = dialog.getByRole('link').filter({
        has: page.getByRole('heading', { name: exampleTitle, exact: true }),
    });
    await expect(result).toHaveAttribute('href', '/posts/format-example/');
    await expect(result.locator('.search-result-type')).toHaveText('文章');
    await expect(result.locator('p')).not.toBeEmpty();
    await page.evaluate(() => {
        (
            window as Window & { searchNavigationMarker?: string }
        ).searchNavigationMarker = 'same-document';
    });
    await result.click();
    await expect(page).toHaveURL('http://127.0.0.1:4399/posts/format-example/');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect
        .poll(() =>
            page
                .locator('html')
                .evaluate((root) => getComputedStyle(root).overflowY),
        )
        .not.toBe('hidden');
    expect(
        await page.evaluate(
            () =>
                (window as Window & { searchNavigationMarker?: string })
                    .searchNavigationMarker,
        ),
    ).toBe('same-document');
    await page.goBack();
    await expect(page).toHaveURL(`http://127.0.0.1:4399${originPath}`);
    await page.keyboard.press('Control+k');
    await expect(dialog).toBeVisible();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('');
});

test('Escape and the backdrop restore the reading position and search trigger focus', async ({
    page,
}) => {
    await page.goto(articlePath);
    await page.evaluate(async () => {
        await document.fonts.ready;
        window.scrollTo({ top: 420, behavior: 'instant' });
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(420);
    const trigger = page
        .locator('.site-nav')
        .getByRole('button', { name: '搜索', exact: true });
    const dialog = page.getByRole('dialog', { name: '搜索内容', exact: true });
    const content = page.locator('#article-content');
    const before = await content.boundingBox();
    for (const close of ['Escape', 'backdrop']) {
        await trigger.evaluate((element) =>
            element.focus({ preventScroll: true }),
        );
        await page.keyboard.press('Enter');
        await expect(dialog).toBeVisible();
        const during = await content.boundingBox();
        expect(Math.abs(during!.x - before!.x)).toBeLessThan(1);
        expect(Math.abs(during!.width - before!.width)).toBeLessThan(1);
        await page.mouse.move(8, 8);
        await page.mouse.wheel(0, 500);
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(420);
        if (close === 'Escape') await page.keyboard.press('Escape');
        else await page.mouse.click(8, 8);
        await expect(dialog).not.toBeVisible();
        await expect(trigger).toBeFocused();
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(420);
    }
});

test('the keyboard shortcut and arrow keys can open an independent page result', async ({
    page,
}) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: '搜索内容', exact: true });
    await expect(dialog).toBeVisible();
    const input = dialog.getByRole('searchbox', { name: '搜索关键词' });
    await input.fill('隐私');
    const result = dialog.getByRole('link').filter({
        has: page.getByRole('heading', { name: '隐私政策', exact: true }),
    });
    await expect(result).toHaveAttribute('href', '/pages/privacy/');
    await expect(result.locator('.search-result-type')).toHaveText('页面');
    await input.press('ArrowDown');
    await expect(dialog.locator('.search-result').first()).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(input).toBeFocused();
    const lastResult = dialog.locator('.search-result').last();
    await lastResult.focus();
    await page.keyboard.press('Tab');
    const close = dialog.getByRole('button', { name: '关闭搜索' });
    await expect(close).toBeFocused();
    await close.press('Shift+Tab');
    await expect(lastResult).toBeFocused();
    await result.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('http://127.0.0.1:4399/pages/privacy/');
    await expect(
        page.getByRole('heading', { level: 1, name: '隐私政策' }),
    ).toBeVisible();
});

test('mobile search fills the viewport and the dock trigger regains focus on close', async ({
    page,
}) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(articlePath);
    const trigger = page.getByRole('button', { name: '搜索内容', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: '搜索内容', exact: true });
    await expect(dialog).toBeVisible();
    expect(await dialog.boundingBox()).toEqual({
        x: 0,
        y: 0,
        width: 375,
        height: 812,
    });
    const input = dialog.getByRole('searchbox', { name: '搜索关键词' });
    await input.fill('隐私');
    await expect(dialog.locator('a[href="/pages/privacy/"]')).toBeVisible();
    expect(
        await dialog.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
        ),
    ).toBe(true);
    await dialog.getByRole('button', { name: '关闭搜索' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
});

test('the retired search route no longer serves a page', async ({
    request,
}) => {
    const response = await request.get('/search/?q=Markdown');
    expect(response.status()).toBe(404);
});

test('search highlights English matches in titles and excerpts and updates them with the query', async ({
    page,
}) => {
    await page.goto(articlePath);
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: '搜索内容', exact: true });
    const input = dialog.getByRole('searchbox', { name: '搜索关键词' });
    const result = dialog.locator('a[href="/posts/format-example/"]');
    await input.fill('markdown mdx');
    await expect(result.getByRole('heading')).toHaveText(exampleTitle);
    await expect(result.locator('h3 mark')).toHaveText(['Markdown', 'MDX']);
    // Pagefind may choose an excerpt containing only one of the query terms.
    const excerptMarks = result.locator('p mark');
    await expect(excerptMarks.first()).toBeVisible();
    for (const mark of await excerptMarks.all()) {
        await expect(mark).toHaveText(/^\s*(?:markdown|mdx)\s*$/i);
    }
    await input.fill('Markdown');
    await expect(result.locator('h3 mark')).toHaveText(['Markdown']);
    await expect(result.locator('p mark')).toContainText([/markdown/i]);
    await input.fill('');
    await expect(dialog.locator('mark')).toHaveCount(0);
});

test('search highlights Chinese matches with readable colors in light and dark themes', async ({
    page,
}) => {
    for (const theme of ['light', 'night']) {
        await page.goto(articlePath);
        await page.evaluate(
            (value) => localStorage.setItem('sky-theme', value),
            theme,
        );
        await page.reload();
        await page.keyboard.press('Control+k');
        const dialog = page.getByRole('dialog', {
            name: '搜索内容',
            exact: true,
        });
        await dialog.getByRole('searchbox').fill('隐私');
        const result = dialog.locator('a[href="/pages/privacy/"]');
        await expect(result.getByRole('heading')).toHaveText('隐私政策');
        await expect(result.locator('h3 mark')).toHaveText(['隐私']);
        await expect(result.locator('p mark')).toContainText(['隐私']);
        const colors = await result.locator('h3 mark').evaluate((element) => {
            const style = getComputedStyle(element);
            return { color: style.color, background: style.backgroundColor };
        });
        expect(colors.background).not.toBe('rgba(0, 0, 0, 0)');
        expect(colors.color).not.toBe(colors.background);
        await page.keyboard.press('Escape');
    }
});

test('highlight rendering preserves literal text and never inserts result HTML or mark attributes', async ({
    page,
}) => {
    await page.route('**/pagefind/pagefind.js', (route) =>
        route.fulfill({
            contentType: 'text/javascript',
            body: `import * as original from '/pagefind/pagefind.js?highlight-fixture';
export const destroy = original.destroy;
export async function search(query) {
    const response = await original.search(query);
    const first = response.results[0];
    return { ...response, results: [{ ...first, data: async () => {
        const item = await first.data();
        return { ...item,
            url: '/posts/highlight-fixture/',
            meta: { ...item.meta, title: 'Markdown <img src=x onerror="window.searchInjected=true"> & MDX' },
            excerpt: 'Use <mark onclick="window.searchInjected=true">Markdown</mark> &amp; <b><mark>MDX</mark></b> &lt;script&gt;literal&lt;/script&gt;<img src=x onerror="window.searchInjected=true">'
        };
    } }] };
}`,
        }),
    );
    await page.goto(articlePath);
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: '搜索内容', exact: true });
    await dialog.getByRole('searchbox').fill('Markdown MDX');
    const result = dialog.locator('a[href="/posts/highlight-fixture/"]');
    await expect(result.getByRole('heading')).toHaveText(
        'Markdown <img src=x onerror="window.searchInjected=true"> & MDX',
    );
    await expect(result.locator('h3 mark')).toHaveText(['Markdown', 'MDX']);
    await expect(result.locator('p')).toHaveText(
        'Use Markdown & MDX <script>literal</script>',
    );
    await expect(result.locator('p mark')).toHaveText(['Markdown', 'MDX']);
    await expect(
        result.locator('img, script, b, [onclick], [onerror]'),
    ).toHaveCount(0);
    expect(
        await page.evaluate(
            () =>
                (window as Window & { searchInjected?: boolean })
                    .searchInjected,
        ),
    ).toBeUndefined();
});

test('empty input stays local and clears previous results, while unmatched input reports an empty state', async ({
    page,
}) => {
    const indexRequests: string[] = [];
    page.on('request', (request) => {
        if (request.url().includes('/pagefind/'))
            indexRequests.push(request.url());
    });
    await page.goto(articlePath);
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: '搜索内容', exact: true });
    const input = dialog.getByRole('searchbox', { name: '搜索关键词' });
    await expect(input).toBeFocused();
    await input.press('Enter');
    await input.press('Tab');
    await expect(
        dialog.getByRole('button', { name: '关闭搜索' }),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(input).toBeFocused();
    await input.fill('   ');
    await expect(dialog.locator('[data-search-results]')).toHaveAttribute(
        'aria-busy',
        'false',
    );
    expect(indexRequests).toEqual([]);
    await input.fill('Markdown');
    await expect(
        dialog.getByRole('heading', { name: exampleTitle, exact: true }),
    ).toBeVisible();
    await input.fill('');
    await expect(dialog.getByRole('link')).toHaveCount(0);
    await input.fill('zzzxnonexistentcontent987');
    await expect(dialog.getByRole('status')).toContainText('没有找到');
    await expect(dialog.getByRole('link')).toHaveCount(0);
    await input.press('Enter');
    await expect(page).toHaveURL(`http://127.0.0.1:4399${articlePath}`);
    await expect(dialog).toBeVisible();
});

test('a query changed during a slow index load cannot render results for the old query', async ({
    page,
}) => {
    let releaseIndex!: () => void;
    const gate = new Promise<void>((resolve) => {
        releaseIndex = resolve;
    });
    await page.route('**/pagefind/pagefind.js', async (route) => {
        await gate;
        await route.continue();
    });
    try {
        await page.goto(articlePath);
        await page.keyboard.press('Control+k');
        const dialog = page.getByRole('dialog', {
            name: '搜索内容',
            exact: true,
        });
        const input = dialog.getByRole('searchbox', { name: '搜索关键词' });
        const pending = page.waitForRequest('**/pagefind/pagefind.js');
        await input.fill('Markdown');
        await pending;
        await input.fill('隐私');
        releaseIndex();
        await expect(
            dialog.getByRole('heading', { name: '隐私政策', exact: true }),
        ).toBeVisible();
        await expect(
            dialog.getByRole('heading', { name: exampleTitle, exact: true }),
        ).toHaveCount(0);
        await expect(dialog.locator('[data-search-results]')).toHaveAttribute(
            'aria-busy',
            'false',
        );
    } finally {
        releaseIndex();
    }
});

test('search can recover from a failed index download without reloading the page', async ({
    page,
}) => {
    let failDownload = true;
    await page.route('**/pagefind/pagefind.js*', async (route) => {
        if (failDownload) {
            failDownload = false;
            await route.abort('failed');
        } else await route.continue();
    });
    await page.goto(articlePath);
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: '搜索内容', exact: true });
    const input = dialog.getByRole('searchbox', { name: '搜索关键词' });
    await input.fill('Markdown');
    await expect(dialog.getByRole('status')).toContainText('暂时不可用');
    await expect(dialog.locator('[data-search-results]')).toHaveAttribute(
        'aria-busy',
        'false',
    );
    await input.fill('隐私');
    await expect(
        dialog.getByRole('heading', { name: '隐私政策', exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(`http://127.0.0.1:4399${articlePath}`);
});

test('a failed result fragment can be downloaded again for the same query', async ({
    page,
}) => {
    let failDownload = true;
    await page.route('**/pagefind/fragment/*.pf_fragment', async (route) => {
        if (failDownload) {
            failDownload = false;
            await route.abort('failed');
        } else await route.continue();
    });
    await page.goto(articlePath);
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: '搜索内容', exact: true });
    const input = dialog.getByRole('searchbox', { name: '搜索关键词' });
    await input.fill('Markdown');
    await expect(dialog.getByRole('status')).toContainText('暂时不可用');
    await input.press('Enter');
    await expect(
        dialog.getByRole('heading', { name: exampleTitle, exact: true }),
    ).toBeVisible();
    await expect(dialog.locator('[data-search-results]')).toHaveAttribute(
        'aria-busy',
        'false',
    );
});

test.describe('landscape mobile search', () => {
    test.use({ isMobile: true, hasTouch: true });
    for (const viewport of [
        { width: 844, height: 390 },
        { width: 667, height: 375 },
    ]) {
        test(`the first result remains readable at ${viewport.width} by ${viewport.height}`, async ({
            page,
        }) => {
            await page.setViewportSize(viewport);
            await page.goto(articlePath);
            await page
                .locator('.site-nav')
                .getByRole('button', { name: '搜索', exact: true })
                .click();
            const dialog = page.getByRole('dialog', {
                name: '搜索内容',
                exact: true,
            });
            await expect(dialog).toBeVisible();
            await dialog.getByRole('searchbox').fill('Markdown');
            const result = dialog.locator('a[href="/posts/format-example/"]');
            await expect(result).toBeVisible();
            expect(await dialog.boundingBox()).toEqual({
                x: 0,
                y: 0,
                ...viewport,
            });
            const region = await dialog
                .locator('.search-content')
                .boundingBox();
            for (const element of [result.locator('h3'), result.locator('p')]) {
                const box = await element.boundingBox();
                expect(box!.y).toBeGreaterThanOrEqual(region!.y);
                expect(box!.y + box!.height).toBeLessThanOrEqual(
                    region!.y + region!.height,
                );
            }
        });
    }
});
