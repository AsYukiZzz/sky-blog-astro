import { expect, test, type Page } from '@playwright/test';
import { createBackgroundSite } from '../fixtures/site-background';

const assets = 'https://twikoo-assets.example.test/dist/';
const article = '/posts/format-example/';
const other = '/posts/standalone-example/';
let site: Awaited<ReturnType<typeof createBackgroundSite>>;

type CommentWindow = Window & {
    twikooCalls?: {
        el: string;
        path: string;
        envId: string;
        lang: string;
        region?: string;
    }[];
    twikooHold?: boolean;
    twikooRelease?: () => void;
    twikooFailOnce?: boolean;
    twikooMaxActive?: number;
    rememberedComments?: Element | null;
};

const sdk = `
window.twikooCalls = [];
window.twikooActive = 0;
window.twikooMaxActive = 0;
window.twikoo = {init: async function(options) {
    window.twikooCalls.push(options);
    window.twikooActive++;
    window.twikooMaxActive = Math.max(window.twikooActive, window.twikooMaxActive);
    try {
        if (options.lang === 'ja' || options.lang === 'ja-JP') await import(new URL('locales/ja-JP.js', options.localeBaseUrl).href);
        if (window.twikooHold) await new Promise(resolve => {
            window.twikooRelease = () => { window.twikooHold = false; resolve(); };
        });
        if (window.twikooFailOnce) { window.twikooFailOnce = false; throw new Error('init failed'); }
        const mount = document.querySelector(options.el);
        if (!mount) return;
        mount.innerHTML = '<div class="twikoo"><div class="tk-comments"><div class="tk-submit"><div class="tk-meta-input"><div class="tk-input"><input class="tk-input__inner" placeholder="昵称"></div></div><textarea class="tk-textarea__inner" aria-label="评论内容"></textarea><button class="tk-button tk-button--primary">发送</button></div><div class="tk-content"><a></a><img></div></div><div class="tk-admin-container"><div class="tk-admin"></div></div></div>';
        mount.firstElementChild.dataset.path = options.path;
        mount.querySelector('a').textContent = 'https://example.com/' + 'long'.repeat(100);
        mount.querySelector('a').href = 'https://example.com/';
        mount.querySelector('img').src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1024"/>');
    } finally { window.twikooActive--; }
}};
`;

async function mockResources(
    page: Page,
    options: { failScriptOnce?: boolean; scriptGate?: Promise<void> } = {},
) {
    const count = { script: 0, css: 0 };
    await page.route(`${assets}**`, async (route) => {
        if (route.request().url().endsWith('.css')) {
            count.css++;
            return route.fulfill({
                contentType: 'text/css',
                body: '.twikoo{position:relative}.tk-meta-input{display:flex;flex-direction:column}.tk-input{display:inline-flex}.tk-input__inner{height:32px}.tk-textarea__inner{color:#333;background:#fff;border:1px solid #ddd}.tk-admin-container{position:absolute;inset:0;pointer-events:none}.tk-admin{opacity:0}',
            });
        }
        count.script++;
        if (options.failScriptOnce && count.script === 1)
            return route.abort('failed');
        if (options.scriptGate) await options.scriptGate;
        return route.fulfill({ contentType: 'text/javascript', body: sdk });
    });
    return count;
}

async function navigate(page: Page, path: string) {
    await page.evaluate((href) => {
        const link = document.createElement('a');
        link.href = href;
        document.body.append(link);
        link.click();
        link.remove();
    }, path);
    await expect(page).toHaveURL(`${site.origin}${path}`);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
}

async function reveal(page: Page) {
    const root = page.locator('[data-comments]');
    await root.scrollIntoViewIfNeeded();
    await expect(root).toHaveAttribute('data-comment-state', 'ready');
    return root;
}

test.beforeAll(async () => {
    test.setTimeout(120_000);
    site = await createBackgroundSite({
        comment: {
            enabled: true,
            twikoo: {
                envId: 'https://comments.example.test/api/',
                assetBaseUrl: assets,
            },
        },
    });
});

test.afterAll(async () => {
    await site?.close();
});

test('resources wait for the comment viewport and do not block page loading', async ({
    page,
}) => {
    const count = await mockResources(page);
    await page.goto(`${site.origin}/archives/`);
    expect(count).toEqual({ script: 0, css: 0 });
    await navigate(page, article);
    await expect(page.locator('[data-comments]')).toHaveAttribute(
        'data-comment-state',
        'waiting',
    );
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    expect(count).toEqual({ script: 0, css: 0 });
    await reveal(page);
    expect(count).toEqual({ script: 1, css: 1 });
    expect(
        await page.evaluate(() =>
            (window as CommentWindow).twikooCalls?.map((call) => ({
                path: call.path,
                lang: call.lang,
                region: call.region,
            })),
        ),
    ).toEqual([
        { path: '/posts/format-example', lang: 'zh-CN', region: undefined },
    ]);
});

