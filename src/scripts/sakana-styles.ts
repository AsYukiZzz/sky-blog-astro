import type { TransitionBeforeSwapEvent } from 'astro:transitions/client';

/** Load optional vendor CSS alongside the widget, including after route returns. */
export function createSakanaStylesLoader(href: string, signal: AbortSignal) {
    const absolute = new URL(href, location.href).href;
    const find = (doc: Document) =>
        [
            ...doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
        ].find(
            (link) =>
                link.getAttribute('href') === href || link.href === absolute,
        );
    let pending: Promise<void> | undefined;

    // Astro matches head stylesheets by href. Keep CSS while the widget persists;
    // leaving the home page removes it normally, and a later visit loads it again.
    document.addEventListener(
        'astro:before-swap',
        (event) => {
            const incoming = (event as TransitionBeforeSwapEvent).newDocument;
            const current = find(document);
            if (
                current &&
                incoming.querySelector('[data-sakana]') &&
                !find(incoming)
            )
                incoming.head.append(current.cloneNode(true));
        },
        { signal },
    );

    return function load(): Promise<void> {
        if (signal.aborted)
            return Promise.reject(
                new DOMException('Navigation cancelled', 'AbortError'),
            );
        if (pending) return pending;
        let link = find(document);
        if (link?.sheet) return Promise.resolve();
        const owned = !link;
        if (!link) {
            link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.dataset.sakanaStyles = '';
        }
        const stylesheet = link;
        pending = new Promise<void>((resolve, reject) => {
            const cleanup = () => {
                stylesheet.removeEventListener('load', loaded);
                stylesheet.removeEventListener('error', failed);
                signal.removeEventListener('abort', aborted);
            };
            const loaded = () => {
                cleanup();
                resolve();
            };
            const failed = () => {
                cleanup();
                if (owned) stylesheet.remove();
                reject(new Error('Sakana stylesheet failed to load'));
            };
            const aborted = () => {
                cleanup();
                if (owned) stylesheet.remove();
                reject(new DOMException('Navigation cancelled', 'AbortError'));
            };
            stylesheet.addEventListener('load', loaded, { once: true });
            stylesheet.addEventListener('error', failed, { once: true });
            signal.addEventListener('abort', aborted, { once: true });
            if (owned) document.head.append(stylesheet);
        }).finally(() => {
            pending = undefined;
        });
        return pending;
    };
}
