import { revealTocLink } from './toc-scroll';

export function setupDialogs(signal: AbortSignal) {
    if (signal.aborted) return;
    const dialogs = [...document.querySelectorAll<HTMLDialogElement>('dialog')];
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
    dialogs.forEach((dialog) =>
        dialog.addEventListener(
            'beforetoggle',
            (event) => {
                if (event.newState === 'open') measureScrollbar();
            },
            { signal },
        ),
    );
    document.addEventListener(
        'click',
        (event) => {
            const target =
                event.target instanceof Element ? event.target : null;
            if (!target) return;
            if (target.closest('[data-theme-picker]'))
                document
                    .querySelector<HTMLDialogElement>('#theme-picker')
                    ?.showModal();
            if (target.closest('[data-open-toc]')) {
                const dialog = document.querySelector<HTMLDialogElement>(
                    '#article-toc-dialog',
                );
                dialog?.showModal();
                const activeLink = dialog?.querySelector<HTMLElement>(
                    '[aria-current="location"]',
                );
                const scrollArea = dialog?.querySelector<HTMLElement>(
                    '.toc-dialog-content',
                );
                if (activeLink && scrollArea)
                    revealTocLink(activeLink, scrollArea);
            }
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
            dialogs.forEach((dialog) => dialog.open && dialog.close());
            root.style.removeProperty('--dialog-scrollbar-width');
        },
        { once: true },
    );
}
