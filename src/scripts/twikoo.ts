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

function loadResource(kind: 'script' | 'link', url: string): Promise<void> {
    const cached = resources.get(url);
    if (cached) return cached;
    const task = new Promise<void>((resolve, reject) => {
        const host = document.querySelector('[data-comment-assets]');
        if (!host) {
            reject(new Error('Missing comment resource host'));
            return;
        }
        const element = document.createElement(kind);
        if (element instanceof HTMLScriptElement) {
            element.src = url;
            element.async = true;
            // Astro must not execute this document-owned script again on a swap.
            element.dataset.astroExec = '';
        } else {
            element.rel = 'stylesheet';
            element.href = url;
        }
        const finish = (error?: Error) => {
            clearTimeout(timer);
            element.onload = null;
            element.onerror = null;
            if (error) {
                element.remove();
                resources.delete(url);
                reject(error);
            } else resolve();
        };
        const timer = window.setTimeout(
            () => finish(new Error('Comment resource timeout')),
            15_000,
        );
        element.onload = () => finish();
        element.onerror = () => finish(new Error('Comment resource failed'));
        host.append(element);
    });
    resources.set(url, task);
    return task;
}

export function loadTwikoo(assetBaseUrl: string): Promise<TwikooClient> {
    const base = new URL(assetBaseUrl, location.href).href;
    const cached = clients.get(base);
    if (cached) return cached;
    const task = Promise.all([
        loadResource('link', new URL('twikoo.css', base).href),
        loadResource('script', new URL('twikoo.nocss.js', base).href),
    ])
        .then(() => {
            const client = (window as Window & { twikoo?: TwikooClient })
                .twikoo;
            if (!client || typeof client.init !== 'function') {
                const script = new URL('twikoo.nocss.js', base).href;
                resources.delete(script);
                document
                    .querySelectorAll<HTMLScriptElement>(
                        '[data-comment-assets] script',
                    )
                    .forEach((element) => {
                        if (element.src === script) element.remove();
                    });
                throw new Error('Invalid Twikoo client');
            }
            return client;
        })
        .catch((error) => {
            clients.delete(base);
            throw error;
        });
    clients.set(base, task);
    return task;
}
