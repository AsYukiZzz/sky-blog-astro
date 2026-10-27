import type {
    TransitionBeforePreparationEvent,
    TransitionBeforeSwapEvent,
} from 'astro:transitions/client';
import { createPageLoadingLifecycle } from '../lib/page-loading';
import type { InitialPageLoadingElement } from '../lib/initial-page-loading';

interface SwappedPage {
    signal: AbortSignal;
    scripts: Set<HTMLScriptElement>;
    initialized: boolean;
    swapComplete: boolean;
}

function waitForLoadingPreview(signal: AbortSignal): Promise<void> {
    if (signal.aborted) return Promise.resolve();
    return new Promise((resolve) => {
        const finish = () => {
            clearTimeout(timer);
            signal.removeEventListener('abort', finish);
            resolve();
        };
        const timer = setTimeout(finish, 1500);
        signal.addEventListener('abort', finish, { once: true });
    });
}

/** Own the persistent loading surface for the router, not for an individual page. */
export function setupPageLoading(): () => void {
    const layer = document.querySelector<InitialPageLoadingElement>(
        '[data-page-loading]',
    );
    if (!layer) return () => {};

    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let swapped: SwappedPage | undefined;
    const showOnTop = () => {
        if (layer.showPopover && !layer.matches(':popover-open'))
            layer.showPopover();
    };
    const conceal = () => {
        clearTimeout(fadeTimer);
        if (layer.hidePopover && layer.matches(':popover-open'))
            layer.hidePopover();
        layer.hidden = true;
        delete layer.dataset.state;
    };
    const loading = createPageLoadingLifecycle(
        () => {
            clearTimeout(fadeTimer);
            layer.hidden = false;
            layer.dataset.state = 'visible';
            document.querySelector('main')?.setAttribute('aria-busy', 'true');
            showOnTop();
        },
        () => {
            layer.dataset.state = 'hiding';
            document.querySelector('main')?.removeAttribute('aria-busy');
            if (matchMedia('(prefers-reduced-motion: reduce)').matches)
                conceal();
            else fadeTimer = setTimeout(conceal, 150);
        },
    );
    const scripts = new MutationObserver((records) => {
        for (const record of records) {
            for (const node of record.addedNodes) {
                if (
                    node instanceof HTMLScriptElement &&
                    node.hasAttribute('src') &&
                    node.dataset.astroExec === ''
                )
                    swapped?.scripts.add(node);
            }
        }
    });
    const finishReadyPage = () => {
        if (!swapped?.initialized || !swapped.swapComplete) return;
        const page = swapped;
        clearTimeout(settleTimer);
        // Let Astro's script replacements and their MutationObserver delivery run
        // before trusting a page-load, which can belong to an older navigation.
        settleTimer = setTimeout(() => {
            if (swapped !== page || page.scripts.size > 0) return;
            scripts.disconnect();
            loading.finish(page.signal);
            swapped = undefined;
        }, 0);
    };
    const scriptReady = (event: Event) => {
        if (!(event.target instanceof HTMLScriptElement)) return;
        if (swapped?.scripts.delete(event.target)) finishReadyPage();
    };
    document.addEventListener('load', scriptReady, true);
    document.addEventListener('error', scriptReady, true);

    document.addEventListener('astro:before-preparation', (event) => {
        const navigation = event as TransitionBeforePreparationEvent;
        if (
            navigation.from.pathname === navigation.to.pathname &&
            navigation.from.search === navigation.to.search
        )
            return;
        const originalLoader = navigation.loader;
        // Start only if Astro actually runs the loader: a later listener may cancel.
        navigation.loader = async () => {
            layer.initialLoading?.cancel();
            navigation.sourceElement
                ?.closest<HTMLDialogElement>('dialog[open]')
                ?.close();
            loading.begin(navigation.signal);
            try {
                await Promise.all([
                    originalLoader(),
                    import.meta.env.DEV && import.meta.env.MODE === 'loading'
                        ? waitForLoadingPreview(navigation.signal)
                        : undefined,
                ]);
            } catch (error) {
                loading.finish(navigation.signal);
                throw error;
            }
            if (navigation.defaultPrevented || navigation.signal.aborted)
                loading.finish(navigation.signal);
        };
    });
    document.addEventListener('astro:before-swap', (event) => {
        const transition = event as TransitionBeforeSwapEvent;
        clearTimeout(settleTimer);
        scripts.disconnect();
        const page: SwappedPage = {
            signal: transition.signal,
            scripts: new Set(),
            initialized: false,
            swapComplete: false,
        };
        swapped = page;
        transition.viewTransition.updateCallbackDone.then(
            () => {
                if (swapped !== page) return;
                page.swapComplete = true;
                finishReadyPage();
            },
            () => {
                if (swapped !== page) return;
                scripts.disconnect();
                swapped = undefined;
                loading.finish(page.signal);
            },
        );
    });
    document.addEventListener('astro:after-swap', () => {
        // Track only external script nodes Astro actually executes, including its
        // external completion sentinel for inline modules. Runtime widgets lack
        // this marker and do not block reading; inline scripts have no load event.
        scripts.observe(document, { childList: true, subtree: true });
        // Moving a persisted element can remove it from the browser's top layer.
        if (layer.dataset.state === 'visible') {
            document.querySelector('main')?.setAttribute('aria-busy', 'true');
            showOnTop();
        }
    });
    const reset = () => {
        layer.initialLoading?.cancel();
        loading.reset();
        clearTimeout(settleTimer);
        scripts.disconnect();
        swapped = undefined;
        document.querySelector('main')?.removeAttribute('aria-busy');
        conceal();
    };
    window.addEventListener('pagehide', reset);
    window.addEventListener('pageshow', (event) => {
        // Initial images may finish after the user has already started navigating.
        if (event.persisted) reset();
    });

    return () => {
        layer.initialLoading?.ready();
        if (swapped) swapped.initialized = true;
        finishReadyPage();
    };
}
