import { visibleArticleCount } from '../lib/article-posts-fit';

export function setupArticleTabs(signal: AbortSignal) {
    if (signal.aborted) return;
    const controllers = new Map<
        HTMLElement,
        {
            tabs: HTMLButtonElement[];
            activate: (tab: HTMLButtonElement, focus?: boolean) => void;
        }
    >();
    document
        .querySelectorAll<HTMLElement>('[data-article-posts-tabs]')
        .forEach((card) => {
            const tabs = [
                ...card.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
            ];
            const panels = [
                ...card.querySelectorAll<HTMLElement>('[role="tabpanel"]'),
            ];
            const inline = card.hasAttribute('data-article-posts-inline');
            let frame = 0;
            const fit = () => {
                frame = 0;
                if (signal.aborted || !card.getClientRects().length) return;
                panels
                    .filter((panel) => !panel.hidden)
                    .forEach((panel) => {
                        const list = panel.querySelector<HTMLOListElement>(
                            '.article-posts-list',
                        );
                        if (!list) return;
                        const rows = [
                            ...list.querySelectorAll<HTMLLIElement>(
                                ':scope > li',
                            ),
                        ];
                        rows.forEach((row) => {
                            row.hidden = false;
                        });
                        const gap =
                            Number.parseFloat(getComputedStyle(list).rowGap) ||
                            0;
                        const heights = rows.map(
                            (row) => row.getBoundingClientRect().height,
                        );
                        const available = panel.getBoundingClientRect().height;
                        const count = visibleArticleCount(
                            heights,
                            available,
                            gap,
                        );
                        rows.forEach((row, index) => {
                            row.hidden = index >= count;
                        });
                        const hint = panel.querySelector<HTMLElement>(
                            '[data-article-posts-space]',
                        );
                        if (hint) hint.hidden = count > 0;
                    });
            };
            const scheduleFit = () => {
                if (inline && !frame && !signal.aborted)
                    frame = requestAnimationFrame(fit);
            };
            const activate = (selected: HTMLButtonElement, focus = false) => {
                const panelId = selected.getAttribute('aria-controls');
                if (!panels.some((panel) => panel.id === panelId)) return;
                tabs.forEach((tab) => {
                    const active = tab === selected;
                    tab.setAttribute('aria-selected', String(active));
                    tab.tabIndex = active ? 0 : -1;
                });
                panels.forEach((panel) => {
                    panel.hidden = panel.id !== panelId;
                });
                scheduleFit();
                if (focus) selected.focus();
            };
            controllers.set(card, { tabs, activate });
            tabs.forEach((tab, index) => {
                tab.addEventListener('click', () => activate(tab), { signal });
                tab.addEventListener(
                    'keydown',
                    (event) => {
                        let next: number;
                        switch (event.key) {
                            case 'ArrowRight':
                                next = (index + 1) % tabs.length;
                                break;
                            case 'ArrowLeft':
                                next = (index + tabs.length - 1) % tabs.length;
                                break;
                            case 'Home':
                                next = 0;
                                break;
                            case 'End':
                                next = tabs.length - 1;
                                break;
                            default:
                                return;
                        }
                        event.preventDefault();
                        activate(tabs[next], true);
                    },
                    { signal },
                );
            });
            if (inline) {
                card.dataset.articlePostsFitted = 'true';
                fit();
                const observer = new ResizeObserver(scheduleFit);
                observer.observe(card);
                panels.forEach((panel) => observer.observe(panel));
                void document.fonts.ready.then(scheduleFit);
                window.addEventListener('resize', scheduleFit, { signal });
                signal.addEventListener(
                    'abort',
                    () => {
                        observer.disconnect();
                        cancelAnimationFrame(frame);
                    },
                    { once: true },
                );
            }
        });
    document
        .querySelectorAll<HTMLButtonElement>('[data-open-article-posts]')
        .forEach((button) => {
            button.addEventListener(
                'click',
                () => {
                    const dialog = document.querySelector<HTMLDialogElement>(
                        '#article-posts-dialog',
                    );
                    if (!dialog) return;
                    const current = button
                        .closest('[data-article-posts-tabs]')
                        ?.querySelector<HTMLElement>(
                            '[role="tab"][aria-selected="true"]',
                        );
                    const controller = controllers.get(dialog);
                    const tab = controller?.tabs.find(
                        (tab) =>
                            tab.dataset.postsKind ===
                            (current?.dataset.postsKind ?? 'latest'),
                    );
                    if (controller && tab) controller.activate(tab);
                    dialog.showModal();
                },
                { signal },
            );
        });
}
