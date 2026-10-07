import { themeColorScheme } from '../lib/theme-state';

export function updateCommentTheme(name: string) {
    document
        .querySelector<HTMLIFrameElement>('.giscus-frame')
        ?.contentWindow?.postMessage(
            {
                giscus: {
                    setConfig: { theme: themeColorScheme(name) },
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
        theme: themeColorScheme(document.documentElement.dataset.theme ?? ''),
        lang: 'zh-CN',
        loading: 'lazy',
    });
    giscus.append(script);
    signal.addEventListener('abort', () => script.remove(), { once: true });
}
