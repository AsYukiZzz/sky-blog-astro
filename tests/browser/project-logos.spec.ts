import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parseJsonc } from '../../src/lib/jsonc';

test('project logos and empty-logo fallbacks render without JavaScript', async ({
    browser,
}) => {
    const projects = parseJsonc(
        readFileSync(
            new URL('../../src/data/projects.jsonc', import.meta.url),
            'utf8',
        ),
        'projects.jsonc',
    ) as { logo?: string | null }[];
    const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 375, height: 900 },
    });
    try {
        const page = await context.newPage();
        await page.goto('http://127.0.0.1:4399/');
        const logos = page.locator('[data-project-logo]');
        await expect(logos).toHaveCount(projects.length);
        for (const [index, project] of projects.entries()) {
            const logo = logos.nth(index);
            await expect(logo).toHaveAttribute(
                'src',
                project.logo?.trim() || '/images/project-default.svg',
            );
            await logo.scrollIntoViewIfNeeded();
            await expect(logo).toBeVisible();
            expect((await logo.boundingBox())!.width).toBe(32);
            expect((await logo.boundingBox())!.height).toBe(32);
        }
    } finally {
        await context.close();
    }
});

test('failed project logos recover after client navigation', async ({
    page,
}) => {
    const brokenLogo = 'https://project-logo.invalid/unavailable.png';
    await page.route(brokenLogo, (route) => route.abort());
    await page.goto('/');
    await page
        .locator('[data-home-card="recent"] [data-home-item] a')
        .first()
        .click();
    await expect(page).toHaveURL(/\/posts\//);
    await page.goBack();
    await expect(page).toHaveURL('http://127.0.0.1:4399/');
    const logo = page.locator('[data-project-logo]').first();
    await expect(logo).toHaveCount(1);
    await logo.scrollIntoViewIfNeeded();
    await logo.evaluate((img, src) => img.setAttribute('src', src), brokenLogo);
    await expect(logo).toHaveAttribute('src', '/images/project-default.svg');
    await expect
        .poll(() =>
            logo.evaluate((img) => (img as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
    const link = logo.locator('xpath=ancestor::a');
    await link.focus();
    await expect(link).toBeFocused();
});
