import type { ColorScheme } from '../lib/theme-state';

export function updateCommentTheme(colorScheme: ColorScheme) {
    document
        .querySelector<HTMLIFrameElement>('.giscus-frame')
        ?.contentWindow?.postMessage(
            {
                giscus: {
                    setConfig: { theme: colorScheme },
                },
            },
            'https://giscus.app',
        );
}

export function setupComments(signal: AbortSignal) {
    if (signal.aborted) return;
    const giscus = document.querySelector<HTMLElement>('[data-giscus]');
    if (!giscus || giscus.querySelector('script, .giscus-frame')) return;
    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    for (const attribute of [
        'repo',
        'repoId',
        'category',
        'categoryId',
    ] as const)
        script.dataset[attribute] = giscus.dataset[attribute];
    Object.assign(script.dataset, {
        mapping: 'pathname',
        strict: '1',
        reactionsEnabled: '1',
        emitMetadata: '0',
        inputPosition: 'top',
        theme:
            document.documentElement.dataset.colorScheme === 'dark'
                ? 'dark'
                : 'light',
        lang: 'zh-CN',
        loading: 'lazy',
    });
    giscus.append(script);
    signal.addEventListener('abort', () => script.remove(), { once: true });
}
