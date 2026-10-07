export function setupClipboard(signal: AbortSignal) {
    if (signal.aborted) return;
    const status = document.querySelector<HTMLElement>('.toast-status');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const toast = (message: string) => {
        if (signal.aborted || !status) return;
        status.textContent = message;
        status.hidden = false;
        clearTimeout(timer);
        timer = setTimeout(() => {
            status.hidden = true;
        }, 2200);
    };
    const copyText = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast('已复制到剪贴板');
        } catch {
            toast('复制失败，请手动选择并复制');
        }
    };
    document
        .querySelectorAll<HTMLElement>('#article-content pre')
        .forEach((pre) => {
            if (pre.querySelector('.copy-code-button')) return;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'copy-code-button';
            button.textContent = '复制';
            button.setAttribute('aria-label', '复制代码');
            pre.append(button);
        });
    document.addEventListener(
        'click',
        (event) => {
            const target =
                event.target instanceof Element ? event.target : null;
            if (!target) return;
            const url =
                document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
                    ?.href ?? location.href;
            if (target.closest('[data-copy-link]')) void copyText(url);
            if (target.closest('[data-share]')) {
                if (navigator.share)
                    void navigator
                        .share({ title: document.title, url })
                        .catch(() => {});
                else void copyText(url);
            }
            const code = target.closest<HTMLButtonElement>('.copy-code-button');
            if (code)
                void copyText(
                    code.closest('pre')?.querySelector('code')?.textContent ??
                        '',
                );
        },
        { signal },
    );
    signal.addEventListener(
        'abort',
        () => {
            clearTimeout(timer);
            if (status) status.hidden = true;
        },
        { once: true },
    );
}