test('query, hash, duplicate events and theme changes preserve the active form', async ({
    page,
}) => {
    await mockResources(page);
    await page.goto(`${site.origin}${article}`);
    await reveal(page);
    await page.getByRole('textbox', { name: '评论内容' }).fill('保留这段输入');
    await page.evaluate(() => {
        (window as CommentWindow).rememberedComments =
            document.querySelector('[data-comments]');
    });
    await navigate(page, `${article}?from=home#comments`);
    await page.evaluate(() =>
        document.dispatchEvent(new Event('astro:page-load')),
    );
    await expect(page.getByRole('textbox', { name: '评论内容' })).toHaveValue(
        '保留这段输入',
    );
    expect(
        await page.evaluate(
            () =>
                (window as CommentWindow).rememberedComments ===
                document.querySelector('[data-comments]'),
        ),
    ).toBe(true);
    await page.locator('.site-nav [data-theme-toggle]').click();
    await expect(page.getByRole('textbox', { name: '评论内容' })).toHaveValue(
        '保留这段输入',
    );
    expect(
        await page.evaluate(
            () => (window as CommentWindow).twikooCalls?.length,
        ),
    ).toBe(1);
});

test('navigation and history use distinct article mounts while keeping loaded resources', async ({
    page,
}) => {
    const count = await mockResources(page);
    await page.goto(`${site.origin}${article}`);
    await reveal(page);
    await page.getByRole('textbox', { name: '评论内容' }).fill('只属于文章 A');
    const firstId = await page
        .locator('[data-comment-mount]')
        .getAttribute('id');
    await navigate(page, other);
    await reveal(page);
    await expect(page.locator('.twikoo')).toHaveAttribute(
        'data-path',
        '/posts/standalone-example',
    );
    await expect(page.getByRole('textbox', { name: '评论内容' })).toHaveValue(
        '',
    );
    expect(
        await page.locator('[data-comment-mount]').getAttribute('id'),
    ).not.toBe(firstId);
    await page.goBack();
    await expect(page).toHaveURL(`${site.origin}${article}`);
    await reveal(page);
    await expect(page.locator('.twikoo')).toHaveAttribute(
        'data-path',
        '/posts/format-example',
    );
    await navigate(page, '/archives/');
    await expect(page.locator('[data-comments]')).toHaveCount(0);
    await navigate(page, other);
    await reveal(page);
    expect(count).toEqual({ script: 1, css: 1 });
    await expect(page.locator('[data-comment-assets] link')).toHaveCount(1);
});

test('leaving while resources load discards the old mount and reuses the completed download', async ({
    page,
}) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    const count = await mockResources(page, { scriptGate: gate });
    await page.goto(`${site.origin}${article}`);
    await page.locator('[data-comments]').scrollIntoViewIfNeeded();
    await expect.poll(() => count.script).toBe(1);
    await navigate(page, '/archives/');
    release();
    await expect(page.locator('[data-comment-assets] script')).toHaveCount(1);
    await navigate(page, other);
    await reveal(page);
    expect(
        await page.evaluate(() =>
            (window as CommentWindow).twikooCalls?.map((call) => call.path),
        ),
    ).toEqual(['/posts/standalone-example']);
    expect(count).toEqual({ script: 1, css: 1 });
});

test('an in-flight SDK initialization cannot race the next article', async ({
    page,
}) => {
    await page.addInitScript(() => {
        (window as CommentWindow).twikooHold = true;
    });
    await mockResources(page);
    await page.goto(`${site.origin}${article}`);
    await page.locator('[data-comments]').scrollIntoViewIfNeeded();
    await expect
        .poll(() =>
            page.evaluate(() => (window as CommentWindow).twikooCalls?.length),
        )
        .toBe(1);
    await navigate(page, other);
    await page.locator('[data-comments]').scrollIntoViewIfNeeded();
    await page.evaluate(() => (window as CommentWindow).twikooRelease?.());
    await reveal(page);
    await expect(page.locator('.twikoo')).toHaveAttribute(
        'data-path',
        '/posts/standalone-example',
    );
    expect(
        await page.evaluate(() => (window as CommentWindow).twikooMaxActive),
    ).toBe(1);
});

test('a failed script can retry without downloading the successful stylesheet twice', async ({
    page,
}) => {
    const count = await mockResources(page, { failScriptOnce: true });
    await page.goto(`${site.origin}${article}`);
    await page.locator('[data-comments]').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-comments]')).toHaveAttribute(
        'data-comment-state',
        'error',
    );
    await page.getByRole('button', { name: '重新加载评论' }).click();
    await reveal(page);
    expect(count).toEqual({ script: 2, css: 1 });
});

