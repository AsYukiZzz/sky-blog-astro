import { expect, test } from '@playwright/test';
import { createColumnsSite } from '../fixtures/columns-site';

const articlePath = '/posts/format-example/';
const previewName = '查看图片：远山与傍晚的光';

for (const height of [600, 900]) {
    test(`short article and column directories fill the right sidebar at ${height}px height`, async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1280, height });
        await page.goto(articlePath);
        const card = page.getByRole('region', { name: '阅读导航' });
        await card.getByRole('tab', { name: '专栏目录' }).click();
        const columnBounds = await card.boundingBox();
        expect(columnBounds!.height).toBeGreaterThan(height * 0.8);
        await card.getByRole('tab', { name: '本文目录' }).click();
        expect((await card.boundingBox())!.height).toBeCloseTo(
            columnBounds!.height,
            0,
        );
        const response = await page.goto('/posts/standalone-example/');
        expect(response?.status()).toBe(200);
        await expect(card.getByRole('tab')).toHaveCount(0);
        await expect(
            card.getByRole('navigation', { name: '本文目录' }),
        ).toBeVisible();
        expect((await card.boundingBox())!.height).toBeCloseTo(
            columnBounds!.height,
            0,
        );
    });
}

test('article discovery opens from the Dock and remains available after client navigation', async ({
    page,
}) => {
    await page.goto(articlePath);
    const side = page.locator('.article-side');
    await expect(side.getByRole('tab', { name: '最新文章' })).toHaveCount(0);
    await expect(side.getByRole('tab', { name: '热门文章' })).toHaveCount(0);
    const discover = page
        .locator('.sky-dock')
        .getByRole('button', { name: '发现文章' });
    await discover.click();
    const dialog = page.getByRole('dialog', { name: '文章推荐' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('tab', { name: /最新文章/ })).toHaveAttribute(
        'aria-selected',
        'true',
    );
    await expect(
        dialog.getByRole('tabpanel').getByRole('link'),
    ).not.toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(discover).toBeFocused();
    await page.locator('.site-nav a[href="/"]').first().click();
    await expect(
        page.locator('.sky-dock').getByRole('button', { name: '发现文章' }),
    ).toHaveCount(0);
    await page.goBack();
    await discover.click();
    await expect(dialog).toBeVisible();
});

test('enabled footer recommendations switch article lists inline and keep their selection independent of the Dock dialog', async ({
    page,
}) => {
    test.setTimeout(120_000);
    const site = await createColumnsSite({
        recommendations: { enabled: true, maxItems: 2 },
    });
    try {
        await page.goto(`${site.origin}${articlePath}`);
        const footer = page.getByRole('region', {
            name: '继续阅读',
            exact: true,
        });
        const popular = footer.getByRole('tab', {
            name: '热门文章',
            exact: true,
        });
        const latest = footer.getByRole('tab', {
            name: '最新文章',
            exact: true,
        });
        const panel = footer.getByRole('tabpanel');
        await expect(popular).toHaveAttribute('aria-selected', 'true');
        await expect(panel.getByRole('link')).toHaveCount(1);
        await expect(panel.getByRole('link')).toHaveAttribute(
            'href',
            articlePath,
        );
        await latest.click();
        await expect(latest).toHaveAttribute('aria-selected', 'true');
        await expect(popular).toHaveAttribute('aria-selected', 'false');
        await expect(panel.getByRole('link')).toHaveCount(2);
        await expect(panel.getByRole('link').first()).toHaveAttribute(
            'href',
            '/posts/standalone-example/',
        );
        const dialog = page.getByRole('dialog', { name: '文章推荐' });
        await expect(dialog).not.toBeVisible();
        await latest.press('ArrowLeft');
        await expect(popular).toBeFocused();
        await expect(popular).toHaveAttribute('aria-selected', 'true');
        await expect(panel.getByRole('link')).toHaveCount(1);
        await popular.press('ArrowRight');
        await expect(latest).toBeFocused();
        await expect(panel.getByRole('link')).toHaveCount(2);
        await page.locator('.article-heading').scrollIntoViewIfNeeded();
        await page
            .locator('.sky-dock')
            .getByRole('button', { name: '发现文章' })
            .click();
        await dialog.getByRole('tab', { name: /热门文章/ }).click();
        await page.keyboard.press('Escape');
        await expect(latest).toHaveAttribute('aria-selected', 'true');
        await expect(panel.getByRole('link')).toHaveCount(2);
        await panel.getByRole('link').first().click();
        await expect(page).toHaveURL(
            `${site.origin}/posts/standalone-example/`,
        );
        await footer
            .getByRole('tab', { name: '最新文章', exact: true })
            .click();
        await expect(panel.getByRole('link').first()).toHaveAttribute(
            'href',
            '/posts/standalone-example/',
        );
        await page.setViewportSize({ width: 320, height: 740 });
        await expect(panel.getByRole('link')).toHaveCount(2);
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBe(true);
    } finally {
        await site.close();
    }
});

test('mobile article discovery remains reachable without horizontal overflow', async ({
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto(articlePath);
    await page
        .locator('.sky-dock')
        .getByRole('button', { name: '发现文章' })
        .click();
    const dialog = page.getByRole('dialog', { name: '文章推荐' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('tab', { name: /热门文章/ }).click();
    await expect(dialog.getByRole('tab', { name: /热门文章/ })).toHaveAttribute(
        'aria-selected',
        'true',
    );
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
    ).toBe(true);
    await page.keyboard.press('Escape');
    await expect(
        page.getByRole('region', {
            name: '继续阅读',
            exact: true,
            includeHidden: true,
        }),
    ).toHaveCount(0);
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
    ).toBe(true);
});

test('a Markdown image opens with Enter and Space and restores focus after Escape', async ({
    page,
}) => {
    await page.goto(articlePath);
    const button = page.getByRole('button', { name: previewName, exact: true });
    await expect(button).toHaveCount(1);
    for (const key of ['Enter', 'Space']) {
        await button.focus();
        await page.keyboard.press(key);
        const dialog = page.getByRole('dialog', { name: '图片预览' });
        await expect(dialog).toBeVisible();
        await expect(dialog.locator('img')).toHaveAttribute(
            'alt',
            '远山与傍晚的光',
        );
        await page.keyboard.press('Escape');
        await expect(dialog).not.toBeVisible();
        await expect(button).toBeFocused();
    }
});

test('tall viewports report full reading progress at the end of the document', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 1440 });
    await page.goto(articlePath);
    await page.evaluate(async () => {
        await document.fonts.ready;
        window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: 'instant',
        });
    });
    await expect(page.locator('[data-reading-percent]').first()).toHaveText(
        '100%',
    );
    await expect(page.locator('[data-reading-meter]').first()).toHaveAttribute(
        'aria-valuenow',
        '100',
    );
});

