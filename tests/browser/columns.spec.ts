import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
    createColumnsSite,
    longColumnName,
    hiddenColumnPosts,
} from '../fixtures/columns-site';

let site: Awaited<ReturnType<typeof createColumnsSite>>;
test.beforeAll(async () => {
    test.setTimeout(120_000);
    site = await createColumnsSite();
});
test.afterAll(async () => {
    await site?.close();
});

test('column navigation replaces reading progress with its name and public article position at the bottom', async ({
    page,
}) => {
    await page.goto(`${site.origin}/posts/p01/`);
    const card = page.locator('.article-side');
    const progress = card.getByRole('progressbar', { name: '文章阅读进度' });
    await expect(progress).toBeVisible();
    await card.getByRole('tab', { name: '专栏目录' }).click();
    await expect(progress).not.toBeVisible();
    const directory = card.getByRole('navigation', { name: '专栏目录' });
    const footer = directory.getByRole('link', { name: /手动示例/ });
    await expect(footer).toContainText('当前第 2 篇 · 共 3 篇');
    const lastArticle = await directory.locator('ol a').last().boundingBox();
    const footerBounds = await footer.boundingBox();
    expect(footerBounds!.y).toBeGreaterThanOrEqual(
        lastArticle!.y + lastArticle!.height,
    );
    await card.getByRole('button', { name: '展开文章目录' }).click();
    const dialog = page.locator('#article-toc-dialog');
    await expect(
        dialog.getByText('阅读进度', { exact: false }),
    ).not.toBeVisible();
    await expect(dialog.getByRole('link', { name: /手动示例/ })).toContainText(
        '当前第 2 篇 · 共 3 篇',
    );
    await dialog.getByRole('tab', { name: '本文目录' }).click();
    await expect(dialog.getByText('阅读进度', { exact: false })).toBeVisible();
    await page.keyboard.press('Escape');
    await directory.locator('ol a').last().click();
    await expect(page).toHaveURL(`${site.origin}/posts/p02/`);
    await card.getByRole('tab', { name: '专栏目录' }).click();
    await expect(footer).toContainText('当前第 3 篇 · 共 3 篇');
    await card.getByRole('tab', { name: '本文目录' }).click();
    await expect(progress).toBeVisible();
});

test('article navigation uses column membership on direct entry and preserves its public order', async ({
    page,
}) => {
    await page.goto(`${site.origin}/posts/p03/`);
    const card = page.locator('.article-side');
    await expect(card.getByRole('tab', { name: '本文目录' })).toHaveAttribute(
        'aria-selected',
        'true',
    );
    await card.getByRole('tab', { name: '专栏目录' }).click();
    const directory = card.getByRole('navigation', { name: '专栏目录' });
    await expect(
        directory.getByRole('link', { name: /手动示例/ }),
    ).toHaveAttribute('href', '/columns/manual/');
    const articles = directory.locator('ol a');
    expect(
        await articles.evaluateAll((links) =>
            links.map((link) => link.getAttribute('href')),
        ),
    ).toEqual(['/posts/p03/', '/posts/p01/', '/posts/p02/']);
    await expect(directory.locator('[aria-current="page"]')).toHaveAttribute(
        'href',
        '/posts/p03/',
    );
    await articles.nth(1).click();
    await expect(page).toHaveURL(`${site.origin}/posts/p01/`);
    await expect(card.getByRole('tab', { name: '本文目录' })).toHaveAttribute(
        'aria-selected',
        'true',
    );
    await card.getByRole('tab', { name: '本文目录' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(card.getByRole('tab', { name: '专栏目录' })).toBeFocused();
    await expect(directory.locator('[aria-current="page"]')).toHaveAttribute(
        'href',
        '/posts/p01/',
    );
});

test('non-column articles show their outline and standalone pages do not expose column tabs', async ({
    page,
}) => {
    await page.goto(`${site.origin}/posts/format-example/`);
    const card = page.locator('.article-side');
    await expect(card.getByRole('heading', { name: '文章目录' })).toBeVisible();
    await expect(card.getByRole('tab')).toHaveCount(0);
    await expect(
        card.getByRole('navigation', { name: '本文目录' }),
    ).toBeVisible();
    await page.locator('a[href="/pages/privacy/"]').first().click();
    await expect(page).toHaveURL(`${site.origin}/pages/privacy/`);
    await expect(
        page.getByRole('tab', { name: '专栏目录', includeHidden: true }),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: '发现文章' })).toHaveCount(0);
});

