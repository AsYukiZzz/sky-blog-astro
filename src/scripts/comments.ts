import { loadTwikoo, preloadTwikoo, prepareTwikooLanguage } from './twikoo';

let mountNumber = 0;
let initialization: Promise<unknown> = Promise.resolve();
const statusMessages = {
    waiting: '评论将在靠近时加载。',
    loading: '正在加载评论…',
    ready: '',
    error: '评论暂时无法加载，请稍后重试。',
};

export function setupComments(signal: AbortSignal): void {
    const root = document.querySelector<HTMLElement>('[data-comments]');
    const mount = root?.querySelector<HTMLElement>('[data-comment-mount]');
    if (signal.aborted || !root || !mount) return;
    const status = root.querySelector<HTMLElement>('[data-comment-status]');
    const retry = root.querySelector<HTMLButtonElement>('[data-comment-retry]');
    const { envId, path, lang, region, assetBaseUrl } = root.dataset;
    if (!envId || !path || !lang || !assetBaseUrl) return;
    mount.id = `sky-twikoo-${++mountNumber}`;
    const selector = `#${mount.id}`;
    const current = () => !signal.aborted && root.isConnected;
    const active = () => {
        if (!current()) return false;
        if (typeof IntersectionObserver === 'undefined') return true;
        const bounds = root.getBoundingClientRect();
        return bounds.top < innerHeight && bounds.bottom > 0;
    };
    let loading = false;
    let initialized = false;
    let preloadObserver: IntersectionObserver | undefined;
    let visibleObserver: IntersectionObserver | undefined;

    function state(value: keyof typeof statusMessages) {
        if (!current()) return;
        root!.dataset.commentState = value;
        root!.setAttribute('aria-busy', String(value === 'loading'));
        if (status) {
            status.hidden = value === 'ready';
            status.textContent = statusMessages[value];
        }
        if (retry) retry.hidden = value !== 'error';
    }

    async function load(retryRequested = false) {
        if (!active() || loading || initialized) return;
        if (!retryRequested && root!.dataset.commentState === 'error') return;
        loading = true;
        state('loading');
        try {
            const client = await loadTwikoo(assetBaseUrl!, envId!, active);
            if (!client || !active()) {
                state('waiting');
                return;
            }
            const language = await prepareTwikooLanguage(assetBaseUrl!, lang!);
            // The SDK replaces its previous app on init, but has no public destroy.
            // Serialize initializations and use unique targets across route changes.
            const pending = initialization.then(async () => {
                if (!active()) return false;
                mount!.replaceChildren();
                await client.init({
                    envId: envId!,
                    path: path!,
                    lang: language,
                    el: selector,
                    localeBaseUrl: new URL(assetBaseUrl!, location.href).href,
                    ...(region ? { region } : {}),
                });
                return true;
            });
            initialization = pending.catch(() => undefined);
            initialized = await pending;
            state(initialized ? 'ready' : 'waiting');
            if (initialized) {
                preloadObserver?.disconnect();
                visibleObserver?.disconnect();
            }
        } catch {
            state('error');
        } finally {
            loading = false;
            if (current() && root!.dataset.commentState === 'waiting') {
                visibleObserver?.unobserve(root!);
                visibleObserver?.observe(root!);
            }
        }
    }

    state('waiting');
    retry?.addEventListener(
        'click',
        () => {
            void load(true);
        },
        { signal },
    );
    if (typeof IntersectionObserver === 'undefined') {
        void load();
        return;
    }
    preloadObserver = new IntersectionObserver(
        (entries) => {
            if (!current() || !entries.some((entry) => entry.isIntersecting))
                return;
            preloadObserver?.disconnect();
            void preloadTwikoo(assetBaseUrl!, envId!).catch(() =>
                state('error'),
            );
        },
        { rootMargin: '300px' },
    );
    visibleObserver = new IntersectionObserver(
        (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) void load();
        },
        // Threshold 0 reports edge contact but may not notify again when the
        // section gains positive visible area after active() rejected contact.
        { threshold: 0.001 },
    );
    preloadObserver.observe(root);
    visibleObserver.observe(root);
    signal.addEventListener(
        'abort',
        () => {
            preloadObserver?.disconnect();
            visibleObserver?.disconnect();
        },
        {
            once: true,
        },
    );
}
