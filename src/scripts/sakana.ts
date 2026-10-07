import { theme } from '../config/theme';
import { createSakanaLifecycle } from '../lib/sakana-lifecycle';
import { sakanaFooterLift } from '../lib/sakana-position';
import type { SakanaWidgetVisibility } from 'sakana-widget';

export function setupSakana(signal: AbortSignal) {
    const root = document.querySelector<HTMLElement>('[data-sakana]');
    const host = root?.querySelector<HTMLElement>('[data-sakana-host]');
    const restore = root?.querySelector<HTMLButtonElement>(
        '[data-sakana-restore]',
    );
    const anchor = root?.querySelector<HTMLElement>('.home-sakana-anchor');
    if (
        !theme.sakana.enabled ||
        !root ||
        !host ||
        !restore ||
        !anchor ||
        signal.aborted
    )
        return;

    const mobile = matchMedia('(max-width: 767px)');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const lifecycle = createSakanaLifecycle(async () => {
        const { default: SakanaWidget } = await import('sakana-widget');
        const widget = new SakanaWidget({
            character: theme.sakana.character,
            autoFit: true,
            title: true,
            saveState: true,
            stateKey: 'sky-sakana-visibility',
        });
        let autoMode = theme.sakana.autoMode;
        const onState = (state: SakanaWidgetVisibility) => {
            const focused = document.activeElement;
            restore.hidden = state !== 'hide';
            root.dataset.state = state;
            if (state === 'hide') {
                autoMode = false;
                if (host.contains(focused)) restore.focus();
            } else if (focused === restore)
                host.querySelector<HTMLButtonElement>('button')?.focus();
        };
        widget.addStateListener(onState);
        restore.addEventListener('click', () => widget.show(), { signal });

        return {
            mount() {
                widget.mount(host);
                const labels: Record<string, string> = {
                    'Next Character': '切换角色',
                    'Auto Mode': '托管模式',
                    'GitHub Repository': 'Sakana 开源项目',
                    Close: '收起 Sakana 挂件',
                };
                host.querySelectorAll<HTMLElement>('[aria-label]').forEach(
                    (control) => {
                        const label =
                            labels[control.getAttribute('aria-label') ?? ''];
                        if (label) {
                            control.setAttribute('aria-label', label);
                            control.title = label;
                        }
                    },
                );
                const image =
                    host.querySelector<HTMLElement>('.sakana-widget-img');
                image?.setAttribute('role', 'img');
                image?.setAttribute(
                    'aria-label',
                    'Sakana 角色，拖动后松开可以回弹',
                );
                if (autoMode && root.dataset.state === 'show')
                    widget.triggerAutoMode();
            },
            unmount() {
                autoMode =
                    host
                        .querySelector('[aria-label="托管模式"]')
                        ?.getAttribute('aria-pressed') === 'true';
                widget.unmount();
            },
            dispose() {
                widget.removeStateListener(onState);
            },
        };
    }, signal);

    const footer = document.querySelector<HTMLElement>('.site-footer');
    let positionFrame = 0;
    const updatePosition = () => {
        positionFrame = 0;
        if (signal.aborted || root.hidden) return;
        // Read the actual CSS inset so mobile Dock spacing and safe-area insets apply too.
        const bottom = Number.parseFloat(getComputedStyle(anchor).bottom) || 0;
        const lift = footer
            ? sakanaFooterLift(
                  window.innerHeight,
                  footer.getBoundingClientRect().top,
                  bottom,
              )
            : 0;
        root.style.setProperty('--sakana-lift', `${lift}px`);
    };
    const schedulePosition = () => {
        if (!positionFrame && !signal.aborted)
            positionFrame = requestAnimationFrame(updatePosition);
    };
    const sync = () => {
        if (signal.aborted) return;
        const active =
            !document.hidden &&
            (!mobile.matches || theme.sakana.showOnMobile) &&
            !reducedMotion.matches;
        root.hidden = !active;
        if (active) schedulePosition();
        void lifecycle.setActive(active).catch((error) => {
            root.hidden = true;
            if (!signal.aborted) console.warn('[Sakana] 挂件加载失败', error);
        });
    };
    mobile.addEventListener('change', sync, { signal });
    reducedMotion.addEventListener('change', sync, { signal });
    document.addEventListener('visibilitychange', sync, { signal });
    window.addEventListener('scroll', schedulePosition, {
        passive: true,
        signal,
    });
    window.addEventListener('resize', schedulePosition, {
        passive: true,
        signal,
    });
    const layoutObserver =
        'ResizeObserver' in window
            ? new ResizeObserver(schedulePosition)
            : undefined;
    if (footer) layoutObserver?.observe(footer);
    const main = document.querySelector('main');
    if (main) layoutObserver?.observe(main);
    signal.addEventListener(
        'abort',
        () => {
            cancelAnimationFrame(positionFrame);
            layoutObserver?.disconnect();
            root.hidden = true;
        },
        { once: true },
    );
    sync();
}
