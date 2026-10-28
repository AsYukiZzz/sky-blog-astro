import { expect, test, type Page } from '@playwright/test';
import { createBackgroundSite } from '../fixtures/site-background';

let site: Awaited<ReturnType<typeof createBackgroundSite>>;

test.use({ reducedMotion: 'no-preference' });
test.beforeAll(async () => {
    test.setTimeout(120_000);
    site = await createBackgroundSite({
        background: {
            wallpapers: [{ id: 'stripes', image: '/navigation-stripes.svg' }],
        },
        // Keep the pixel contrast threshold independent of user glass settings.
        glass: {
            blur: 32,
            saturation: 1.3,
            opacity: { light: 0.72, dark: 0.65 },
        },
    });
});
test.afterAll(async () => site?.close());

async function openHome(page: Page) {
    // High-frequency wallpaper makes even one missing/unblurred navigation
    // frame measurable, without changing the real router or glass surfaces.
    await page.route('**/navigation-stripes.svg', (route) =>
        route.fulfill({
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900"><defs><pattern id="p" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="white"/><rect width="6" height="12" fill="black"/></pattern></defs><rect width="1440" height="900" fill="url(#p)"/></svg>',
        }),
    );
    await page.goto(site.origin);
    await page.locator('[data-page-loading]').waitFor({ state: 'hidden' });
    await page.evaluate(() => document.fonts.ready);
}

async function navigationLink(page: Page, path: string) {
    if (page.viewportSize()!.width < 1024) {
        await page.locator('[data-menu-toggle]').click();
        return page.locator(`#mobile-navigation nav > div > a[href="${path}"]`);
    }
    if (path === '/archives/') {
        await page.locator('.nav-dropdown').hover();
        return page.locator(`.dropdown-panel a[href="${path}"]`);
    }
    return page.locator(`.desktop-nav > a[href="${path}"]`);
}

declare global {
    interface Window {
        navigationMotionProbe: {
            background: Element | null;
            nativeTransitions: number;
            sampling: boolean;
            cardFrames: number;
            faded: Record<string, number>;
        };
    }
}

async function observeNavigation(page: Page) {
    await page.evaluate(() => {
        window.navigationMotionProbe = {
            background: document.querySelector('[data-site-background]'),
            nativeTransitions: 0,
            sampling: true,
            cardFrames: 0,
            faded: {},
        };
        document.addEventListener('astro:before-swap', (event) => {
            const transition = (
                event as Event & { viewTransition: ViewTransition }
            ).viewTransition;
            if (
                Object.prototype.toString.call(transition) ===
                '[object ViewTransition]'
            )
                window.navigationMotionProbe.nativeTransitions++;
        });
    });
}

for (const path of ['/archives/', '/links/']) {
    test(`listing glass stays opaque throughout entry into ${path}`, async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await openHome(page);
        await observeNavigation(page);
        await page.evaluate(() => {
            const sample = () => {
                const probe = window.navigationMotionProbe;
                if (!probe.sampling) return;
                for (const card of document.querySelectorAll(
                    '.archive-post,.friend-card',
                )) {
                    const rect = card.getBoundingClientRect();
                    if (rect.bottom <= 0 || rect.top >= innerHeight) continue;
                    probe.cardFrames++;
                    // Opacity on a wrapper also fades the glass and changes
                    // its backdrop root; checking only the card misses this.
                    for (
                        let node: Element | null = card;
                        node;
                        node = node.parentElement
                    ) {
                        const opacity = Number(getComputedStyle(node).opacity);
                        if (opacity < 1) {
                            const key = `${node.tagName}.${node.className}`;
                            probe.faded[key] = Math.min(
                                probe.faded[key] ?? 1,
                                opacity,
                            );
                        }
                    }
                }
                requestAnimationFrame(sample);
            };
            requestAnimationFrame(sample);
        });
        await (await navigationLink(page, path)).click();
        await page.waitForURL(`${site.origin}${path}`);
        await page.locator('.archive-post,.friend-card').first().waitFor();
        // Observe the whole entry, including its bounded stagger, rather than
        // polling until an incorrect fade has already finished.
        await page.waitForTimeout(800);
        const result = await page.evaluate(() => {
            window.navigationMotionProbe.sampling = false;
            return window.navigationMotionProbe;
        });
        expect(result.cardFrames).toBeGreaterThan(10);
        expect(result.faded).toEqual({});
    });
}

