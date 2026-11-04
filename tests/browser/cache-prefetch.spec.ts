import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createCacheSite } from '../fixtures/cache-site';

let site: Awaited<ReturnType<typeof createCacheSite>>;
const target = '/posts/format-example/';
test.beforeEach(async () => {
    site = await createCacheSite();
});
test.afterEach(async () => site.close());
const requests = (path = target) => site.hits.filter((hit) => hit.url === path);
async function ready(page: Page) {
    await page.goto(site.origin);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
}
async function link(page: Page, path = target) {
    await page.evaluate((path) => {
        const anchor =
            document.getElementById('cache-test-link') ??
            document.querySelector('a[href="/posts/format-example/"]')!;
        anchor.id = 'cache-test-link';
        anchor.setAttribute('href', path);
    }, path);
    return page.locator('#cache-test-link');
}
async function prefetch(page: Page, path = target, completed = true) {
    const anchor = await link(page, path);
    const response = page.waitForResponse(
        (r) =>
            r.url() === site.origin + path &&
            r.request().resourceType() === 'other',
    );
    await anchor.hover();
    const fetched = await response;
    // HTTP error status is sufficient to retry a rejected prefetch.
    if (completed && fetched.ok()) await fetched.finished();
    return anchor;
}
async function arrived(page: Page, path = target) {
    await expect(page).toHaveURL(site.origin + path);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
}

for (const completed of [true, false]) {
    test(`native prefetch is reused when ${completed ? 'completed' : 'still downloading'}`, async ({
        page,
    }) => {
        site.variants.set(target, { delay: completed ? 0 : 800 });
        await ready(page);
        const anchor = await prefetch(page, target, completed);
        await anchor.click();
        await arrived(page);
        expect(requests()).toHaveLength(1);
        expect(requests()[0].prefetch).toBe(true);
    });
}

test('query strings identify different documents', async ({ page }) => {
    const a = target + '?variant=a';
    const b = target + '?variant=b';
    site.variants.set(a, { version: 'a' });
    site.variants.set(b, { version: 'b' });
    await ready(page);
    await prefetch(page, a);
    const anchor = await link(page, b);
    await anchor.click();
    await arrived(page, b);
    expect(requests(a)).toHaveLength(1);
    expect(requests(b)).toHaveLength(1);
    await expect(
        page.locator('meta[name="cache-test-version"]'),
    ).toHaveAttribute('content', 'b');
});

for (const [name, policy] of [
    ['expired', { age: 61 }],
    ['no-cache', { cache: 'no-cache' }],
    ['no-store', { cache: 'no-store' }],
] as const) {
    test(`${name} prefetched HTML revalidates and sees updated content`, async ({
        page,
    }) => {
        site.variants.set(target, { ...policy, version: 'old' });
        await ready(page);
        const anchor = await prefetch(page);
        site.variants.set(target, { ...policy, version: 'new' });
        await anchor.click();
        await arrived(page);
        expect(requests()).toHaveLength(2);
        await expect(
            page.locator('meta[name="cache-test-version"]'),
        ).toHaveAttribute('content', 'new');
    });
}

test('a failed prefetch can be retried by clicking', async ({ page }) => {
    site.variants.set(target, { status: 503, cache: 'no-store' });
    await ready(page);
    const anchor = await prefetch(page);
    site.variants.set(target, { version: 'recovered' });
    await anchor.click();
    await arrived(page);
    expect(requests().map((hit) => hit.status)).toEqual([503, 200]);
    await expect(
        page.locator('meta[name="cache-test-version"]'),
    ).toHaveAttribute('content', 'recovered');
});

test('a superseded slow navigation never replaces the newer page', async ({
    page,
}) => {
    const slow = target + '?slow=1';
    site.variants.set(slow, { delay: 800 });
    await ready(page);
    const anchor = await link(page, slow);
    await anchor.evaluate((node) => {
        node.setAttribute('data-astro-prefetch', 'false');
        (node as HTMLAnchorElement).click();
    });
    await expect.poll(() => requests(slow).length).toBe(1);
    await page
        .locator('a[href="/archives/"]')
        .first()
        .evaluate((node) => {
            node.setAttribute('data-astro-prefetch', 'false');
            (node as HTMLAnchorElement).click();
        });
    await arrived(page, '/archives/');
    await page.waitForTimeout(900);
    await arrived(page, '/archives/');
});
