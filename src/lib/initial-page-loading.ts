import type { PageLoadingConfig } from '../types/config.ts';

export interface InitialPageLoadingElement extends HTMLElement {
    initialLoading?: { ready(): void; cancel(): void };
}

function startInitialPageLoading(preview: boolean, loading: PageLoadingConfig) {
    const layer = document.querySelector<InitialPageLoadingElement>(
        '[data-page-loading]',
    );
    if (!layer || layer.initialLoading) return;
    const root = document.documentElement;
    const blocked: HTMLElement[] = [];
    let finished = false;
    let resourcesReady = false;
    let runtimeReady = false;
    let previewReady = !preview;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let previewTimer: ReturnType<typeof setTimeout> | undefined;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;

    const blockContent = () => {
        if (layer.dataset.phase !== 'initial') return;
        for (const element of document.body.children) {
            if (
                element instanceof HTMLElement &&
                element !== layer &&
                element.tagName !== 'SCRIPT' &&
                !element.inert
            ) {
                element.inert = true;
                blocked.push(element);
            }
        }
    };
    const bodyChanges = new MutationObserver(blockContent);
    const conceal = () => {
        clearTimeout(deadline);
        clearTimeout(previewTimer);
        clearTimeout(fadeTimer);
        bodyChanges.disconnect();
        document.removeEventListener('DOMContentLoaded', prepare);
        window.removeEventListener('pagehide', cancel);
        if (layer.hidePopover && layer.matches(':popover-open'))
            layer.hidePopover();
        layer.hidden = true;
        delete layer.dataset.phase;
        delete layer.dataset.state;
        delete layer.initialLoading;
        root.removeAttribute('aria-busy');
        for (const element of blocked) element.inert = false;
    };
    const cancel = () => {
        finished = true;
        conceal();
    };
    const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(deadline);
        clearTimeout(previewTimer);
        layer.dataset.state = 'hiding';
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) conceal();
        else fadeTimer = setTimeout(conceal, 150);
    };
    const finishIfReady = () => {
        if (resourcesReady && runtimeReady && previewReady) finish();
    };
    const imageReady = async (image: HTMLImageElement) => {
        if (!image.complete) {
            await new Promise<void>((resolve) => {
                const done = () => {
                    image.removeEventListener('load', done);
                    image.removeEventListener('error', done);
                    resolve();
                };
                image.addEventListener('load', done, { once: true });
                image.addEventListener('error', done, { once: true });
            });
        }
        if (image.naturalWidth > 0 && image.decode) {
            try {
                await image.decode();
            } catch {
                /* A loaded image can still be displayed. */
            }
        }
    };
    const wallpaper = document.querySelector<HTMLImageElement>(
        '[data-site-wallpaper]',
    );
    let wallpaperReady = Promise.resolve();
    if (wallpaper) {
        wallpaper.dataset.wallpaperState = 'pending';
        wallpaperReady = imageReady(wallpaper).then(() => {
            wallpaper.dataset.wallpaperState =
                wallpaper.naturalWidth > 0 ? 'ready' : 'failed';
        });
    }
    async function prepare() {
        if (finished) return;
        const images = [
            ...document.querySelectorAll<HTMLImageElement>('main img'),
        ].filter((image) => {
            if (image.loading === 'lazy' || image.getClientRects().length === 0)
                return false;
            const bounds = image.getBoundingClientRect();
            // A rendered eager image can still have no intrinsic width or height.
            const pendingSize = !image.complete && image.naturalWidth === 0;
            const visibleBottom =
                bounds.height > 0
                    ? bounds.bottom > 0
                    : pendingSize && bounds.top >= 0;
            const visibleRight =
                bounds.width > 0
                    ? bounds.right > 0
                    : pendingSize && bounds.left >= 0;
            return (
                visibleRight &&
                visibleBottom &&
                bounds.top < innerHeight &&
                bounds.left < innerWidth
            );
        });
        await Promise.all([
            loading.strategy === 'wallpaper' ? wallpaperReady : undefined,
            document.fonts?.ready.catch(() => {}),
            ...images.map(imageReady),
        ]);
        resourcesReady = true;
        finishIfReady();
    }

    layer.initialLoading = {
        ready() {
            runtimeReady = true;
            finishIfReady();
        },
        cancel,
    };
    layer.dataset.phase = 'initial';
    layer.dataset.state = 'visible';
    layer.hidden = false;
    root.setAttribute('aria-busy', 'true');
    // The remaining body may still be parsing while deferred modules are pending.
    bodyChanges.observe(document.body, { childList: true });
    blockContent();
    if (layer.showPopover && !layer.matches(':popover-open'))
        layer.showPopover();
    // This timeout is independent of the module graph and every image request.
    deadline = setTimeout(finish, loading.maxWait);
    if (preview)
        previewTimer = setTimeout(() => {
            previewReady = true;
            finishIfReady();
        }, 1500);
    window.addEventListener('pagehide', cancel, { once: true });
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', prepare, { once: true });
    else void prepare();
}

export function initialPageLoadingScript(
    preview: boolean,
    loading: PageLoadingConfig,
): string {
    const { strategy, maxWait } = loading;
    if (strategy !== 'wallpaper' && strategy !== 'content')
        throw new Error(
            'Invalid theme.global.loading.strategy in src/config.ts: 必须为 wallpaper 或 content。',
        );
    if (!Number.isInteger(maxWait) || maxWait < 0 || maxWait > 2_147_483_647)
        throw new Error(
            'Invalid theme.global.loading.maxWait in src/config.ts: 必须为 0 到 2147483647 的整数毫秒数。',
        );
    return `(${startInitialPageLoading.toString()})(${JSON.stringify(preview)}, ${JSON.stringify({ strategy, maxWait })});`;
}