test('mobile column navigation opens the expanded directory on the selected tab', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${site.origin}/posts/p03/`);
    const inline = page.locator('.mobile-toc');
    await inline.locator('summary').click();
    await inline.getByRole('tab', { name: '专栏目录' }).click();
    const expand = inline.getByRole('button', { name: '打开大屏目录' });
    await expand.click();
    const dialog = page.locator('#article-toc-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('tab', { name: '专栏目录' })).toHaveAttribute(
        'aria-selected',
        'true',
    );
    await expect(
        dialog.getByRole('navigation', { name: '专栏目录' }).locator('ol a'),
    ).toHaveCount(3);
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
    ).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(expand).toBeFocused();
});

test('column paths are published without hidden references', async ({
    page,
    request,
}) => {
    const manifest = await (
        await request.get(`${site.origin}/content-manifest.json`)
    ).json();
    const paths = manifest.columns.map((entry: { path: string }) => entry.path);
    expect(paths).toContain('/columns/');
    expect(paths).toContain('/columns/manual/page/2/');
    expect(paths).toContain('/columns/%E6%95%99%E7%A8%8B/');
    await page.goto(`${site.origin}/sitemap/`);
    const group = page
        .locator('.sitemap-directory section')
        .filter({ has: page.getByRole('heading', { name: /^专栏/ }) });
    await expect(group.getByRole('link')).toHaveCount(11);
    expect(
        await group
            .getByRole('link')
            .evaluateAll((links) =>
                links.map((link) => link.getAttribute('href')),
            ),
    ).toEqual([
        '/columns/manual/',
        ...Array.from(
            { length: 9 },
            (_, index) => `/columns/empty-${index + 1}/`,
        ),
        '/columns/%E6%95%99%E7%A8%8B/',
    ]);
    const xml = await (
        await request.get(`${site.origin}/sitemap-0.xml`)
    ).text();
    expect(xml).toContain('/columns/manual/');
    expect(xml).toContain('/columns/manual/page/2/');
    const walk = (directory: string): string[] =>
        readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
            entry.isDirectory()
                ? walk(join(directory, entry.name))
                : [join(directory, entry.name)],
        );
    for (const file of walk(site.dist).filter((path) =>
        /\.(html|json|xml|js|css|svg|txt)$/u.test(path),
    )) {
        const text = readFileSync(file, 'utf8');
        for (const hidden of hiddenColumnPosts)
            expect(text, `Non-public content in ${file}`).not.toContain(hidden);
    }
});

test('overview uses the essay title style and shows the configured column count', async ({
    page,
}) => {
    await page.goto(`${site.origin}/moments/`);
    const essayTitleSize = await page
        .locator('.page-header h1')
        .evaluate((heading) => getComputedStyle(heading).fontSize);
    await page.goto(`${site.origin}/columns/`);
    await expect(page.locator('[data-columns-header] h1')).toHaveText(
        /^专栏\s*11$/,
    );
    await expect(page.locator('[data-columns-header] p')).toHaveText(
        '共 11 个专栏',
    );
    await expect(page.locator('[data-columns-header] h1 small')).toHaveText(
        '11',
    );
    await expect(page.locator('[data-columns-header] h1')).toHaveCSS(
        'font-size',
        essayTitleSize,
    );
    await expect(page.locator('[data-columns-header] img')).toHaveCount(0);
    await expect(
        page.locator('[data-column-overview="manual"] ol a'),
    ).toHaveText(['文章 p03', '文章 p01', '文章 p02']);
    await page.locator('[data-column-overview="manual"] ol a').first().click();
    await expect(page).toHaveURL(`${site.origin}/posts/p03/`);
});

test('detail information follows the switch and pagination preserves its manual sequence', async ({
    page,
}) => {
    await page.goto(`${site.origin}/columns/manual/`);
    await expect(page.locator('[data-columns-header] h1')).toHaveText(
        /^专栏：手动示例\s*3$/,
    );
    await expect(page.locator('[data-columns-header] h1 small')).toHaveText(
        '3',
    );
    await expect(page.locator('[data-column-info] h2')).toHaveText('手动示例');
    await expect(page.locator('[data-column-info] img')).toBeVisible();
    await expect(page.locator('[data-column-info]')).toContainText(
        '按手动顺序阅读。',
    );
    await expect(page.locator('.content-preview-heading h2')).toHaveText([
        '文章 p03',
        '文章 p01',
    ]);
    await page
        .getByRole('navigation', { name: '文章分页' })
        .getByRole('link', { name: '下一页' })
        .click();
    await expect(page).toHaveURL(`${site.origin}/columns/manual/page/2/`);
    await expect(page.locator('[data-columns-header] h1')).toHaveText(
        /^专栏：手动示例\s*3$/,
    );
    await expect(page.locator('[data-columns-header] h1 small')).toHaveText(
        '3',
    );
    await expect(page.locator('.content-preview-heading h2')).toHaveText([
        '文章 p02',
    ]);
    await expect(page.locator('[data-column-info] h2')).toHaveText('手动示例');
    await expect(
        page
            .locator('.desktop-nav')
            .getByRole('link', { name: '专栏', exact: true }),
    ).toHaveClass(/active/);
    await expect(
        page
            .getByRole('navigation', { name: '专栏切换' })
            .getByRole('link', { name: /手动示例/ }),
    ).toHaveAttribute('aria-current', 'page');
});

test('more columns expands for its current item and empty columns keep their public introduction', async ({
    page,
}) => {
    await page.goto(`${site.origin}/columns/${encodeURIComponent('教程')}/`);
    await expect(
        page.getByRole('navigation', { name: '专栏切换' }).locator('details'),
    ).toHaveAttribute('open', '');
    await expect(page.locator('[data-column-info] h2')).toHaveText(
        longColumnName,
    );
    await expect(page.locator('[data-column-info]')).toContainText(
        '<strong>介绍</strong>',
    );
    await expect(page.locator('[data-column-info] strong')).toHaveCount(0);
    await page.goto(`${site.origin}/columns/empty-1/`);
    await expect(page.locator('[data-columns-header] h1 small')).toHaveText(
        '0',
    );
    await expect(page.locator('[data-column-info] h2')).toHaveText('空专栏 1');
    await expect(page.locator('main')).toContainText('暂无已公开文章');
});

for (const mode of ['light', 'dark'] as const) {
    test(`mobile navigation visibly selects the column section in ${mode}`, async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.addInitScript(
            (theme) => localStorage.setItem('sky-theme', theme),
            mode,
        );
        for (const path of ['/columns/manual/', '/columns/manual/page/2/']) {
            await page.goto(`${site.origin}${path}`);
            await page.locator('[data-menu-toggle]').click();
            const menu = page.getByRole('dialog', { name: '移动端导航' });
            const selected = menu.getByRole('link', {
                name: '专栏',
                exact: true,
            });
            const inactive = menu.getByRole('link', {
                name: '随笔',
                exact: true,
            });
            await expect(selected).toHaveAttribute('aria-current', 'location');
            const selectedBackground = await selected.evaluate(
                (link) => getComputedStyle(link).backgroundColor,
            );
            const inactiveBackground = await inactive.evaluate(
                (link) => getComputedStyle(link).backgroundColor,
            );
            expect(selectedBackground).not.toBe(inactiveBackground);
        }
    });
}

for (const width of [390, 1440])
    for (const mode of ['light', 'dark'] as const) {
        test(`column information remains readable at ${width}px in ${mode}`, async ({
            page,
        }) => {
            await page.setViewportSize({ width, height: 900 });
            await page.addInitScript(
                (theme) => localStorage.setItem('sky-theme', theme),
                mode,
            );
            await page.goto(
                `${site.origin}/columns/${encodeURIComponent('教程')}/`,
            );
            await expect(page.locator('html')).toHaveAttribute(
                'data-theme',
                mode,
            );
            await expect
                .poll(() =>
                    page
                        .locator('[data-column-info] img')
                        .evaluate(
                            (image: HTMLImageElement) => image.naturalWidth,
                        ),
                )
                .toBeGreaterThan(0);
            const layout = await page
                .locator('[data-column-info]')
                .evaluate((info) => {
                    const controls = document.querySelector('.columns-switch')!;
                    const article = document.querySelector(
                        '.content-preview-card',
                    )!;
                    const bounds = info.getBoundingClientRect();
                    return {
                        followsControls:
                            bounds.top >=
                            controls.getBoundingClientRect().bottom,
                        precedesArticles:
                            bounds.bottom <=
                            article.getBoundingClientRect().top,
                        background: getComputedStyle(info).backgroundColor,
                        articleBackground:
                            getComputedStyle(article).backgroundColor,
                        accentWidth:
                            getComputedStyle(info).borderInlineStartWidth,
                    };
                });
            expect(layout.followsControls).toBe(true);
            expect(layout.precedesArticles).toBe(true);
            expect(layout.background).toBe(layout.articleBackground);
            expect(layout.accentWidth).toBe('4px');
            expect(
                await page.evaluate(
                    () =>
                        document.documentElement.scrollWidth <=
                        window.innerWidth,
                ),
            ).toBe(true);
            if (width === 390) {
                await page.locator('[data-menu-toggle]').click();
                await expect(
                    page
                        .getByRole('dialog', { name: '移动端导航' })
                        .getByRole('link', { name: '专栏', exact: true }),
                ).toHaveAttribute('aria-current', 'location');
            }
        });
    }

test('column switches and article directories work without JavaScript', async ({
    browser,
}) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
        const page = await context.newPage();
        await page.goto(`${site.origin}/columns/`);
        await page
            .getByRole('navigation', { name: '专栏切换' })
            .getByRole('link', { name: /手动示例/ })
            .click();
        await expect(page).toHaveURL(`${site.origin}/columns/manual/`);
        await page.locator('.content-preview-heading h2 a').first().click();
        await expect(page).toHaveURL(`${site.origin}/posts/p03/`);
    } finally {
        await context.close();
    }
});

test('missing columns and out-of-range pages return 404', async ({
    request,
}) => {
    for (const path of ['/columns/missing/', '/columns/manual/page/99/'])
        expect((await request.get(`${site.origin}${path}`)).status()).toBe(404);
});

test('empty configuration keeps the overview title and empty state reachable', async ({
    page,
}) => {
    test.setTimeout(120_000);
    const empty = await createColumnsSite({ empty: true });
    try {
        await page.goto(`${empty.origin}/columns/`);
        await expect(page.locator('[data-columns-header] h1')).toHaveText(
            /^专栏\s*0$/,
        );
        await expect(page.locator('[data-columns-header] p')).toHaveText(
            '共 0 个专栏',
        );
        await expect(page.locator('[data-columns-header] h1 small')).toHaveText(
            '0',
        );
        await expect(page.locator('main')).toContainText('还没有专栏');
    } finally {
        await empty.close();
    }
});
