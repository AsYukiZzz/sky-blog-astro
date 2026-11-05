export interface TwikooOptions {
    envId: string;
    el: string;
    path: string;
    lang: string;
    region?: string;
    localeBaseUrl: string;
}

export interface TwikooClient {
    init(options: TwikooOptions): Promise<unknown> | void;
}

const resources = new Map<string, Promise<void>>();
const clients = new Map<string, Promise<TwikooClient>>();
const languages = new Map<string, Promise<void>>();
const downloadRetries = new Map<string, number>();
// Canonical shard names and aliases used by the fixed Twikoo 2.x client.
const localeAliases = new Map([
    ['zh', 'zh-CN'],
    ['zh-cn', 'zh-CN'],
    ['zh-hk', 'zh-HK'],
    ['zh-tw', 'zh-TW'],
    ['en', 'en'],
    ['en-us', 'en'],
    ['en-gb', 'en'],
    ['uz', 'uz-UZ'],
    ['uz-uz', 'uz-UZ'],
    ['ja', 'ja-JP'],
    ['ja-jp', 'ja-JP'],
    ['ko', 'ko-KR'],
    ['ko-kr', 'ko-KR'],
    ['vi', 'vi-VN'],
    ['vi-vn', 'vi-VN'],
    ['id', 'id-ID'],
    ['id-id', 'id-ID'],
]);

export async function prepareTwikooLanguage(
    assetBaseUrl: string,
    language: string,
): Promise<string> {
    const lang =
        localeAliases.get(language.toLowerCase()) ??
        localeAliases.get(navigator.language.toLowerCase()) ??
        'en';
    if (lang === 'zh-CN' || lang === 'en') return lang;
    const url = new URL(
        `locales/${lang}.js`,
        new URL(assetBaseUrl, location.href),
    ).href;
    let pending = languages.get(url);
    if (!pending) {
        let timer: number | undefined;
        pending = Promise.race([
            import(/* @vite-ignore */ url).then(() => undefined),
            new Promise<void>((_, reject) => {
                timer = window.setTimeout(
                    () => reject(new Error('Comment locale timeout')),
                    15_000,
                );
            }),
        ])
            .finally(() => clearTimeout(timer))
            .catch((error) => {
                languages.delete(url);
                throw error;
            });
        languages.set(url, pending);
    }
    // Import succeeds before init enters the serial queue. The SDK then reads
    // the same module from the browser cache instead of blocking other mounts.
    await pending;
    return lang;
}

type ResourceKind = 'script' | 'stylesheet' | 'preload';

function sdkResources(assetBaseUrl: string, envId: string) {
    const base = new URL(assetBaseUrl, location.href);
    // Match the HTTP backend check in the fixed Twikoo client.
    const http = /^https?:\/\//.test(envId);
    const script = new URL(http ? 'twikoo.min.js' : 'twikoo.nocss.js', base);
    const source = script.href;
    const attempt = downloadRetries.get(source) ?? 0;
    if (attempt) script.searchParams.set('_comment_retry', String(attempt));
    return {
        source,
        attempt,
        script: script.href,
        stylesheet: http ? undefined : new URL('twikoo.css', base).href,
    };
}

function retryDownload(resource: ReturnType<typeof sdkResources>) {
    // Chromium retains failed/invalid preload responses for a URL. Change only
    // failed attempts, keeping preload and execution on the same resource URL.
    if ((downloadRetries.get(resource.source) ?? 0) === resource.attempt) {
        downloadRetries.set(resource.source, resource.attempt + 1);
    }
}

function loadResource(kind: ResourceKind, url: string): Promise<void> {
    const key = `${kind}:${url}`;
    const cached = resources.get(key);
    if (cached) return cached;
    const task = new Promise<void>((resolve, reject) => {
        const host = document.querySelector('[data-comment-assets]');
        if (!host) {
            reject(new Error('Missing comment resource host'));
            return;
        }
        const element = document.createElement(
            kind === 'script' ? 'script' : 'link',
        );
        if (element instanceof HTMLScriptElement) {
            element.src = url;
            element.async = true;
            // Astro must not execute this document-owned script again on a swap.
            element.dataset.astroExec = '';
        } else {
            element.rel = kind === 'preload' ? 'preload' : 'stylesheet';
            if (kind === 'preload') element.as = 'script';
            element.href = url;
        }
        const finish = (error?: Error) => {
            clearTimeout(timer);
            element.onload = null;
            element.onerror = null;
            if (error) {
                element.remove();
                resources.delete(key);
                reject(error);
            } else {
                if (kind === 'script') {
                    // The lite SDK injects CSS into head. Keep that CSS through
                    // Astro head swaps together with the document-owned script.
                    for (const style of document.head.querySelectorAll<HTMLStyleElement>(
                        'style[data-twikoo]',
                    )) {
                        style.dataset.commentAsset = url;
                        host.append(style);
                    }
                }
                resolve();
            }
        };
        const timer = window.setTimeout(
            () => finish(new Error('Comment resource timeout')),
            15_000,
        );
        element.onload = () => finish();
        element.onerror = () => finish(new Error('Comment resource failed'));
        host.append(element);
    });
    resources.set(key, task);
    return task;
}

export function preloadTwikoo(
    assetBaseUrl: string,
    envId: string,
): Promise<void> {
    const resource = sdkResources(assetBaseUrl, envId);
    return loadResource('preload', resource.script).catch((error) => {
        retryDownload(resource);
        throw error;
    });
}

export async function loadTwikoo(
    assetBaseUrl: string,
    envId: string,
    active: () => boolean,
): Promise<TwikooClient | undefined> {
    const resource = sdkResources(assetBaseUrl, envId);
    const { script, stylesheet } = resource;
    // Never insert an executable script while its download is still pending.
    // An abandoned page may finish preloading, but cannot start SDK execution.
    await preloadTwikoo(assetBaseUrl, envId);
    if (!active()) return;
    const cached = clients.get(script);
    if (cached) return cached;
    const task = Promise.all([
        stylesheet ? loadResource('stylesheet', stylesheet) : Promise.resolve(),
        loadResource('script', script),
    ])
        .then(() => {
            const client = (window as Window & { twikoo?: TwikooClient })
                .twikoo;
            if (!client || typeof client.init !== 'function') {
                retryDownload(resource);
                resources.delete(`script:${script}`);
                resources.delete(`preload:${script}`);
                document
                    .querySelectorAll<
                        HTMLScriptElement | HTMLLinkElement | HTMLStyleElement
                    >(
                        '[data-comment-assets] script, [data-comment-assets] link[rel="preload"], [data-comment-assets] style[data-twikoo]',
                    )
                    .forEach((element) => {
                        if (
                            (element instanceof HTMLScriptElement &&
                                element.src === script) ||
                            (element instanceof HTMLLinkElement &&
                                element.href === script) ||
                            element.dataset.commentAsset === script
                        )
                            element.remove();
                    });
                throw new Error('Invalid Twikoo client');
            }
            return client;
        })
        .catch((error) => {
            clients.delete(script);
            throw error;
        });
    clients.set(script, task);
    return task;
}