test('a rejected initialization can retry with the already loaded SDK', async ({
    page,
}) => {
    await page.addInitScript(() => {
        (window as CommentWindow).twikooFailOnce = true;
    });
    const count = await mockResources(page);
    await page.goto(`${site.origin}${article}`);
    await page.locator('[data-comments]').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-comments]')).toHaveAttribute(
        'data-comment-state',
        'error',
    );
    await page.getByRole('button', { name: '重新加载评论' }).click();
    await reveal(page);
    expect(count).toEqual({ script: 1, css: 1 });
    expect(
        await page.evaluate(
            () => (window as CommentWindow).twikooCalls?.length,
        ),
    ).toBe(2);
});

test('theme and narrow viewports keep the form usable without reinitializing', async ({
    page,
}) => {
    await mockResources(page);
    await page.goto(`${site.origin}${article}`);
    await reveal(page);
    const input = page.getByRole('textbox', { name: '评论内容' });
    await expect(page.locator('.tk-admin-container')).toHaveCSS(
        'background-color',
        'rgba(0, 0, 0, 0)',
    );
    await input.fill('随主题保留');
    for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 800 });
        expect(
            await page
                .locator('.tk-meta-input .tk-input')
                .evaluate((element) => element.getBoundingClientRect().height),
        ).toBeLessThan(64);
        for (const scheme of ['dark', 'light']) {
            await page.evaluate((scheme) => {
                document.documentElement.dataset.colorScheme = scheme;
                document.documentElement.dataset.theme = scheme;
            }, scheme);
            await expect(input).toHaveValue('随主题保留');
            const colors = await input.evaluate((element) => ({
                input: getComputedStyle(element).color,
                root: getComputedStyle(
                    document.querySelector('[data-comments]')!,
                ).color,
            }));
            expect(colors.input).toBe(colors.root);
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth,
                ),
            ).toBe(true);
        }
    }
    expect(
        await page.evaluate(
            () => (window as CommentWindow).twikooCalls?.length,
        ),
    ).toBe(1);
});

test('without IntersectionObserver comments load asynchronously as a fallback', async ({
    page,
}) => {
    await page.addInitScript(() => {
        delete (window as unknown as { IntersectionObserver?: unknown })
            .IntersectionObserver;
    });
    await mockResources(page);
    await page.goto(`${site.origin}${article}`);
    await expect(page.locator('[data-comments]')).toHaveAttribute(
        'data-comment-state',
        'ready',
    );
});

test('a slow locale times out before SDK initialization and can retry after the module arrives', async ({
    page,
}) => {
    test.setTimeout(120_000);
    const localized = await createBackgroundSite({
        comment: {
            enabled: true,
            twikoo: {
                envId: 'https://comments.example.test/api/',
                assetBaseUrl: assets,
                lang: 'ja',
            },
        },
    });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    let localeRequests = 0;
    try {
        const count = await mockResources(page);
        await page.route(`${assets}locales/ja-JP.js`, async (route) => {
            localeRequests++;
            await gate;
            await route.fulfill({
                contentType: 'text/javascript',
                body: 'export default {};',
            });
        });
        await page.clock.install();
        await page.goto(`${localized.origin}${article}`);
        const root = page.locator('[data-comments]');
        await root.scrollIntoViewIfNeeded();
        await expect.poll(() => localeRequests).toBe(1);
        await page.clock.fastForward(15_001);
        await expect(root).toHaveAttribute('data-comment-state', 'error');
        expect(
            await page.evaluate(
                () => (window as CommentWindow).twikooCalls?.length,
            ),
        ).toBe(0);
        const response = page.waitForResponse(`${assets}locales/ja-JP.js`);
        release();
        await response;
        await page.getByRole('button', { name: '重新加载评论' }).click();
        await reveal(page);
        expect(
            await page.evaluate(() =>
                (window as CommentWindow).twikooCalls?.map((call) => call.lang),
            ),
        ).toEqual(['ja-JP']);
        expect(count).toEqual({ script: 1, css: 1 });
    } finally {
        release?.();
        await localized.close();
    }
});

test('without JavaScript a clear comment fallback is shown', async ({
    browser,
}) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
        const page = await context.newPage();
        await page.goto(`${site.origin}${article}`);
        await expect(page.locator('[data-comments] noscript p')).toBeVisible();
        await expect(page.locator('[data-comments] noscript p')).toHaveText(
            '请启用 JavaScript 查看和发表评论。',
        );
    } finally {
        await context.close();
    }
});
