export function setupDialogs(signal: AbortSignal) {
    if (signal.aborted) return;
    const root = document.documentElement;
    const measureScrollbar = () => {
        if (!document.querySelector('dialog:modal'))
            root.style.setProperty(
                '--dialog-scrollbar-width',
                `${window.innerWidth - root.clientWidth}px`,
            );
    };
    measureScrollbar();
    window.addEventListener('resize', measureScrollbar, { signal });
    document.addEventListener(
        'beforetoggle',
        (event) => {
            if (
                event.target instanceof HTMLDialogElement &&
                (event as ToggleEvent).newState === 'open'
            )
                measureScrollbar();
        },
        { signal, capture: true },
    );
    document.addEventListener(
        'click',
        (event) => {
            const target =
                event.target instanceof Element ? event.target : null;
            if (!target) return;
            const tocLink =
                target.closest<HTMLAnchorElement>('[data-toc-link]');
            if (tocLink) {
                tocLink
                    .closest<HTMLDialogElement>('#article-toc-dialog')
                    ?.close();
                const inlineToc =
                    tocLink.closest<HTMLDetailsElement>('.mobile-toc');
                if (inlineToc) inlineToc.open = false;
            }
            if (target.closest('[data-close-dialog]'))
                target.closest<HTMLDialogElement>('dialog')?.close();
            if (target instanceof HTMLDialogElement) {
                const rect = target.getBoundingClientRect();
                if (
                    event.clientX < rect.left ||
                    event.clientX > rect.right ||
                    event.clientY < rect.top ||
                    event.clientY > rect.bottom
                )
                    target.close();
            }
        },
        { signal },
    );
    signal.addEventListener(
        'abort',
        () => {
            document
                .querySelectorAll<HTMLDialogElement>('dialog[open]')
                .forEach((dialog) => dialog.close());
            root.style.removeProperty('--dialog-scrollbar-width');
        },
        { once: true },
    );
}
