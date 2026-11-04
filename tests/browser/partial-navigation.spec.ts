import { expect, test, type Page } from '@playwright/test';
import { Buffer } from 'node:buffer';

const article = '/posts/format-example/';
const shellSelectors = [
    'body',
    'main',
    '.site-nav',
    '#mobile-navigation',
    '.site-footer',
    '.sky-dock',
    '#search-dialog',
    '#image-lightbox',
    '[data-site-background]',
    '[data-page-loading]',
];

async function rememberShell(page: Page) {
    await page.evaluate((selectors) => {
        const scope = window as Window & { shellNodes?: (Element | null)[] };
        scope.shellNodes = selectors.map((selector) =>
            document.querySelector(selector),
        );
    }, shellSelectors);
}

async function expectSameShell(page: Page) {
    expect(
        await page.evaluate((selectors) => {
            const scope = window as Window & {
                shellNodes?: (Element | null)[];
            };
            return selectors.filter(
                (selector, index) =>
                    document.querySelector(selector) !==
                    scope.shellNodes![index],
            );
        }, shellSelectors),
    ).toEqual([]);
}

async function navigate(page: Page, path: string) {
    await page.evaluate((href) => {
        const anchor = document.createElement('a');
        anchor.href = href;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
    }, path);
    await expect(page).toHaveURL(new URL(path, 'http://127.0.0.1:4399').href);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
}

test('client navigation keeps the public DOM and updates page metadata and controls', async ({
    page,
}) => {
    await page.goto('/archives/');
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await rememberShell(page);
    for (const path of [article, '/links/', '/', article, '/archives/']) {
        await navigate(page, path);
        await expectSameShell(page);
        expect(
            await page.locator('link[rel="canonical"]').getAttribute('href'),
        ).toBe(`https://example.com${path}`);
        await expect(page.locator('[data-open-article-posts]')).toHaveCount(
            path === article ? 1 : 0,
        );
        if (path === article) {
            await expect(page.locator('.article-heading h1')).toHaveText(
                'Markdown 与 MDX 格式示例',
            );
            await page.locator('.dock-discover').click();
            await expect(page.locator('#article-posts-dialog')).toBeVisible();
            await page.keyboard.press('Escape');
        }
        if (path === '/links/') {
            await expect(
                page.locator('.desktop-nav a[href="/links/"]'),
            ).toHaveAttribute('aria-current', 'page');
        }
        await page.locator('.site-nav [data-theme-toggle]').click();
        await expect(page.locator('html')).toHaveAttribute(
            'data-theme',
            'dark',
        );
        await page.locator('.site-nav [data-theme-toggle]').click();
        await expect(page.locator('html')).toHaveAttribute(
            'data-theme',
            'light',
        );
    }
});

test('search state and mobile navigation survive a page swap without a scroll lock', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/archives/');
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await rememberShell(page);
    await page.locator('.site-nav [data-open-search]').click();
    await page.locator('[data-search-input]').fill('格式');
    await expect(page.locator('[data-search-status]')).toContainText('找到');
    await page.locator('#search-dialog .search-result').first().click();
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await expect(page.locator('#search-dialog')).not.toBeVisible();
    await expectSameShell(page);
    await page.locator('.site-nav [data-open-search]').click();
    await expect(page.locator('[data-search-input]')).toHaveValue('格式');
    await page.keyboard.press('Escape');
    await page.locator('[data-menu-toggle]').click();
    await expect(page.locator('#mobile-navigation')).toBeVisible();
    await page.locator('#mobile-navigation a[href="/links/"]').click();
    await expect(page).toHaveURL('http://127.0.0.1:4399/links/');
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expectSameShell(page);
    await expect(
        page.locator('#mobile-navigation a[href="/links/"]'),
    ).toHaveAttribute('aria-current', 'page');
    expect(
        await page
            .locator('html')
            .evaluate((node) => getComputedStyle(node).overflowY),
    ).not.toBe('hidden');
});

