import {
    copyrightYears,
    operatingDays,
    pageLoadMilliseconds,
} from '../lib/site-metrics';

export function setupSiteStatus(signal: AbortSignal, routeStartedAt?: number) {
    const uptimeNodes =
        document.querySelectorAll<HTMLElement>('[data-site-uptime]');
    const copyrightNodes = document.querySelectorAll<HTMLElement>(
        '[data-copyright-years]',
    );
    const loadNode = document.querySelector<HTMLElement>(
        '[data-page-load-time]',
    );
    const updateDates = () => {
        const now = new Date();
        uptimeNodes.forEach((node) => {
            const days = operatingDays(
                node.dataset.siteStartedAt ?? '',
                node.dataset.siteTimezone ?? 'Asia/Shanghai',
                now,
            );
            node.textContent = days === null ? '—' : String(days);
        });
        copyrightNodes.forEach((node) => {
            node.textContent = copyrightYears(
                Number(node.dataset.copyrightStart),
                node.dataset.siteTimezone ?? 'Asia/Shanghai',
                now,
            );
        });
    };
    updateDates();
    // Refresh long-open tabs without requiring a new static build or a server request.
    const dateTimer = window.setInterval(updateDates, 60_000);
    document.addEventListener(
        'visibilitychange',
        () => {
            if (!document.hidden) updateDates();
        },
        { signal },
    );

    let timingFrame = 0;
    const showLoadTime = () => {
        if (!loadNode || signal.aborted) return;
        const now = performance.now();
        const navigation = performance.getEntriesByType('navigation')[0] as
            PerformanceNavigationTiming | undefined;
        const milliseconds = pageLoadMilliseconds({
            now,
            routeStartedAt,
            navigation:
                navigation ??
                (document.readyState === 'complete'
                    ? { startTime: 0, loadEventEnd: now }
                    : undefined),
        });
        if (milliseconds !== null) loadNode.textContent = `${milliseconds} ms`;
    };
    const scheduleTiming = () => {
        cancelAnimationFrame(timingFrame);
        timingFrame = requestAnimationFrame(showLoadTime);
    };
    scheduleTiming();
    if (document.readyState !== 'complete')
        window.addEventListener('load', scheduleTiming, { once: true, signal });

    const footer = document.querySelector<HTMLElement>('.site-footer');
    const footerObserver =
        footer && 'IntersectionObserver' in window
            ? new IntersectionObserver((entries) => {
                  if (signal.aborted) return;
                  document.body.toggleAttribute(
                      'data-footer-visible',
                      entries.some((entry) => entry.isIntersecting),
                  );
              })
            : undefined;
    if (footer && footerObserver) footerObserver.observe(footer);
    signal.addEventListener(
        'abort',
        () => {
            window.clearInterval(dateTimer);
            cancelAnimationFrame(timingFrame);
            footerObserver?.disconnect();
            document.body.removeAttribute('data-footer-visible');
        },
        { once: true },
    );
}
