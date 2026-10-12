import { expect, test, type Page } from '@playwright/test';

async function settleScroll(page: Page) {
    await page.evaluate(
        () =>
            new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve()),
                ),
            ),
    );
}

for (const kind of ['image', 'search'] as const) {
    for (const close of ['Escape', 'button', 'backdrop'] as const) {
        test(`${kind} preview locks background scrolling and keeps position after ${close}`, async ({
            page,
        }) => {
            await page.goto('/posts/format-example/');
            await page.evaluate(async () => {
                await document.fonts.ready;
                window.scrollTo({ top: 180, behavior: 'instant' });
            });
            const trigger =
                kind === 'image'
                    ? page.getByRole('button', {
                          name: '查看图片：远山与傍晚的光',
                          exact: true,
                      })
                    : page.locator('[data-open-search]').first();
            // Keyboard activation also covers an image that had zero size before the fix.
            await trigger.focus();
            await settleScroll(page);
            const original = await page.evaluate(() => ({
                y: window.scrollY,
                x: document
                    .getElementById('article-content')!
                    .getBoundingClientRect().x,
                width: document
                    .getElementById('article-content')!
                    .getBoundingClientRect().width,
            }));
            await page.keyboard.press('Enter');
            const dialog = page.locator(
                kind === 'image' ? '#image-lightbox' : '#search-dialog',
            );
            await expect(dialog).toBeVisible();
            expect(
                await page
                    .locator('#article-content')
                    .evaluate(
                        (element) => element.getBoundingClientRect().width,
                    ),
            ).toBeCloseTo(original.width, 1);
            await page.mouse.move(2, 2);
            await page.mouse.wheel(0, 600);
            await settleScroll(page);
            await expect
                .poll(() => page.evaluate(() => window.scrollY))
                .toBe(original.y);
            if (close === 'Escape') await page.keyboard.press('Escape');
            else if (close === 'button')
                await dialog.locator('[data-close-dialog]').click();
            else await page.mouse.click(2, 2);
            await expect(dialog).not.toBeVisible();
            await expect(trigger).toBeFocused();
            expect(await page.evaluate(() => window.scrollY)).toBe(original.y);
            expect(
                await page
                    .locator('#article-content')
                    .evaluate((element) => element.getBoundingClientRect().x),
            ).toBeCloseTo(original.x, 1);
            expect(
                await page
                    .locator('#article-content')
                    .evaluate(
                        (element) => element.getBoundingClientRect().width,
                    ),
            ).toBeCloseTo(original.width, 1);
            await page.mouse.wheel(0, 300);
            await expect
                .poll(() => page.evaluate(() => window.scrollY))
                .toBeGreaterThan(original.y);
        });
    }
}

test('another modal keeps the lock and navigation releases it', async ({
    page,
}) => {
    await page.goto('/posts/format-example/');
    await page.locator('[data-open-search]').first().click();
    await page.evaluate(() =>
        document
            .querySelector<HTMLDialogElement>('#image-lightbox')!
            .showModal(),
    );
    await page.keyboard.press('Escape');
    await expect(page.locator('#image-lightbox')).not.toBeVisible();
    await expect(page.locator('#search-dialog')).toBeVisible();
    expect(
        await page
            .locator('html')
            .evaluate((element) => getComputedStyle(element).overflowY),
    ).toBe('hidden');
    await page.evaluate(() => {
        const anchor = document.createElement('a');
        anchor.href = '/';
        document.querySelector('#search-dialog')!.append(anchor);
        anchor.click();
    });
    await expect(page.locator('.home-hero')).toBeVisible();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    expect(
        await page
            .locator('html')
            .evaluate((element) => getComputedStyle(element).overflowY),
    ).not.toBe('hidden');
    await page.mouse.move(2, 2);
    await page.mouse.wheel(0, 400);
    await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(0);
});
