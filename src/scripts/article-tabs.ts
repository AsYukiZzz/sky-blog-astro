import { revealTocLink } from './toc-scroll';

export function setupArticleTabs(signal: AbortSignal) {
    if (signal.aborted) return;
    const revealCurrent = (group: HTMLElement) => {
        const area = group.querySelector<HTMLElement>(
            '[data-toc-scroll]:not([hidden])',
        );
        const current = area?.querySelector<HTMLElement>('[aria-current]');
        if (area && current && area.clientHeight) revealTocLink(current, area);
    };
    const controllers = new Map<HTMLElement, (kind: string) => void>();
    document
        .querySelectorAll<HTMLElement>('[data-article-tabs]')
        .forEach((group) => {
            const tabs = [
                ...group.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
            ];
            const panels = [
                ...group.querySelectorAll<HTMLElement>('[role="tabpanel"]'),
            ];
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
                revealCurrent(group);
                if (focus) selected.focus();
            };
            controllers.set(group, (kind) => {
                const tab = tabs.find((tab) => tab.dataset.tabKind === kind);
                if (tab) activate(tab);
                else revealCurrent(group);
            });
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
        });
    for (const { selector, id, fallback } of [
        {
            selector: '[data-open-toc]',
            id: 'article-toc-dialog',
            fallback: 'article',
        },
        {
            selector: '[data-open-article-posts]',
            id: 'article-posts-dialog',
            fallback: 'latest',
        },
    ]) {
        document
            .querySelectorAll<HTMLButtonElement>(selector)
            .forEach((button) => {
                button.addEventListener(
                    'click',
                    () => {
                        const dialog = document.getElementById(id);
                        if (!(dialog instanceof HTMLDialogElement)) return;
                        const group = dialog.matches('[data-article-tabs]')
                            ? dialog
                            : dialog.querySelector<HTMLElement>(
                                  '[data-article-tabs]',
                              );
                        const selected = button
                            .closest('[data-article-tabs]')
                            ?.querySelector<HTMLElement>(
                                '[role="tab"][aria-selected="true"]',
                            );
                        const kind =
                            button.dataset.postsKind ??
                            selected?.dataset.tabKind ??
                            fallback;
                        dialog.showModal();
                        if (group) controllers.get(group)?.(kind);
                    },
                    { signal },
                );
            });
    }
}
