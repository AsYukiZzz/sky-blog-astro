export function createPageLoadingLifecycle(show: () => void, hide: () => void) {
    let pending:
        | {
              signal: AbortSignal;
              cancel: () => void;
              timer?: ReturnType<typeof setTimeout>;
          }
        | undefined;
    let visible = false;

    const detach = () => {
        if (!pending) return;
        clearTimeout(pending.timer);
        pending.signal.removeEventListener('abort', pending.cancel);
        pending = undefined;
    };
    const finish = (signal: AbortSignal) => {
        if (pending?.signal !== signal) return;
        detach();
        if (visible) {
            visible = false;
            hide();
        }
    };
    return {
        begin(signal: AbortSignal) {
            if (signal.aborted || pending?.signal === signal) return;
            detach();
            pending = { signal, cancel: () => finish(signal) };
            signal.addEventListener('abort', pending.cancel, { once: true });
            if (!visible) {
                pending.timer = setTimeout(() => {
                    if (pending?.signal !== signal) return;
                    pending.timer = undefined;
                    visible = true;
                    show();
                }, 180);
            }
        },
        finish,
        reset() {
            if (pending) finish(pending.signal);
        },
    };
}