test('client navigation and history preserve theme and do not duplicate image controls', async ({
    page,
}) => {
    await page.addInitScript(() => localStorage.setItem('sky-theme', 'dark'));
    await page.goto(articlePath);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(
        page.getByRole('button', { name: previewName, exact: true }),
    ).toHaveCount(1);
    await page.evaluate(() => {
        (window as Window & { navigationMarker?: string }).navigationMarker =
            'same-document';
    });
    await page.locator('.site-nav a[href="/"]').first().click();
    await expect(page).toHaveURL('http://127.0.0.1:4399/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(
        await page.evaluate(
            () =>
                (window as Window & { navigationMarker?: string })
                    .navigationMarker,
        ),
    ).toBe('same-document');
    await page.goBack();
    await expect(page).toHaveURL(`http://127.0.0.1:4399${articlePath}`);
    const button = page.getByRole('button', { name: previewName, exact: true });
    await expect(button).toHaveCount(1);
    await button.focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('dialog', { name: '图片预览' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(button).toBeFocused();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('images already inside a link retain their link without nested preview buttons', async ({
    page,
}) => {
    await page.addInitScript(() => {
        document.addEventListener(
            'astro:page-load',
            () => {
                const article = document.getElementById('article-content');
                if (!article) return;
                const anchor = document.createElement('a');
                anchor.id = 'linked-image-fixture';
                anchor.href = '/images/dusk.svg';
                const image = document.createElement('img');
                image.src = '/images/dusk.svg';
                image.alt = '链接图片';
                anchor.append(image);
                article.append(anchor);
            },
            { once: true, capture: true },
        );
    });
    await page.goto(articlePath);
    await expect(
        page.getByRole('button', { name: previewName, exact: true }),
    ).toHaveCount(1);
    await expect(page.locator('#linked-image-fixture')).toHaveAttribute(
        'href',
        '/images/dusk.svg',
    );
    await expect(page.locator('#linked-image-fixture button')).toHaveCount(0);
    await page.locator('#linked-image-fixture').click();
    await expect(page).toHaveURL('http://127.0.0.1:4399/images/dusk.svg');
});

for (const [stored, systemScheme] of [
    ['night', 'light'],
    ['cupcake', 'dark'],
] as const) {
    test(`removed ${stored} theme falls back to the ${systemScheme} system scheme`, async ({
        page,
    }) => {
        await page.emulateMedia({ colorScheme: systemScheme });
        await page.addInitScript(
            (name) => localStorage.setItem('sky-theme', name),
            stored,
        );
        await page.goto(articlePath);
        await expect(page.locator('html')).toHaveAttribute(
            'data-theme',
            systemScheme,
        );
        await expect(page.locator('html')).toHaveAttribute(
            'data-color-scheme',
            systemScheme,
        );
    });
}

for (const [scheme, next] of [
    ['light', 'dark'],
    ['dark', 'light'],
] as const) {
    test(`${scheme} theme switches to ${next} and saves the choice`, async ({
        page,
    }) => {
        await page.addInitScript((name) => {
            if (!localStorage.getItem('sky-theme'))
                localStorage.setItem('sky-theme', name);
        }, scheme);
        await page.goto(articlePath);
        await expect(page.locator('html')).toHaveAttribute(
            'data-theme',
            scheme,
        );
        await expect(
            page.locator('[data-theme-picker], #theme-picker'),
        ).toHaveCount(0);
        await expect(
            page.getByRole('button', { name: previewName, exact: true }),
        ).toHaveCount(1);
        await page.locator('[data-theme-toggle]').first().click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', next);
        await expect(page.locator('html')).toHaveAttribute(
            'data-color-scheme',
            next,
        );
        expect(
            await page.evaluate(() => localStorage.getItem('sky-theme')),
        ).toBe(next);
        await page.reload();
        await expect(page.locator('html')).toHaveAttribute('data-theme', next);
        await page.locator('.sky-dock [data-theme-toggle]').click();
        await expect(page.locator('html')).toHaveAttribute(
            'data-theme',
            scheme,
        );
        expect(
            await page.evaluate(() => localStorage.getItem('sky-theme')),
        ).toBe(scheme);
    });
}
