import { expect, test } from '@playwright/test';
import { createBackgroundSite } from '../fixtures/site-background';

const endpoint = 'https://comments.example.test/api/';

test('the default global switch hides comments on all detail types', async ({
    page,
}) => {
    for (const path of [
        '/posts/format-example/',
        '/moments/format-example/',
        '/pages/privacy/',
    ]) {
        await page.goto(path);
        await expect(page.locator('[data-comments]')).toHaveCount(0);
    }
});

for (const postComment of [false, true]) {
    test(`article and essay visibility are independent with post=${postComment}`, async ({
        page,
    }) => {
        test.setTimeout(120_000);
        const site = await createBackgroundSite({
            comment: { enabled: true, twikoo: { envId: endpoint } },
            postComment,
            essayComment: !postComment,
        });
        try {
            for (const [path, visible] of [
                ['/posts/format-example/', postComment],
                ['/moments/format-example/', !postComment],
                ['/pages/privacy/', true],
            ] as const) {
                await page.goto(`${site.origin}${path}`);
                const comments = page.locator('[data-comments]');
                await expect(comments).toHaveCount(visible ? 1 : 0);
                if (visible) {
                    await expect(comments).toHaveAttribute(
                        'data-env-id',
                        endpoint,
                    );
                    await expect(comments).toHaveAttribute(
                        'data-path',
                        path.replace(/\/$/, ''),
                    );
                    await expect(comments).toHaveAttribute(
                        'data-provider',
                        'twikoo',
                    );
                    await expect(comments).toHaveAttribute(
                        'data-pagefind-ignore',
                        '',
                    );
                    await expect(comments).toHaveCSS(
                        'backdrop-filter',
                        'blur(32px) saturate(1.3)',
                    );
                }
            }
        } finally {
            await site.close();
        }
    });
}
