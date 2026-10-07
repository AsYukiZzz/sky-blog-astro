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

for (const kind of ['image', 'theme'] as const) {
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
                    : page.locator('[data-theme-picker]').first();
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
                kind === 'image' ? '#image-lightbox' : '#theme-picker',
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

test('theme content scrolls internally on mobile while the page stays still', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 600 });
    await page.goto('/posts/format-example/');
    await page.evaluate(() =>
        window.scrollTo({ top: 180, behavior: 'instant' }),
    );
    await page.locator('[data-theme-picker]').first().click();
    const dialog = page.locator('#theme-picker');
    await expect(dialog).toBeVisible();
    const original = await page.evaluate(() => window.scrollY);
    const box = (await dialog.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 500);
    await expect
        .poll(() => dialog.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(original);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(original);
});

test('another modal keeps the lock and navigation releases it', async ({
    page,
}) => {
    await page.goto('/posts/format-example/');
    await page.locator('[data-theme-picker]').first().click();
    await page.evaluate(() =>
        document
            .querySelector<HTMLDialogElement>('#image-lightbox')!
            .showModal(),
    );
    await page.keyboard.press('Escape');
    await expect(page.locator('#image-lightbox')).not.toBeVisible();
    await expect(page.locator('#theme-picker')).toBeVisible();
    expect(
        await page
            .locator('html')
            .evaluate((element) => getComputedStyle(element).overflowY),
    ).toBe('hidden');
    await page.evaluate(() => {
        const anchor = document.createElement('a');
        anchor.href = '/';
        document.querySelector('#theme-picker')!.append(anchor);
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
