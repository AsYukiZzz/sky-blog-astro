import { activeHeadingIndex, readingProgress } from '../lib/reading-progress';
import { tocScrollTarget } from './toc-scroll';

export function setupArticleReading(signal: AbortSignal) {
    if (signal.aborted) return;
    const article = document.getElementById('article-content');
    if (!article) return;
    const tocLinks = [
        ...document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]'),
    ];
    const linkIds = new Map(
        tocLinks.map((link) => [link, decodeURIComponent(link.hash.slice(1))]),
    );
    const progressBars = document.querySelectorAll<HTMLElement>(
        '[data-reading-progress]',
    );
    const progressLabels = document.querySelectorAll<HTMLElement>(
        '[data-reading-percent]',
    );
    const progressMeters = document.querySelectorAll<HTMLElement>(
        '[data-reading-meter]',
    );
    const scrolling = document.scrollingElement ?? document.documentElement;
    let layout: {
        articleTop: number;
        articleHeight: number;
        documentHeight: number;
        viewportHeight: number;
        headings: { id: string; top: number }[];
        headingTops: number[];
    };
    let geometryDirty = true;
    let revealDirty = true;
    let activeHeadingId = '';
    let lastProgress = -1;
    let lastPercent = -1;
    let scrollFrame = 0;

    const measure = (scrollTop: number) => {
        const rect = article.getBoundingClientRect();
        const headings = [
            ...article.querySelectorAll<HTMLElement>(
                'h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]',
            ),
        ]
            .filter((heading) => heading.getClientRects().length)
            .map((heading) => ({
                id: heading.id,
                top: heading.getBoundingClientRect().top + scrollTop,
            }))
            .sort((a, b) => a.top - b.top);
        layout = {
            articleTop: rect.top + scrollTop,
            articleHeight: rect.height,
            documentHeight: scrolling.scrollHeight,
            viewportHeight: innerHeight,
            headings,
            headingTops: headings.map((heading) => heading.top),
        };
        geometryDirty = false;
    };
    const updateScroll = () => {
        scrollFrame = 0;
        if (signal.aborted) return;
        const scrollTop = scrolling.scrollTop;
        if (geometryDirty) measure(scrollTop);
        const index = activeHeadingIndex(layout.headingTops, scrollTop + 120);
        const nextId = index < 0 ? '' : layout.headings[index].id;
        const headingChanged = nextId !== activeHeadingId;
        const progress = readingProgress({
            ...layout,
            articleTop: layout.articleTop - scrollTop,
            scrollTop,
        });
        const percent = Math.round(progress);
        const reveals: { area: HTMLElement; top: number }[] = [];
        if (headingChanged || revealDirty) {
            for (const link of tocLinks) {
                if (linkIds.get(link) !== nextId) continue;
                const area = link.closest<HTMLElement>('[data-toc-scroll]');
                if (!area) continue;
                const top = tocScrollTarget(link, area);
                if (top !== undefined) reveals.push({ area, top });
            }
        }

        // All geometry is read before changing classes, text, styles or scrolling.
        // TOC's active styles affect color/background, not its dimensions.
        if (headingChanged) {
            activeHeadingId = nextId;
            for (const link of tocLinks) {
                const active = linkIds.get(link) === nextId;
                link.classList.toggle('active', active);
                if (active) link.setAttribute('aria-current', 'location');
                else link.removeAttribute('aria-current');
            }
        }
        if (progress !== lastProgress) {
            progressBars.forEach(
                (bar) => (bar.style.transform = `scaleX(${progress / 100})`),
            );
            lastProgress = progress;
        }
        if (percent !== lastPercent) {
            progressLabels.forEach(
                (label) => (label.textContent = `${percent}%`),
            );
            progressMeters.forEach((meter) =>
                meter.setAttribute('aria-valuenow', String(percent)),
            );
            lastPercent = percent;
        }
        for (const { area, top } of reveals)
            area.scrollTo({ top, behavior: 'instant' });
        revealDirty = false;
    };
    const queueScrollUpdate = () => {
        if (!signal.aborted && !scrollFrame)
            scrollFrame = requestAnimationFrame(updateScroll);
    };
    const invalidate = () => {
        if (signal.aborted) return;
        geometryDirty = true;
        revealDirty = true;
        queueScrollUpdate();
    };
    document.addEventListener('scroll', queueScrollUpdate, {
        passive: true,
        signal,
    });
    window.addEventListener('resize', invalidate, { signal });
    window.addEventListener('pageshow', invalidate, { signal });
    document.addEventListener('load', invalidate, { capture: true, signal });
    document.addEventListener('toggle', invalidate, { capture: true, signal });
    document.fonts.addEventListener('loadingdone', invalidate, { signal });
    document.fonts.addEventListener('loadingerror', invalidate, { signal });
    const resize = new ResizeObserver(invalidate);
    resize.observe(article);
    resize.observe(document.body);
    const mutations = new MutationObserver(invalidate);
    mutations.observe(article, {
        childList: true,
        characterData: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['hidden', 'open', 'id', 'class', 'style'],
    });
    // Scroll locking can move the body without resizing the article itself.
    for (const root of [document.body, document.documentElement]) {
        mutations.observe(root, {
            attributes: true,
            attributeFilter: ['class', 'style'],
        });
    }
    signal.addEventListener(
        'abort',
        () => {
            cancelAnimationFrame(scrollFrame);
            resize.disconnect();
            mutations.disconnect();
        },
        { once: true },
    );
    updateScroll();
}
