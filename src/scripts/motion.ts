// Keep homepage cards and previews opaque: revealing already-painted content
// from opacity 0 makes skipped cards flash when scrolling back up.
const entranceTargets = [
    '.post-card',
    '.content-preview-card',
    '.sidebar > *',
    '.page-header',
    '.essay-card',
    '.link-grid > *',
    '.archive-year-heading',
    '.archive-month',
].join(',');

// Animate visible content only. Nothing depends on JS to become readable.
export function setupMotion(signal: AbortSignal) {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const played = new WeakSet<Element>();
    const running = new Set<Animation>();
    const hero = document.querySelector<HTMLElement>('.home-hero');
    let reveals: IntersectionObserver | undefined;
    let heroVisibility: IntersectionObserver | undefined;

    const enter = (node: Element, delay = 0, distance = 16, duration = 520) => {
        if (
            preference.matches ||
            signal.aborted ||
            document.hidden ||
            !node.animate
        )
            return;
        const animation = node.animate(
            [
                { opacity: 0, translate: `0 ${distance}px` },
                { opacity: 1, translate: '0 0' },
            ],
            {
                duration,
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
        heroVisibility?.disconnect();
        running.forEach((animation) => animation.cancel());
        running.clear();
        hero?.removeAttribute('data-motion-idle');
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
        if (hero) {
            heroVisibility = new IntersectionObserver(([entry]) => {
                hero.toggleAttribute('data-motion-idle', !entry.isIntersecting);
            });
            heroVisibility.observe(hero);
        }
    };

    observe();
    document
        .querySelectorAll('.hero-title, .hero-subtitle')
        .forEach((node, index) =>
            enter(node, Math.min(index * 85, 255), 20, 700),
        );
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
