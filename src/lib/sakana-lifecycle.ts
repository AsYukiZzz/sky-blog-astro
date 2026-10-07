interface SakanaMount {
    mount(): void;
    unmount(): void;
    dispose(): void;
}

/** Own one lazy widget instance across temporary pauses, until the route is left. */
export function createSakanaLifecycle(
    create: () => Promise<SakanaMount>,
    signal: AbortSignal,
) {
    let active = false;
    let mounted = false;
    let widget: SakanaMount | undefined;
    let loading: Promise<void> | undefined;

    const unmount = () => {
        if (!mounted) return;
        widget?.unmount();
        mounted = false;
    };
    signal.addEventListener(
        'abort',
        () => {
            active = false;
            unmount();
            widget?.dispose();
            widget = undefined;
        },
        { once: true },
    );

    return {
        async setActive(next: boolean) {
            if (signal.aborted) return;
            active = next;
            if (!active) {
                unmount();
                return;
            }
            if (!widget) {
                loading ??= create()
                    .then((instance) => {
                        // A slow import can finish after Astro has already replaced the page.
                        if (signal.aborted) instance.dispose();
                        else widget = instance;
                    })
                    .catch((error) => {
                        loading = undefined;
                        throw error;
                    });
                await loading;
            }
            if (!signal.aborted && active && widget && !mounted) {
                widget.mount();
                mounted = true;
            }
        },
    };
}
