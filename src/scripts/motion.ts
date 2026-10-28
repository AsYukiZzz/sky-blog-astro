// Keep glass surfaces and their wrappers opaque throughout entry. Fading an
// ancestor also changes its children's backdrop root and makes the blur flash.
const entranceTargets = [
    '.content-preview-card',
    '.page-header',
    '.essay-card',
    '.friends-grid > *',
    '.archive-year-heading',
    '.archive-month',
].join(',');

// Animate visible content only. Nothing depends on JS to become readable.
export function setupMotion(signal: AbortSignal) {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const played = new WeakSet<Element>();
    const running = new Set<Animation>();
    let reveals: IntersectionObserver | undefined;

    const enter = (node: Element, delay: number) => {
        if (
            preference.matches ||
            signal.aborted ||
            document.hidden ||
            !node.animate
        )
            return;
        const animation = node.animate(
            [{ translate: '0 16px' }, { translate: '0 0' }],
            {
                duration: 520,
                delay,
                easing: 'cubic-bezier(.22, 1, .36, 1)',
                fill: 'backwards',
            },
        );
        running.add(animation);
        animation.addEventListener(
            'finish',
            () => {
                running.delete(animation);
                animation.cancel();
            },
            { once: true },
        );
    };

    const stop = () => {
        reveals?.disconnect();
        running.forEach((animation) => animation.cancel());
        running.clear();
    };

    const observe = () => {
        if (preference.matches || !('IntersectionObserver' in window)) return;
        reveals = new IntersectionObserver(
            (entries) => {
                let index = 0;
                for (const entry of entries) {
                    if (!entry.isIntersecting || played.has(entry.target))
                        continue;
                    played.add(entry.target);
                    reveals?.unobserve(entry.target);
                    // Above-fold content is already visible when this callback arrives;
                    // only small, bounded offsets are used, including on narrow screens.
                    enter(entry.target, Math.min(index++ * 45, 135));
                }
            },
            { threshold: 0.06, rootMargin: '0px 0px -20px 0px' },
        );
        document.querySelectorAll(entranceTargets).forEach((node) => {
            if (!played.has(node)) reveals?.observe(node);
        });
    };

    observe();
    const updateVisibility = () => {
        document.body.toggleAttribute('data-motion-paused', document.hidden);
        running.forEach((animation) =>
            document.hidden ? animation.pause() : animation.play(),
        );
    };
    document.addEventListener('visibilitychange', updateVisibility, { signal });
    updateVisibility();
    preference.addEventListener(
        'change',
        () => {
            stop();
            observe();
        },
        { signal },
    );
    signal.addEventListener(
        'abort',
        () => {
            stop();
            document.body.removeAttribute('data-motion-paused');
        },
        { once: true },
    );
}
