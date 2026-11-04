import { expect, test } from '@playwright/test';

const articlePath = '/posts/format-example/';
const previewName = '查看图片：远山与傍晚的光';

for (const viewport of [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
]) {
    test.describe(viewport.name, () => {
        test.use({
            viewport: { width: viewport.width, height: viewport.height },
        });

        test('a viewBox-only SVG has visible dimensions and opens by mouse and keyboard', async ({
            page,
        }) => {
            await page.goto(articlePath);
            const button = page.getByRole('button', {
                name: previewName,
                exact: true,
            });
            const image = button.locator('img');
            await expect(button).toHaveCount(1);
            await expect(image).toBeVisible();
            await image.scrollIntoViewIfNeeded();
            const imageBox = await image.boundingBox();
            const buttonBox = await button.boundingBox();
            const articleBox = await page
                .locator('#article-content')
                .boundingBox();
            expect(imageBox?.width).toBeGreaterThan(0);
            expect(imageBox?.height).toBeGreaterThan(0);
            expect(buttonBox?.width).toBeCloseTo(imageBox!.width, 1);
            expect(buttonBox?.height).toBeCloseTo(imageBox!.height, 1);
            expect(imageBox!.width / imageBox!.height).toBeCloseTo(
                960 / 560,
                2,
            );
            expect(imageBox!.width).toBeLessThanOrEqual(articleBox!.width + 1);
            expect(imageBox!.x).toBeGreaterThanOrEqual(articleBox!.x - 1);
            expect(imageBox!.x + imageBox!.width).toBeLessThanOrEqual(
                articleBox!.x + articleBox!.width + 1,
            );

            await button.click();
            const dialog = page.getByRole('dialog', { name: '图片预览' });
            await expect(dialog).toBeVisible();
            await expect(dialog.locator('img')).toHaveAttribute(
                'alt',
                '远山与傍晚的光',
            );
            await expect(dialog.locator('img')).toBeVisible();
            const previewBox = await dialog.locator('img').boundingBox();
            expect(previewBox!.width / previewBox!.height).toBeCloseTo(
                960 / 560,
                2,
            );
            await page.keyboard.press('Escape');
            await expect(dialog).not.toBeVisible();
            await expect(button).toBeFocused();

            for (const key of ['Enter', 'Space']) {
                await page.keyboard.press(key);
                await expect(dialog).toBeVisible();
                await page.keyboard.press('Escape');
                await expect(dialog).not.toBeVisible();
                await expect(button).toBeFocused();
            }
        });

        test('raster and picture previews keep intrinsic sizes and shrink without distortion', async ({
            page,
        }) => {
            const fixtures = await page.evaluate(() => {
                const raster = (width: number, height: number) => {
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const context = canvas.getContext('2d')!;
                    context.fillStyle = '#a98eb0';
                    context.fillRect(0, 0, width, height);
                    return canvas.toDataURL('image/png');
                };
                return `<img src="${raster(48, 32)}" alt="small raster"><img src="${raster(960, 560)}" alt="large raster"><picture><source srcset="${raster(72, 48)}" type="image/png"><img src="${raster(48, 32)}" alt="small picture"></picture>`;
            });
            // Put fixtures in the rendered HTML, before the early runtime mount.
            await page.route(`**${articlePath}`, async (route) => {
                const response = await route.fetch();
                await route.fulfill({
                    response,
                    body: (await response.text()).replace(
                        /(<div\b[^>]*id="article-content"[^>]*>)/,
                        `$1${fixtures}`,
                    ),
                });
            });
            await page.goto(articlePath);
            const articleBox = await page
                .locator('#article-content')
                .boundingBox();
            for (const fixture of [
                { alt: 'small raster', width: 48, height: 32 },
                { alt: 'large raster', width: 960, height: 560 },
                { alt: 'small picture', width: 72, height: 48 },
            ]) {
                const button = page.getByRole('button', {
                    name: `查看图片：${fixture.alt}`,
                    exact: true,
                });
                const image = button.locator('img');
                await expect(button).toHaveCount(1);
                await expect(image).toBeVisible();
                await expect
                    .poll(() =>
                        image.evaluate(
                            (element) =>
                                (element as HTMLImageElement).naturalWidth,
                        ),
                    )
                    .toBe(fixture.width);
                const box = await image.boundingBox();
                const buttonBox = await button.boundingBox();
                expect(box!.width).toBeCloseTo(
                    Math.min(fixture.width, articleBox!.width),
                    1,
                );
                expect(box!.width / box!.height).toBeCloseTo(
                    fixture.width / fixture.height,
                    2,
                );
                expect(buttonBox!.width).toBeCloseTo(box!.width, 1);
                expect(buttonBox!.height).toBeCloseTo(box!.height, 1);
                await button.click();
                const dialog = page.getByRole('dialog', { name: '图片预览' });
                await expect(dialog).toBeVisible();
                await expect(dialog.locator('img')).toHaveJSProperty(
                    'src',
                    await image.evaluate(
                        (element) => (element as HTMLImageElement).currentSrc,
                    ),
                );
                await page.keyboard.press('Escape');
                await expect(dialog).not.toBeVisible();
                await expect(button).toBeFocused();
            }
            await expect(
                page
                    .getByRole('button', {
                        name: '查看图片：small picture',
                        exact: true,
                    })
                    .locator('picture source'),
            ).toHaveCount(1);
        });
    });
}
