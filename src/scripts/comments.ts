import { loadTwikoo, prepareTwikooLanguage } from './twikoo';

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
    let loading = false;

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

    async function load() {
        if (!current() || loading) return;
        loading = true;
        state('loading');
        try {
            const client = await loadTwikoo(assetBaseUrl!);
            if (!current()) return;
            const language = await prepareTwikooLanguage(assetBaseUrl!, lang!);
            if (!current()) return;
            // The SDK replaces its previous app on init, but has no public destroy.
            // Serialize initializations and use unique targets across route changes.
            const pending = initialization.then(async () => {
                if (!current()) return;
                mount!.replaceChildren();
                await client.init({
                    envId: envId!,
                    path: path!,
                    lang: language,
                    el: selector,
                    localeBaseUrl: new URL(assetBaseUrl!, location.href).href,
                    ...(region ? { region } : {}),
                });
            });
            initialization = pending.catch(() => undefined);
            await pending;
            state('ready');
        } catch {
            state('error');
        } finally {
            loading = false;
        }
    }

    state('waiting');
    retry?.addEventListener(
        'click',
        () => {
            void load();
        },
        { signal },
    );
    if (typeof IntersectionObserver === 'undefined') {
        void load();
        return;
    }
    const observer = new IntersectionObserver(
        (entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            observer.disconnect();
            void load();
        },
        { rootMargin: '300px' },
    );
    observer.observe(root);
    signal.addEventListener('abort', () => observer.disconnect(), {
        once: true,
    });
}