const navigationCases = [
    { scheme: 'light', width: 1440, motion: 'no-preference', slow: false },
    { scheme: 'dark', width: 1440, motion: 'no-preference', slow: false },
    { scheme: 'light', width: 375, motion: 'no-preference', slow: false },
    { scheme: 'dark', width: 375, motion: 'no-preference', slow: false },
    { scheme: 'light', width: 1440, motion: 'reduce', slow: false },
    { scheme: 'dark', width: 1440, motion: 'no-preference', slow: true },
] as const;

for (const { scheme, width, motion, slow } of navigationCases) {
    test(`navigation remains blurred in every transition frame: ${scheme} ${width}px ${motion}${slow ? ' slow' : ''}`, async ({
        page,
        context,
    }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: motion, colorScheme: scheme });
        await page.addInitScript(
            (value) => localStorage.setItem('sky-theme', value),
            scheme,
        );
        await openHome(page);
        await observeNavigation(page);
        if (slow) {
            await page.route(/\/(archives|links)\/$/, async (route) => {
                await new Promise((resolve) => setTimeout(resolve, 350));
                await route.continue();
            });
        }

        for (const [index, path] of ['/archives/', '/links/'].entries()) {
            const link = await navigationLink(page, path);
            const session = await context.newCDPSession(page);
            const frames: string[] = [];
            session.on('Page.screencastFrame', (event) => {
                frames.push(event.data);
                void session
                    .send('Page.screencastFrameAck', {
                        sessionId: event.sessionId,
                    })
                    .catch(() => {});
            });
            await session.send('Page.startScreencast', {
                format: 'png',
                everyNthFrame: 1,
            });
            try {
                await link.click();
                await page.waitForURL(`${site.origin}${path}`);
                await page
                    .locator('[data-page-loading]')
                    .waitFor({ state: 'hidden' });
                await page.waitForTimeout(800);
            } finally {
                await session.send('Page.stopScreencast');
                await session.detach();
            }
            // DOM styles cannot see a wallpaper snapshot covering the nav.
            // Measure actual compositor frames in a text-free part of its glass.
            const contrasts = await page.evaluate(
                async ({ frames, width }) => {
                    const canvas = document.createElement('canvas');
                    canvas.width = width < 1024 ? 60 : 120;
                    canvas.height = 16;
                    const context = canvas.getContext('2d')!;
                    const contrasts: number[] = [];
                    for (const data of frames) {
                        const image = new Image();
                        image.src = `data:image/png;base64,${data}`;
                        await image.decode();
                        context.drawImage(
                            image,
                            width < 1024 ? 180 : 300,
                            20,
                            canvas.width,
                            canvas.height,
                            0,
                            0,
                            canvas.width,
                            canvas.height,
                        );
                        const pixels = context.getImageData(
                            0,
                            0,
                            canvas.width,
                            canvas.height,
                        ).data;
                        let min = 255;
                        let max = 0;
                        for (let i = 0; i < pixels.length; i += 4) {
                            min = Math.min(min, pixels[i]);
                            max = Math.max(max, pixels[i]);
                        }
                        contrasts.push(max - min);
                    }
                    return contrasts;
                },
                { frames, width },
            );
            const maximum = Math.max(...contrasts);
            await testInfo.attach(`navigation-${index}-contrast`, {
                body: JSON.stringify(contrasts),
                contentType: 'application/json',
            });
            if (maximum >= 16) {
                await testInfo.attach(`navigation-${index}-worst-frame`, {
                    body: Buffer.from(
                        frames[contrasts.indexOf(maximum)],
                        'base64',
                    ),
                    contentType: 'image/png',
                });
            }
            expect(frames.length).toBeGreaterThan(2);
            expect(
                maximum,
                `raw wallpaper appeared over navigation while entering ${path}`,
            ).toBeLessThan(16);
            expect(
                await page.evaluate(() => ({
                    nativeTransitions:
                        window.navigationMotionProbe.nativeTransitions,
                    backgroundPersisted:
                        window.navigationMotionProbe.background ===
                        document.querySelector('[data-site-background]'),
                })),
            ).toEqual({
                nativeTransitions: index + 1,
                backgroundPersisted: true,
            });
        }
    });
}
