import { readingProgress } from '../lib/reading-progress';
import { revealTocLink } from './toc-scroll';

export function setupArticleReading(signal: AbortSignal) {
    if (signal.aborted) return;
    const article = document.getElementById('article-content');
    if (!article) return;
    const tocLinks = [
        ...document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]'),
    ];
    const headings = [
        ...article.querySelectorAll<HTMLElement>(
            'h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]',
        ),
    ];
    const progressBars = document.querySelectorAll<HTMLElement>(
        '[data-reading-progress]',
    );
    const progressLabels = document.querySelectorAll<HTMLElement>(
        '[data-reading-percent]',
    );
    const progressMeters = document.querySelectorAll<HTMLElement>(
        '[data-reading-meter]',
    );
    let activeHeadingId = '';
    const updateToc = () => {
        if (!headings.length) return;
        let active = headings[0];
        for (const heading of headings) {
            if (heading.getBoundingClientRect().top > 120) break;
            active = heading;
        }
        if (active.id === activeHeadingId) return;
        activeHeadingId = active.id;
        for (const link of tocLinks) {
            const isActive =
                decodeURIComponent(link.hash.slice(1)) === activeHeadingId;
            link.classList.toggle('active', isActive);
            if (isActive) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
            const scrollArea =
                isActive && link.closest<HTMLElement>('[data-toc-scroll]');
            if (scrollArea) revealTocLink(link, scrollArea);
        }
    };
    const updateProgress = () => {
        const rect = article.getBoundingClientRect();
        const scrolling = document.scrollingElement ?? document.documentElement;
        const progress = readingProgress({
            articleTop: rect.top,
            articleHeight: rect.height,
            viewportHeight: innerHeight,
            scrollTop: scrolling.scrollTop,
            documentHeight: scrolling.scrollHeight,
        });
        const percent = Math.round(progress);
        progressBars.forEach((bar) => (bar.style.width = `${progress}%`));
        progressLabels.forEach((label) => (label.textContent = `${percent}%`));
        progressMeters.forEach((meter) =>
            meter.setAttribute('aria-valuenow', String(percent)),
        );
    };
    let scrollFrame = 0;
    const updateScroll = () => {
        scrollFrame = 0;
        if (signal.aborted) return;
        updateToc();
        updateProgress();
    };
    const queueScrollUpdate = () => {
        if (!signal.aborted && !scrollFrame)
            scrollFrame = requestAnimationFrame(updateScroll);
    };
    const invalidate = () => {
        activeHeadingId = '';
        queueScrollUpdate();
    };
    document.addEventListener('scroll', queueScrollUpdate, {
        passive: true,
        signal,
    });
    window.addEventListener('resize', invalidate, { signal });
    window.addEventListener('pageshow', invalidate, { signal });
    document.addEventListener('load', invalidate, { capture: true, signal });
    const observer = new ResizeObserver(invalidate);
    observer.observe(article);
    void document.fonts.ready.then(invalidate);
    signal.addEventListener(
        'abort',
        () => {
            cancelAnimationFrame(scrollFrame);
            observer.disconnect();
        },
        { once: true },
    );
    updateScroll();
}
