import { expect, test } from '@playwright/test';
import {
    createBackgroundSite,
    wallpaperSource,
} from '../fixtures/site-background';

const cases = [
    {
        name: 'content strategy enters before a slow Hero wallpaper finishes',
        loading: { strategy: 'content' as const, maxWait: 3000 },
    },
    {
        name: 'wallpaper strategy honors a shorter configured maximum wait',
        loading: { strategy: 'wallpaper' as const, maxWait: 500 },
    },
];

for (const { name, loading } of cases) {
    test(name, async ({ page }) => {
        test.setTimeout(120_000);
        const site = await createBackgroundSite({ loading });
        let release!: () => void;
        const image = new Promise<void>((done) => {
            release = done;
        });
        try {
            await page.route(
                `${site.origin}${wallpaperSource}`,
                async (route) => {
                    await image;
                    await route.continue();
                },
            );
            await page.goto(`${site.origin}/`, {
                waitUntil: 'domcontentloaded',
            });
            const layer = page.locator('[data-page-loading]');
            await expect(layer).toBeHidden({ timeout: 1200 });
            await expect(page.locator('main')).not.toHaveAttribute('inert');
            const wallpaper = page.locator('[data-site-wallpaper]');
            await expect(wallpaper).toHaveCSS('opacity', '0');
            release();
            await expect(wallpaper).toHaveCSS('opacity', '1');
            await expect(layer).toBeHidden();
        } finally {
            release();
            await site.close();
        }
    });
}