test('unchanged listing headers and filter links retain their nodes', async ({
    page,
}) => {
    await page.goto('/categories/development/');
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await page.evaluate(() => {
        const scope = window as Window & { filterLink?: Element | null };
        scope.filterLink = document.querySelector(
            'main a[href="/categories/life/"]',
        );
    });
    await page.locator('main a[href="/categories/life/"]').click();
    await expect(page).toHaveURL('http://127.0.0.1:4399/categories/life/');
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    expect(
        await page.evaluate(() => {
            const scope = window as Window & { filterLink?: Element | null };
            return (
                document.querySelector('main a[href="/categories/life/"]') ===
                scope.filterLink
            );
        }),
    ).toBe(true);
    await expect(page.locator('main h1')).toContainText('life');
});

test('history and article anchors keep the public shell and working page controls', async ({
    page,
}) => {
    await page.goto('/archives/');
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await rememberShell(page);
    await navigate(page, article);
    const tocLink = page.locator('.article-side [data-toc-link]').last();
    const hash = await tocLink.getAttribute('href');
    await tocLink.click();
    await expect(page).toHaveURL(
        new URL(hash!, `http://127.0.0.1:4399${article}`).href,
    );
    await expectSameShell(page);
    await navigate(page, '/links/');
    await page.goBack();
    await expect(page).toHaveURL(
        new URL(hash!, `http://127.0.0.1:4399${article}`).href,
    );
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await expectSameShell(page);
    // The restored bottom anchor intentionally hides Dock while the footer is visible.
    await page.locator('.article-heading').scrollIntoViewIfNeeded();
    await page.locator('.dock-discover').click();
    await expect(page.locator('#article-posts-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.goForward();
    await expect(page).toHaveURL('http://127.0.0.1:4399/links/');
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await expectSameShell(page);
    await expect(page.locator('[data-open-article-posts]')).toHaveCount(0);
});

test('client navigation initializes article media and declarative shadow roots', async ({
    page,
}) => {
    const wav = Buffer.alloc(44 + 8000, 128);
    wav.write('RIFF', 0);
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(8000, 24);
    wav.writeUInt32LE(8000, 28);
    wav.writeUInt16LE(1, 32);
    wav.writeUInt16LE(8, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(8000, 40);
    await page.route('**/navigation-audio.wav', (route) =>
        route.fulfill({ contentType: 'audio/wav', body: wav }),
    );
    await page.route(
        /\/posts\/(?:format-example|standalone-example)\/$/,
        async (route) => {
            const response = await route.fetch();
            const label = route.request().url().includes('standalone-example')
                ? '独立文章组件'
                : '文章组件';
            await route.fulfill({
                response,
                body: (await response.text()).replace(
                    '</main>',
                    `<section id="navigation-shadow"><template shadowrootmode="open"><p>${label}</p></template></section><audio id="navigation-audio" data-astro-transition-persist="navigation-audio" controls preload="auto" src="/navigation-audio.wav"></audio></main>`,
                ),
            });
        },
    );
    const expectContentReady = (shadow = '文章组件') =>
        expect
            .poll(() =>
                page.evaluate(() => {
                    const audio =
                        document.querySelector<HTMLAudioElement>(
                            '#navigation-audio',
                        );
                    return {
                        shadow: document.querySelector('#navigation-shadow')
                            ?.shadowRoot?.textContent,
                        duration: audio?.duration,
                    };
                }),
            )
            .toEqual({ shadow, duration: 1 });
    // Establish that the same rendered HTML and audio work on direct entry.
    await page.goto(article);
    await expectContentReady();
    await page.goto('/archives/');
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await rememberShell(page);
    await navigate(page, article);
    await expectContentReady();
    await expectSameShell(page);
    await page.evaluate(() => {
        const scope = window as Window & { navigationAudio?: HTMLAudioElement };
        scope.navigationAudio =
            document.querySelector<HTMLAudioElement>('#navigation-audio')!;
        scope.navigationAudio.volume = 0.4;
    });
    await expect(page.locator('#navigation-audio')).toHaveJSProperty(
        'volume',
        0.4,
    );
    await navigate(page, '/posts/standalone-example/');
    await expectContentReady('独立文章组件');
    expect(
        await page.evaluate(() => {
            const scope = window as Window & {
                navigationAudio?: HTMLAudioElement;
            };
            return (
                document.querySelector('#navigation-audio') ===
                scope.navigationAudio
            );
        }),
    ).toBe(true);
    await expect(page.locator('#navigation-audio')).toHaveJSProperty(
        'volume',
        0.4,
    );
    await expectSameShell(page);
});
