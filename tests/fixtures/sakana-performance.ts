import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

export function sakanaChunkName() {
    const directory = fileURLToPath(
        new URL('../../dist/_astro/', import.meta.url),
    );
    const file = readdirSync(directory).find(
        (name) =>
            name.endsWith('.js') &&
            readFileSync(join(directory, name), 'utf8').includes(
                'sakana-widget-status',
            ),
    );
    if (!file) throw new Error('Missing built Sakana chunk');
    return file;
}

export async function holdWidgetIdle(page: Page) {
    await page.addInitScript(() => {
        const pending = new Map<number, IdleRequestCallback>();
        let next = 0;
        window.requestIdleCallback = (callback) => {
            pending.set(++next, callback);
            return next;
        };
        window.cancelIdleCallback = (id) => {
            pending.delete(id);
        };
        (window as Window & { flushWidgetIdle?: () => void }).flushWidgetIdle =
            () => {
                for (const [id, callback] of [...pending]) {
                    pending.delete(id);
                    callback({ didTimeout: false, timeRemaining: () => 50 });
                }
            };
    });
}

export async function flushWidgetIdle(page: Page) {
    await page.evaluate(() =>
        (window as Window & { flushWidgetIdle?: () => void })
            .flushWidgetIdle!(),
    );
}

export async function measureSakanaPosition(page: Page, scroll = true) {
    return await page.evaluate(async (scroll) => {
        const root = document.querySelector<HTMLElement>('[data-sakana]')!;
        const anchor = root.querySelector('.home-sakana-anchor')!;
        const footer = document.querySelector('.site-footer')!;
        const limit = Math.max(
            0,
            Math.min(
                600,
                footer.getBoundingClientRect().top +
                    scrollY -
                    innerHeight -
                    200,
            ),
        );
        const counts = { footerReads: 0, insetReads: 0, liftWrites: 0 };
        const originalRect = Element.prototype.getBoundingClientRect;
        const originalStyle = window.getComputedStyle;
        const originalSet = CSSStyleDeclaration.prototype.setProperty;
        Element.prototype.getBoundingClientRect = function (this: Element) {
            if (this === footer) counts.footerReads++;
            return originalRect.call(this);
        };
        window.getComputedStyle = (element, pseudo) => {
            if (element === anchor) counts.insetReads++;
            return originalStyle.call(window, element, pseudo);
        };
        CSSStyleDeclaration.prototype.setProperty = function (
            this: CSSStyleDeclaration,
            name,
            value,
            priority,
        ) {
            if (this === root.style && name === '--sakana-lift')
                counts.liftWrites++;
            return originalSet.call(this, name, value, priority);
        };
        const frame = () =>
            new Promise<void>((resolve) =>
                requestAnimationFrame(() => resolve()),
            );
        try {
            for (let step = 1; step <= 40; step++) {
                if (scroll)
                    scrollTo({ top: (limit * step) / 40, behavior: 'instant' });
                await frame();
                await frame();
            }
            return {
                ...counts,
                limit,
                steps: 40,
                lift: root.style.getPropertyValue('--sakana-lift'),
            };
        } finally {
            Element.prototype.getBoundingClientRect = originalRect;
            window.getComputedStyle = originalStyle;
            CSSStyleDeclaration.prototype.setProperty = originalSet;
        }
    }, scroll);
}
