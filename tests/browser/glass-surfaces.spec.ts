import { expect, test, type Locator } from '@playwright/test';
import { createBackgroundSite } from '../fixtures/site-background';

let site: Awaited<ReturnType<typeof createBackgroundSite>>;

test.beforeAll(async () => {
    test.setTimeout(120_000);
    site = await createBackgroundSite({
        comments: true,
        recommendations: true,
    });
});
test.afterAll(async () => {
    await site?.close();
});

async function assertSurface(surface: Locator, opacity: number) {
    await expect(surface).toHaveCSS(
        'backdrop-filter',
        'blur(32px) saturate(1.3)',
    );
    const alpha = await surface.evaluate((el) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d')!;
        context.fillStyle = getComputedStyle(el).backgroundColor;
        context.fillRect(0, 0, 1, 1);
        return context.getImageData(0, 0, 1, 1).data[3] / 255;
    });
    expect(alpha).toBeCloseTo(opacity, 2);
    await expect(surface).toHaveCSS('opacity', '1');
}

for (const scheme of ['light', 'dark'] as const) {
    test(`home and listing cards use the configured ${scheme} glass`, async ({
        page,
    }) => {
        await page.addInitScript(
            (scheme) => localStorage.setItem('sky-theme', scheme),
            scheme,
        );
        const opacity = scheme === 'light' ? 0.72 : 0.65;
        for (const [path, selector] of [
            ['/', '[data-home-card="author"]'],
            ['/archives/', '.archive-post'],
            ['/categories/', '.content-preview-card'],
            ['/tags/', '.content-preview-card'],
            ['/authors/sky/', '.content-preview-card'],
            ['/columns/', '.column-overview'],
            ['/moments/', '.essay-card'],
            ['/links/', '.friend-card'],
        ]) {
            await page.goto(`${site.origin}${path}`);
            const card = page.locator(selector).first();
            await assertSurface(card, opacity);
            await card.scrollIntoViewIfNeeded();
            await card.hover();
            await assertSurface(card, opacity);
        }
    });
}

test('changing glass parameters changes the rendered surface and keeps text opaque', async ({
    page,
}) => {
    await page.goto(site.origin);
    await page.evaluate(() => {
        const root = document.documentElement;
        root.style.setProperty('--sky-glass-blur', '9px');
        root.style.setProperty('--sky-glass-saturation', '0.6');
        root.style.setProperty('--sky-glass-opacity-light', '0.25');
    });
    const card = page.locator('[data-home-card="author"]');
    await expect(card).toHaveCSS('backdrop-filter', 'blur(9px) saturate(0.6)');
    await expect(card.locator('h2')).toHaveCSS('opacity', '1');
});

for (const surface of ['card', 'navigation'] as const) {
    test(`blur softens the painted wallpaper behind the ${surface}`, async ({
        page,
    }) => {
        await page.goto(site.origin);
        await page.evaluate(() => document.fonts.ready);
        await page
            .locator('[data-site-wallpaper]')
            .evaluate(async (element: HTMLImageElement) => {
                const stripes =
                    '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1000"><defs><pattern id="p" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="white"/><rect width="6" height="12" fill="black"/></pattern></defs><rect width="1440" height="1000" fill="url(#p)"/></svg>';
                element.src = `data:image/svg+xml,${encodeURIComponent(stripes)}`;
                await element.decode();
            });
        const target = page.locator(
            surface === 'card' ? '[data-home-card="author"]' : '.nav-surface',
        );
        if (surface === 'card') {
            await target.scrollIntoViewIfNeeded();
            await target.evaluate((el) => {
                for (const child of el.children)
                    (child as HTMLElement).style.visibility = 'hidden';
            });
        }
        const box = (await target.boundingBox())!;
        const clip =
            surface === 'card'
                ? { x: box.x + 40, y: box.y + 200, width: 120, height: 100 }
                : { x: box.x + 280, y: box.y + 16, width: 120, height: 24 };
        const contrast = async () => {
            const png = await page.screenshot({ clip, animations: 'disabled' });
            return page.evaluate(async (base64) => {
                const image = new Image();
                image.src = `data:image/png;base64,${base64}`;
                await image.decode();
                const canvas = document.createElement('canvas');
                canvas.width = image.width;
                canvas.height = image.height;
                const context = canvas.getContext('2d')!;
                context.drawImage(image, 0, 0);
                const pixels = context.getImageData(
                    0,
                    0,
                    image.width,
                    image.height,
                ).data;
                let min = 255;
                let max = 0;
                for (let index = 0; index < pixels.length; index += 4) {
                    min = Math.min(min, pixels[index]);
                    max = Math.max(max, pixels[index]);
                }
                return max - min;
            }, png.toString('base64'));
        };
        const blurredContrast = await contrast();
        await page.evaluate(() =>
            document.documentElement.style.setProperty(
                '--sky-glass-blur',
                '0px',
            ),
        );
        const crispContrast = await contrast();
        expect(crispContrast).toBeGreaterThan(40);
        expect(blurredContrast).toBeLessThan(crispContrast * 0.25);
    });
}
