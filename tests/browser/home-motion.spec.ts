import { expect, test } from '@playwright/test';

test.use({ reducedMotion: 'no-preference' });

for (const width of [375, 1440]) {
    test(`homepage cards stay opaque when scrolling to the bottom and back at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/');
        await page.evaluate(() => document.fonts.ready);

        const result = await page.evaluate(async () => {
            const cards = [...document.querySelectorAll('[data-home-card]')];
            const targets = cards.flatMap((card) => [
                card,
                ...card.querySelectorAll('[data-home-item]'),
            ]);
            const seen = new Set<string>();
            const faded = new Map<string, number>();
            const sample = () => {
                for (const [index, target] of targets.entries()) {
                    const rect = target.getBoundingClientRect();
                    if (
                        rect.width === 0 ||
                        rect.height === 0 ||
                        rect.bottom <= 0 ||
                        rect.top >= innerHeight
                    )
                        continue;
                    const id = target
                        .closest('[data-home-card]')!
                        .getAttribute('data-home-card')!;
                    seen.add(id);
                    const opacity = Number(getComputedStyle(target).opacity);
                    if (opacity < 1)
                        faded.set(
                            `${id}:${index}`,
                            Math.min(faded.get(`${id}:${index}`) ?? 1, opacity),
                        );
                }
            };
            const frames = (count: number) =>
                new Promise<void>((resolve) => {
                    const next = () => {
                        sample();
                        if (--count === 0) resolve();
                        else requestAnimationFrame(next);
                    };
                    requestAnimationFrame(next);
                });

            // A jump skips the middle cards' first intersection; returning upward
            // must not hide content that the browser has already painted.
            for (let pass = 0; pass < 2; pass++) {
                scrollTo({
                    top: document.documentElement.scrollHeight,
                    behavior: 'instant',
                });
                await frames(10);
                for (let y = scrollY - 320; y > 0; y -= 320) {
                    scrollTo({ top: y, behavior: 'instant' });
                    await frames(10);
                }
                scrollTo({ top: 0, behavior: 'instant' });
                await frames(10);
            }
            return {
                cards: cards.map((card) => card.getAttribute('data-home-card')),
                seen: [...seen],
                faded: [...faded],
            };
        });

        expect(result.seen.sort()).toEqual(result.cards.sort());
        // Check sampled frames, not a polling assertion that could wait out a fade.
        expect(result.faded).toEqual([]);
    });
}
