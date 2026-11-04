import { expect, test, type Page } from '@playwright/test';
import {
    measureReadingScroll,
    warmReadingPage,
} from '../fixtures/reading-performance';

const article = '/posts/format-example/';
async function expectActiveHeading(page: Page) {
    await expect
        .poll(async () =>
            page.evaluate(() => {
                const headings = [
                    ...document.querySelectorAll<HTMLElement>(
                        '#article-content :is(h1,h2,h3,h4,h5,h6)[id]',
                    ),
                ].filter((heading) => heading.getClientRects().length);
                let active = headings[0];
                for (const heading of headings) {
                    if (heading.getBoundingClientRect().top > 120) break;
                    active = heading;
                }
                const link = document.querySelector<HTMLAnchorElement>(
                    '.article-directory-sidebar [data-toc-link][aria-current="location"]',
                );
                return Boolean(
                    link &&
                    decodeURIComponent(link.hash.slice(1)) === active?.id,
                );
            }),
        )
        .toBe(true);
}

test('warm scrolling reuses article geometry and still reaches full progress', async ({
    page,
}) => {
    await page.goto(article);
    await warmReadingPage(page);
    const result = await measureReadingScroll(page);
    expect(result.reads.article + result.reads.headings).toBeLessThanOrEqual(
        2 * (result.headings + 1),
    );
    expect(result.percent).toBe('100%');
    expect(result.aria).toBe('100');
    const ratio = await page
        .locator('[data-reading-progress]')
        .first()
        .evaluate(
            (bar) =>
                bar.getBoundingClientRect().width /
                bar.parentElement!.getBoundingClientRect().width,
        );
    expect(ratio).toBeCloseTo(1, 2);
    await expectActiveHeading(page);
});

test('unchanged scroll positions do not rewrite reading labels or meters', async ({
    page,
}) => {
    await page.goto(article);
    await warmReadingPage(page);
    const changes = await page.evaluate(async () => {
        let count = 0;
        const observer = new MutationObserver(
            (records) => (count += records.length),
        );
        document
            .querySelectorAll(
                '[data-reading-progress], [data-reading-percent], [data-reading-meter]',
            )
            .forEach((node) =>
                observer.observe(node, { attributes: true, childList: true }),
            );
        for (let i = 0; i < 8; i++) {
            document.dispatchEvent(new Event('scroll'));
            await new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve()),
                ),
            );
        }
        observer.disconnect();
        return count;
    });
    expect(changes).toBe(0);
});

test('content growth and a viewport resize refresh active heading positions', async ({
    page,
}) => {
    await page.goto(article);
    await warmReadingPage(page);
    await page.evaluate(() => {
        const heading = document.querySelectorAll<HTMLElement>(
            '#article-content :is(h1,h2,h3,h4,h5,h6)[id]',
        )[3];
        scrollTo({
            top: heading.getBoundingClientRect().top + scrollY - 100,
            behavior: 'instant',
        });
    });
    await expectActiveHeading(page);
    await page.evaluate(() => {
        const heading = document.querySelectorAll(
            '#article-content :is(h1,h2,h3,h4,h5,h6)[id]',
        )[3];
        const spacer = document.createElement('div');
        spacer.style.height = '600px';
        heading.before(spacer);
    });
    await expectActiveHeading(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expectActiveHeading(page);
    await page.locator('.mobile-toc summary').click();
    await expectActiveHeading(page);
});

test('closing a modal scroll lock restores the same reading progress', async ({
    page,
}) => {
    await page.goto(article);
    await warmReadingPage(page);
    await page.evaluate(() => scrollTo({ top: 1600, behavior: 'instant' }));
    const trigger = page.locator('.site-nav [data-open-search]');
    // Focusing a sticky navigation control can itself scroll it into view.
    await trigger.focus();
    await page.evaluate(
        () =>
            new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve()),
                ),
            ),
    );
    await expectActiveHeading(page);
    const before = await page
        .locator('[data-reading-percent]')
        .first()
        .textContent();
    const originalScroll = await page.evaluate(() => scrollY);
    await page.keyboard.press('Enter');
    await expect(page.locator('#search-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#search-dialog')).toBeHidden();
    await expect(page.locator('[data-reading-percent]').first()).toHaveText(
        before!,
    );
    expect(await page.evaluate(() => scrollY)).toBeCloseTo(originalScroll, 0);
    await expectActiveHeading(page);
});

test('navigation releases old geometry observers and history restores live progress', async ({
    page,
}) => {
    await page.goto(article);
    await warmReadingPage(page);
    await page.evaluate(() => {
        const oldArticle = document.getElementById('article-content');
        const scope = window as Window & { oldReadingReads?: number };
        scope.oldReadingReads = 0;
        const original = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = function (this: Element) {
            if (this === oldArticle) scope.oldReadingReads!++;
            return original.call(this);
        };
    });
    await page.locator('.site-nav .brand').click();
    await expect(page).toHaveURL('/');
    await page.evaluate(async () => {
        (window as Window & { oldReadingReads?: number }).oldReadingReads = 0;
        dispatchEvent(new Event('resize'));
        document.dispatchEvent(new Event('scroll'));
        await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
    });
    expect(
        await page.evaluate(
            () =>
                (window as Window & { oldReadingReads?: number })
                    .oldReadingReads,
        ),
    ).toBe(0);
    await page.goBack();
    await expect(page).toHaveURL(article);
    await expectActiveHeading(page);
});
