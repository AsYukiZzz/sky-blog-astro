import { expect, test } from '@playwright/test';

const articlePath = '/posts/format-example/';
const previewName = '查看图片：远山与傍晚的光';

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
    await page.addInitScript(() => localStorage.setItem('sky-theme', 'night'));
    await page.goto(articlePath);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
    await expect(
        page.getByRole('button', { name: previewName, exact: true }),
    ).toHaveCount(1);
    await page.evaluate(() => {
        (window as Window & { navigationMarker?: string }).navigationMarker =
            'same-document';
    });
    await page.locator('.site-nav a[href="/"]').first().click();
    await expect(page).toHaveURL('http://127.0.0.1:4399/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
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
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
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

test('an invalid persisted theme falls back to a valid light palette before use', async ({
    page,
}) => {
    await page.addInitScript(() =>
        localStorage.setItem('sky-theme', 'removed-palette'),
    );
    await page.goto(articlePath);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('html')).toHaveAttribute(
        'data-color-scheme',
        'light',
    );
});
