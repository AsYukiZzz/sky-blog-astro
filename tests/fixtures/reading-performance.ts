import type { Page } from '@playwright/test';

export async function warmReadingPage(page: Page) {
    await page.locator('[data-page-loading]').waitFor({ state: 'hidden' });
    await page.evaluate(async () => {
        await Promise.all(
            [...document.images]
                .filter((image) => image.getAttribute('src'))
                .map(async (image) => {
                    image.loading = 'eager';
                    await image.decode().catch(() => {});
                }),
        );
        await document.fonts.ready;
        for (let i = 0; i < 4; i++)
            await new Promise<void>((resolve) =>
                requestAnimationFrame(() => resolve()),
            );
    });
}

export async function measureReadingScroll(page: Page, steps = 48) {
    return await page.evaluate(async (steps) => {
        const original = Element.prototype.getBoundingClientRect;
        const reads = { article: 0, headings: 0, toc: 0 };
        const headings = document.querySelectorAll(
            '#article-content :is(h1,h2,h3,h4,h5,h6)[id]',
        ).length;
        const limit = document.documentElement.scrollHeight - innerHeight;
        Element.prototype.getBoundingClientRect = function (this: Element) {
            if (this.id === 'article-content') reads.article++;
            else if (
                this.matches('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]') &&
                this.closest('#article-content')
            )
                reads.headings++;
            else if (this.matches('[data-toc-link], [data-toc-scroll]'))
                reads.toc++;
            return original.call(this);
        };
        const frame = () =>
            new Promise<void>((resolve) =>
                requestAnimationFrame(() => resolve()),
            );
        try {
            for (let i = 1; i <= steps; i++) {
                scrollTo({ top: (limit * i) / steps, behavior: 'instant' });
                await frame();
                await frame();
            }
            await frame();
            return {
                steps,
                headings,
                reads,
                percent: document.querySelector('[data-reading-percent]')
                    ?.textContent,
                aria: document
                    .querySelector('[data-reading-meter]')
                    ?.getAttribute('aria-valuenow'),
            };
        } finally {
            Element.prototype.getBoundingClientRect = original;
        }
    }, steps);
}
