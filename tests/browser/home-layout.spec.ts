import { expect, test, type Page } from '@playwright/test';
import {
    expectedHomeOrder as order,
    expectedHomePlacements,
    expectedHomeHeights as heights,
} from '../fixtures/home-layout';

async function fillRecentPreviews(page: Page) {
    await page.evaluate(() => {
        const list = document.querySelector(
            '[data-home-card="recent"] [data-home-items]',
        )!;
        const source = list.firstElementChild!;
        // Exercise preview limits with test data even when the starter has one post.
        while (list.children.length < 8) {
            const item = source.cloneNode(true) as HTMLElement;
            item.querySelector('.home-recent-number')!.textContent = String(
                list.children.length + 1,
            ).padStart(2, '0');
            list.append(item);
        }
    });
}

test('one DOM per card has stable reading order, titles and the 90-day chart', async ({
    page,
}) => {
    await page.goto('/');
    expect(
        await page
            .locator('[data-home-grid] > [data-home-card]')
            .evaluateAll((cards) =>
                cards.map((card) => card.getAttribute('data-home-card')),
            ),
    ).toEqual(order);
    await expect(page.locator('#home-moments')).toHaveCount(1);
    await expect(page.locator('.home-writing-heatmap')).toHaveCount(1);
    await expect(page.locator('[data-writing-in-range="true"]')).toHaveCount(
        90,
    );
    const duplicateIds = await page.evaluate(() => {
        const ids = [...document.querySelectorAll('.home-card [id]')].map(
            (el) => el.id,
        );
        return ids.filter((id, i) => ids.indexOf(id) !== i);
    });
    expect(duplicateIds).toEqual([]);
    for (const id of order) {
        const card = page.locator(`[data-home-card="${id}"]`);
        await expect(card).toHaveCount(1);
        await expect(
            card.locator(`#${await card.getAttribute('aria-labelledby')}`),
        ).toHaveCount(1);
        await expect(card.locator('.home-card-body')).toHaveAttribute(
            'tabindex',
            '0',
        );
    }
});

test('fixed rectangles and preview capacities follow container thresholds in both directions', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await fillRecentPreviews(page);
    for (const width of [639, 640, 959, 960, 1216, 639, 960, 639]) {
        await page.locator('.home-overview').evaluate((el, width) => {
            Object.assign((el as HTMLElement).style, {
                width: `${width}px`,
                maxWidth: 'none',
                padding: '0',
                boxSizing: 'content-box',
            });
        }, width);
        const layout =
            width >= 960 ? 'wide' : width >= 640 ? 'medium' : 'compact';
        const expectedHeight = heights[layout];
        await expect
            .poll(
                async () =>
                    (await page.locator('[data-home-grid]').boundingBox())
                        ?.height,
            )
            .toBe(expectedHeight);
        const author = (await page
            .locator('[data-home-card="author"]')
            .boundingBox())!;
        expect(author.height).toBe(layout === 'compact' ? 496 : 508);
        await expect(
            page.locator('[data-home-card="recent"] [data-home-item]:visible'),
        ).toHaveCount(layout === 'compact' ? 3 : 5);
        const excerpt = page
            .locator('[data-home-card="recent"] .home-recent-summary p')
            .first();
        if (layout !== 'compact') await expect(excerpt).toBeVisible();
        else await expect(excerpt).not.toBeVisible();
        const cards = await page
            .locator('[data-home-grid] > [data-home-card]')
            .evaluateAll((elements) =>
                elements.map((el) => {
                    const rect = el.getBoundingClientRect();
                    return {
                        id: el.getAttribute(
                            'data-home-card',
                        ) as (typeof order)[number],
                        x: rect.x,
                        y: rect.y,
                        right: rect.right,
                        bottom: rect.bottom,
                        width: rect.width,
                        height: rect.height,
                    };
                }),
            );
        const grid = (await page.locator('[data-home-grid]').boundingBox())!;
        const columns = layout === 'wide' ? 6 : layout === 'medium' ? 4 : 2;
        const gap = layout === 'compact' ? 16 : 20;
        const cellWidth = (grid.width - (columns - 1) * gap) / columns;
        for (const card of cards) {
            const [row, column, columnSpan, rowSpan] =
                expectedHomePlacements[layout][card.id];
            expect(card.x, `${layout} ${card.id} column`).toBeCloseTo(
                grid.x + (column - 1) * (cellWidth + gap),
                1,
            );
            expect(card.y, `${layout} ${card.id} row`).toBeCloseTo(
                grid.y + (row - 1) * (112 + gap),
                1,
            );
            expect(card.width, `${layout} ${card.id} width`).toBeCloseTo(
                columnSpan * cellWidth + (columnSpan - 1) * gap,
                1,
            );
            expect(card.height, `${layout} ${card.id} height`).toBe(
                rowSpan * 112 + (rowSpan - 1) * gap,
            );
        }
        for (const [i, a] of cards.entries())
            for (const b of cards.slice(i + 1)) {
                expect(
                    a.x >= b.right - 1 ||
                        b.x >= a.right - 1 ||
                        a.y >= b.bottom - 1 ||
                        b.y >= a.bottom - 1,
                    `${a.id} overlaps ${b.id} at ${width}`,
                ).toBeTruthy();
            }
    }
});

