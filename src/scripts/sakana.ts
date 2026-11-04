import { theme } from '../config';
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
        !theme.extra.sakana.enabled ||
        !root ||
        !host ||
        !restore ||
        !anchor ||
        signal.aborted
    )
        return;

    const mobile = matchMedia('(max-width: 767px)');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const visibilityKey = 'sky-sakana-visibility';
    let autoMode = theme.extra.sakana.autoMode;
    let forceShowOnMount = false;
    let showWidget: (() => void) | undefined;
    let initializationStarted = false;
    let idleId: number | undefined;
    let idleFrame = 0;
    let idleTimer = 0;
    const savedHidden = () => {
        try {
            return localStorage.getItem(visibilityKey) === 'hide';
        } catch {
            return false;
        }
    };
    const lifecycle = createSakanaLifecycle(async () => {
        const { default: SakanaWidget } = await import('sakana-widget');
        const widget = new SakanaWidget({
            character: theme.extra.sakana.character,
            autoFit: true,
            title: true,
            saveState: true,
            stateKey: visibilityKey,
        });
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
        const show = () => widget.show();
        showWidget = show;
        widget.addStateListener(onState);

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
                if (forceShowOnMount) {
                    forceShowOnMount = false;
                    widget.show();
                }
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
                if (showWidget === show) showWidget = undefined;
            },
        };
    }, signal);

    const canRun = () =>
        !signal.aborted &&
        root.isConnected &&
        !document.hidden &&
        (!mobile.matches || theme.extra.sakana.showOnMobile) &&
        !reducedMotion.matches;
    const cancelInitial = () => {
        if (idleId !== undefined) {
            window.cancelIdleCallback?.(idleId);
            idleId = undefined;
        }
        cancelAnimationFrame(idleFrame);
        window.clearTimeout(idleTimer);
        idleFrame = 0;
        idleTimer = 0;
    };
    const failed = (error: unknown) => {
        root.hidden = true;
        if (!signal.aborted) console.warn('[Sakana] 挂件加载失败', error);
    };
    const activate = () => {
        cancelInitial();
        initializationStarted = true;
        void lifecycle.setActive(true).catch(failed);
    };
    const deferHiddenWidget = () => {
        if (forceShowOnMount || !savedHidden()) return false;
        autoMode = false;
        restore.hidden = false;
        root.dataset.state = 'hide';
        return true;
    };
    const scheduleInitial = () => {
        if (idleId !== undefined || idleFrame || idleTimer) return;
        const run = () => {
            idleId = undefined;
            idleFrame = 0;
            idleTimer = 0;
            if (initializationStarted || !canRun() || deferHiddenWidget())
                return;
            activate();
        };
        if (typeof window.requestIdleCallback === 'function') {
            idleId = window.requestIdleCallback(run, { timeout: 1500 });
        } else {
            // Give the initial page a paint opportunity before optional work.
            idleFrame = requestAnimationFrame(() => {
                idleFrame = 0;
                idleTimer = window.setTimeout(run, 0);
            });
        }
    };
    restore.addEventListener(
        'click',
        () => {
            forceShowOnMount = true;
            try {
                localStorage.setItem(visibilityKey, 'show');
            } catch {
                /* Persistence is optional. */
            }
            if (showWidget) {
                forceShowOnMount = false;
                showWidget();
            }
            if (canRun()) activate();
        },
        { signal },
    );

    const footer = document.querySelector<HTMLElement>('.site-footer');
    let positionFrame = 0;
    let positionDirty = true;
    let bottomInset = 0;
    let footerTop = 0;
    let viewportHeight = 0;
    let lastLift: number | undefined;
    const updatePosition = () => {
        positionFrame = 0;
        if (signal.aborted || root.hidden) return;
        const scrollTop = window.scrollY;
        if (positionDirty) {
            // CSS includes the mobile Dock clearance and safe-area insets.
            bottomInset =
                Number.parseFloat(getComputedStyle(anchor).bottom) || 0;
            viewportHeight = window.innerHeight;
            footerTop = footer
                ? footer.getBoundingClientRect().top + scrollTop
                : 0;
            positionDirty = false;
        }
        const lift = footer
            ? sakanaFooterLift(
                  viewportHeight,
                  footerTop - scrollTop,
                  bottomInset,
              )
            : 0;
        if (lift !== lastLift) {
            root.style.setProperty('--sakana-lift', `${lift}px`);
            lastLift = lift;
        }
    };
    const schedulePosition = () => {
        if (!positionFrame && !signal.aborted && !root.hidden)
            positionFrame = requestAnimationFrame(updatePosition);
    };
    const invalidatePosition = () => {
        positionDirty = true;
        schedulePosition();
    };
    const sync = () => {
        if (signal.aborted) return;
        const active = canRun();
        root.hidden = !active;
        if (!active) {
            cancelInitial();
            cancelAnimationFrame(positionFrame);
            positionFrame = 0;
            void lifecycle.setActive(false).catch(failed);
            return;
        }
        invalidatePosition();
        if (initializationStarted) activate();
        else if (deferHiddenWidget()) cancelInitial();
        else {
            restore.hidden = true;
            scheduleInitial();
        }
    };
    mobile.addEventListener('change', sync, { signal });
    reducedMotion.addEventListener('change', sync, { signal });
    document.addEventListener('visibilitychange', sync, { signal });
    document.addEventListener('astro:page-load', sync, { signal });
    window.addEventListener('pageshow', sync, { signal });
    window.addEventListener('scroll', schedulePosition, {
        passive: true,
        signal,
    });
    window.addEventListener('resize', invalidatePosition, {
        passive: true,
        signal,
    });
    window.visualViewport?.addEventListener('resize', invalidatePosition, {
        signal,
    });
    document.addEventListener('load', invalidatePosition, {
        capture: true,
        signal,
    });
    document.fonts.addEventListener('loadingdone', invalidatePosition, {
        signal,
    });
    const layoutObserver =
        'ResizeObserver' in window
            ? new ResizeObserver(invalidatePosition)
            : undefined;
    if (footer) layoutObserver?.observe(footer);
    const main = document.querySelector('main');
    if (main) layoutObserver?.observe(main);
    signal.addEventListener(
        'abort',
        () => {
            cancelInitial();
            cancelAnimationFrame(positionFrame);
            layoutObserver?.disconnect();
            root.hidden = true;
        },
        { once: true },
    );
    sync();
}
