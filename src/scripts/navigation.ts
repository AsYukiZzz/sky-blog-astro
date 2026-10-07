import { browserStorage } from './browser-storage';

export function setupNavigation(signal: AbortSignal) {
    if (signal.aborted) return;
    const menu =
        document.querySelector<HTMLDialogElement>('#mobile-navigation');
    document.addEventListener(
        'click',
        (event) => {
            const target =
                event.target instanceof Element ? event.target : null;
            if (!target) return;
            const menuButton =
                target.closest<HTMLButtonElement>('[data-menu-toggle]');
            if (menuButton && menu) {
                if (menu.open) menu.close();
                else menu.showModal();
                menuButton.setAttribute('aria-expanded', String(menu.open));
            }
            if (target.closest('[data-scroll-top]'))
                window.scrollTo({
                    top: 0,
                    behavior: matchMedia('(prefers-reduced-motion: reduce)')
                        .matches
                        ? 'instant'
                        : 'smooth',
                });
            const style = target.closest<HTMLElement>('[data-list-style]');
            if (style?.dataset.listStyle) {
                const wrapper = style.closest('[data-post-list-wrapper]');
                const list = wrapper?.querySelector<HTMLElement>('.post-list');
                if (list) {
                    list.dataset.style = style.dataset.listStyle;
                    browserStorage.set(
                        'sky-post-layout',
                        style.dataset.listStyle,
                    );
                    wrapper
                        ?.querySelectorAll<HTMLElement>('[data-list-style]')
                        .forEach((button) =>
                            button.setAttribute(
                                'aria-pressed',
                                String(button === style),
                            ),
                        );
                }
            }
            if (!target.closest('.nav-dropdown'))
                document
                    .querySelectorAll<HTMLDetailsElement>('.nav-dropdown[open]')
                    .forEach((dropdown) => (dropdown.open = false));
        },
        { signal },
    );
    menu?.addEventListener(
        'close',
        () =>
            document
                .querySelector('[data-menu-toggle]')
                ?.setAttribute('aria-expanded', 'false'),
        { signal },
    );
    if (matchMedia('(hover: hover)').matches)
        document
            .querySelectorAll<HTMLDetailsElement>('.nav-dropdown')
            .forEach((dropdown) => {
                dropdown.addEventListener(
                    'pointerenter',
                    () => {
                        dropdown.open = true;
                    },
                    { signal },
                );
                dropdown.addEventListener(
                    'pointerleave',
                    () => {
                        if (!dropdown.contains(document.activeElement))
                            dropdown.open = false;
                    },
                    { signal },
                );
            });
    const selectedStyle = browserStorage.get('sky-post-layout');
    if (
        selectedStyle &&
        ['card', 'list', 'magazine', 'minimal'].includes(selectedStyle)
    ) {
        document
            .querySelectorAll<HTMLElement>('[data-remember-layout] .post-list')
            .forEach((list) => (list.dataset.style = selectedStyle));
        document
            .querySelectorAll<HTMLElement>('[data-list-style]')
            .forEach((button) =>
                button.setAttribute(
                    'aria-pressed',
                    String(button.dataset.listStyle === selectedStyle),
                ),
            );
    }

    let scrollFrame = 0;
    const updateHomeScroll = () => {
        scrollFrame = 0;
        if (!signal.aborted)
            document.body.toggleAttribute(
                'data-home-scrolled',
                window.scrollY > 200,
            );
    };
    document.addEventListener(
        'scroll',
        () => {
            if (!scrollFrame)
                scrollFrame = requestAnimationFrame(updateHomeScroll);
        },
        { passive: true, signal },
    );
    signal.addEventListener('abort', () => cancelAnimationFrame(scrollFrame), {
        once: true,
    });
    updateHomeScroll();
}