test('320px through desktop has no page or card horizontal overflow', async ({
    page,
}) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    for (const width of [320, 375, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        document.documentElement.scrollWidth <=
                        window.innerWidth,
                ),
            )
            .toBeTruthy();
        const overflowing = await page
            .locator('[data-home-card]')
            .evaluateAll((cards) =>
                cards
                    .filter((card) => card.scrollWidth > card.clientWidth + 1)
                    .map((card) => card.getAttribute('data-home-card')),
            );
        expect(overflowing, `overflow at ${width}`).toEqual([]);
    }
});

test('fixed layout and all-content links work with JavaScript disabled', async ({
    browser,
}) => {
    const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4399/');
    await fillRecentPreviews(page);
    expect((await page.locator('[data-home-grid]').boundingBox())?.height).toBe(
        heights.wide,
    );
    await expect(
        page.getByRole('link', { name: '翻阅全部文章', exact: true }),
    ).toHaveCount(2);
    await expect(
        page.getByRole('link', { name: '全部朋友', exact: true }),
    ).toBeVisible();
    await expect(
        page.locator('[data-home-card="recent"] [data-home-item]:visible'),
    ).toHaveCount(5);
    await context.close();
});

test('enlarged text can scroll bodies and reach every footer with keyboard focus', async ({
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/');
    await page.addStyleTag({
        content:
            '.home-card { font-size: 200%; } .home-card :is(h2,p,a,strong,small,span,time) { font-size: inherit !important; }',
    });
    for (const id of order) {
        const card = page.locator(`[data-home-card="${id}"]`);
        const body = card.locator('.home-card-body');
        await body.focus();
        await expect(body).toBeFocused();
        expect((await body.boundingBox())!.height).toBeGreaterThan(40);
        await page.keyboard.press('PageDown');
        for (const link of await card.locator('.home-card-footer a').all()) {
            await link.focus();
            await expect(link).toBeFocused();
            await expect(link).toBeInViewport();
        }
    }
});

test('Tab visits only visible article previews before the all-content link', async ({
    page,
}) => {
    await page.goto('/');
    await fillRecentPreviews(page);
    for (const width of [375, 1440, 375]) {
        await page.setViewportSize({ width, height: 900 });
        const card = page.locator('[data-home-card="recent"]');
        const visibleLinks = await card
            .locator('[data-home-item]:visible a')
            .all();
        await card.locator('.home-card-body').focus();
        for (const link of visibleLinks) {
            await page.keyboard.press('Tab');
            await expect(link).toBeFocused();
        }
        await page.keyboard.press('Tab');
        await expect(card.locator('.home-card-footer a')).toBeFocused();
    }
});

test('long content keeps fixed frames and scrolls while every contact remains reachable', async ({
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/');
    await fillRecentPreviews(page);
    const initial = (await page.locator('[data-home-grid]').boundingBox())!
        .height;
    await page.evaluate(() => {
        document
            .querySelectorAll(
                '.home-recent-summary strong, .home-taxonomy-chip > span, .home-friends strong',
            )
            .forEach(
                (el) =>
                    (el.textContent =
                        '很长的标题与标签VeryLongUnbrokenContent'.repeat(30)),
            );
        document
            .querySelectorAll('.home-stats-grid strong')
            .forEach((el) => (el.textContent = '12345678901234567890'));
        const nav = document.querySelector('.home-author-social')!;
        const first = nav.querySelector('a')!;
        for (let i = 0; i < 15; i++) nav.append(first.cloneNode(true));
    });
    expect((await page.locator('[data-home-grid]').boundingBox())!.height).toBe(
        initial,
    );
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
    ).toBeTruthy();
    const author = page.locator('[data-home-card="author"]');
    await author.locator('.home-author-social a').last().focus();
    await expect(
        author.locator('.home-author-social a').last(),
    ).toBeInViewport();
    expect(
        await author.evaluate((el) => el.scrollHeight > el.clientHeight),
    ).toBeTruthy();
    const recent = page.locator('[data-home-card="recent"] .home-card-body');
    // Line-clamped previews normally fit; enlarge their text to exercise real overflow.
    await page.addStyleTag({
        content: '.home-recent-summary strong { font-size:36px; }',
    });
    expect(
        await recent.evaluate((el) => el.scrollHeight > el.clientHeight),
    ).toBeTruthy();
    await recent.focus();
    await page.keyboard.press('PageDown');
    await expect
        .poll(() => recent.evaluate((el) => el.scrollTop))
        .toBeGreaterThan(0);
});

test('client navigation and browser history restore the same homepage rectangles', async ({
    page,
}) => {
    await page.goto('/');
    const grid = page.locator('[data-home-grid]');
    const height = (await grid.boundingBox())!.height;
    await page
        .locator('[data-home-card="recent"] [data-home-item] a')
        .first()
        .click();
    await expect(page).toHaveURL(/\/posts\//);
    await page.goBack();
    await expect(page).toHaveURL('http://127.0.0.1:4399/');
    await expect
        .poll(async () => (await grid.boundingBox())?.height)
        .toBe(height);
    await expect(grid).not.toHaveAttribute('data-home-layout');
});
