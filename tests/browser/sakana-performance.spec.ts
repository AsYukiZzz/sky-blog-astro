import { expect, test } from '@playwright/test';
import { createBackgroundSite } from '../fixtures/site-background';
import { warmReadingPage as settlePageLayout } from '../fixtures/reading-performance';
import {
    flushWidgetIdle,
    holdWidgetIdle,
    measureSakanaPosition,
    sakanaChunkName,
} from '../fixtures/sakana-performance';

test.use({ reducedMotion: 'no-preference' });
let site: Awaited<ReturnType<typeof createBackgroundSite>>;
const widgetChunk = sakanaChunkName();
test.beforeAll(async () => {
    test.setTimeout(120_000);
    site = await createBackgroundSite({ sakana: { showOnMobile: true } });
});
test.afterAll(async () => site?.close());

test('first widget download waits for idle while the page is already usable', async ({
    page,
}) => {
    await holdWidgetIdle(page);
    let requests = 0;
    page.on('request', (request) => {
        if (new URL(request.url()).pathname.endsWith(widgetChunk)) requests++;
    });
    await page.goto(site.origin);
    await settlePageLayout(page);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    expect(requests).toBe(0);
    await expect(
        page.locator('[data-sakana-host] .sakana-widget-wrapper'),
    ).toHaveCount(0);
    await flushWidgetIdle(page);
    await expect(
        page.locator('[data-sakana-host] .sakana-widget-wrapper'),
    ).toBeVisible();
    expect(requests).toBe(1);
});

test('a saved hidden widget downloads only when explicitly restored', async ({
    page,
}) => {
    await holdWidgetIdle(page);
    await page.addInitScript(() =>
        localStorage.setItem('sky-sakana-visibility', 'hide'),
    );
    let requests = 0;
    page.on('request', (request) => {
        if (new URL(request.url()).pathname.endsWith(widgetChunk)) requests++;
    });
    await page.goto(site.origin);
    await settlePageLayout(page);
    await flushWidgetIdle(page);
    await expect(
        page.getByRole('button', { name: '显示 Sakana 挂件' }),
    ).toBeVisible();
    expect(requests).toBe(0);
    await expect(
        page.locator('[data-sakana-host] .sakana-widget-wrapper'),
    ).toHaveCount(0);
    await page.getByRole('button', { name: '显示 Sakana 挂件' }).click();
    await expect(
        page.locator('[data-sakana-host] .sakana-widget-wrapper'),
    ).toBeVisible();
    expect(requests).toBe(1);
    expect(
        await page.evaluate(() =>
            localStorage.getItem('sky-sakana-visibility'),
        ),
    ).toBe('show');
});

test('navigation cancels idle initialization before downloading the package', async ({
    page,
}) => {
    await holdWidgetIdle(page);
    await page.addInitScript(() =>
        document.addEventListener(
            'astro:after-swap',
            () => {
                (
                    window as Window & { flushWidgetIdle?: () => void }
                ).flushWidgetIdle?.();
            },
            { once: true },
        ),
    );
    let requests = 0;
    page.on('request', (request) => {
        if (new URL(request.url()).pathname.endsWith(widgetChunk)) requests++;
    });
    await page.goto(site.origin);
    await settlePageLayout(page);
    await page.locator('a[href="/posts/format-example/"]').first().click();
    await expect(page).toHaveURL(`${site.origin}/posts/format-example/`);
    await flushWidgetIdle(page);
    await page.evaluate(
        () =>
            new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve()),
                ),
            ),
    );
    expect(requests).toBe(0);
    await expect(page.locator('.sakana-widget-wrapper')).toHaveCount(0);
});

test('ordinary scrolls reuse footer geometry and do not rewrite an unchanged lift', async ({
    page,
}) => {
    await page.goto(site.origin);
    await expect(
        page.locator('[data-sakana-host] .sakana-widget-wrapper'),
    ).toBeVisible();
    await settlePageLayout(page);
    const result = await measureSakanaPosition(page);
    expect(result.limit).toBeGreaterThan(100);
    expect(result.footerReads + result.insetReads).toBeLessThanOrEqual(2);
    expect(result.liftWrites).toBe(0);
});

test('dragging, hide/restore and reduced-motion pause preserve the same controls', async ({
    page,
}) => {
    await page.goto(site.origin);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    const image = page.getByRole('img', {
        name: 'Sakana 角色，拖动后松开可以回弹',
    });
    await expect(image).toBeVisible();
    const box = (await image.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    const frame = () =>
        page.evaluate(
            () =>
                new Promise<void>((resolve) =>
                    requestAnimationFrame(() =>
                        requestAnimationFrame(() => resolve()),
                    ),
                ),
        );
    await frame();
    const held = await image.evaluate(
        (node) => (node as HTMLElement).style.transform,
    );
    await frame();
    expect(
        await image.evaluate((node) => (node as HTMLElement).style.transform),
    ).toBe(held);
    await page.mouse.move(
        box.x + box.width / 2 + 45,
        box.y + box.height / 2 - 25,
        { steps: 3 },
    );
    await frame();
    expect(
        await image.evaluate((node) => (node as HTMLElement).style.transform),
    ).not.toBe(held);
    await page.mouse.up();
    await page.getByRole('button', { name: '收起 Sakana 挂件' }).click();
    await expect(
        page.getByRole('button', { name: '显示 Sakana 挂件' }),
    ).toBeVisible();
    expect(
        await page.evaluate(() =>
            localStorage.getItem('sky-sakana-visibility'),
        ),
    ).toBe('hide');
    await page.getByRole('button', { name: '显示 Sakana 挂件' }).click();
    await expect(image).toBeVisible();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('[data-sakana]')).toBeHidden();
    await expect(page.locator('.sakana-widget-wrapper')).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(
        page.locator('[data-sakana-host] .sakana-widget-wrapper'),
    ).toHaveCount(1);
    await expect(image).toBeVisible();
});

test('responsive sizing and footer clearance still follow the actual layout', async ({
    page,
}) => {
    await page.goto(site.origin);
    const widget = page.locator('[data-sakana-host] .sakana-widget-wrapper');
    const gap = () =>
        page.evaluate(
            () =>
                document
                    .querySelector('.home-sakana-anchor')!
                    .getBoundingClientRect().bottom -
                document.querySelector('.site-footer')!.getBoundingClientRect()
                    .top,
        );
    const expectClearance = async () => {
        await expect.poll(gap).toBeLessThanOrEqual(-14);
        await expect.poll(gap).toBeGreaterThanOrEqual(-18);
    };
    await expect(widget).toBeVisible();
    await settlePageLayout(page);
    await page.evaluate(() =>
        scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: 'instant',
        }),
    );
    await expectClearance();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
        .poll(async () => (await widget.boundingBox())?.width)
        .toBeCloseTo(160, 0);
    await page.evaluate(() =>
        scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: 'instant',
        }),
    );
    await expectClearance();
});

test('initialization also works when requestIdleCallback is unavailable', async ({
    page,
}) => {
    await page.addInitScript(() =>
        Object.defineProperty(window, 'requestIdleCallback', {
            value: undefined,
        }),
    );
    await page.goto(site.origin);
    await expect(
        page.locator('[data-sakana-host] .sakana-widget-wrapper'),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: '收起 Sakana 挂件' }),
    ).toBeVisible();
});
