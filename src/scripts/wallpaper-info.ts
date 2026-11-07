export function setupWallpaperInfo(signal: AbortSignal) {
    if (signal.aborted) return;
    const trigger = document.querySelector<HTMLButtonElement>(
        '[data-wallpaper-author-toggle]',
    );
    const panel = document.querySelector<HTMLElement>('[data-wallpaper-info]');
    if (!trigger || !panel) return;
    let openingScroll = { x: scrollX, y: scrollY };
    const syncExpanded = () =>
        trigger.setAttribute(
            'aria-expanded',
            String(panel.matches(':popover-open')),
        );
    panel.addEventListener(
        'beforetoggle',
        (event) => {
            if ((event as ToggleEvent).newState === 'open') {
                panel.removeAttribute('data-wallpaper-instant-close');
                if (!trigger.isConnected || !trigger.getClientRects().length) {
                    event.preventDefault();
                    panel.inert = true;
                    panel.toggleAttribute('data-wallpaper-instant-close', true);
                    return;
                }
                openingScroll = { x: scrollX, y: scrollY };
                panel.inert = false;
            } else panel.inert = true;
        },
        { signal },
    );
    panel.addEventListener('toggle', syncExpanded, { signal });
    const closeImmediately = () => {
        panel.inert = true;
        panel.toggleAttribute('data-wallpaper-instant-close', true);
        if (panel.isConnected && panel.matches(':popover-open'))
            panel.hidePopover();
    };
    const closeOnPageScroll = (event: Event) => {
        if (event.target instanceof Node && panel.contains(event.target))
            return;
        // Opening can follow an automatic scroll whose event is still queued.
        if (
            event.target === document &&
            scrollX === openingScroll.x &&
            scrollY === openingScroll.y
        )
            return;
        if (panel.matches(':popover-open')) panel.hidePopover();
    };
    document.addEventListener('scroll', closeOnPageScroll, {
        capture: true,
        passive: true,
        signal,
    });
    signal.addEventListener('abort', closeImmediately, { once: true });
    // Retained exit frames must be inert; no-JS keeps the instant native fallback.
    panel.inert = !panel.matches(':popover-open');
    panel.toggleAttribute('data-wallpaper-motion', true);
    syncExpanded();
}
