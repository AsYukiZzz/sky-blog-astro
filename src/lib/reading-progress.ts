interface ReadingProgressMetrics {
    articleTop: number;
    articleHeight: number;
    viewportHeight: number;
    scrollTop: number;
    documentHeight: number;
}

export function readingProgress({
    articleTop,
    articleHeight,
    viewportHeight,
    scrollTop,
    documentHeight,
}: ReadingProgressMetrics): number {
    const articleBottom = articleTop + articleHeight;
    const documentBottom = Math.max(0, documentHeight - viewportHeight);
    if (articleBottom <= viewportHeight || scrollTop >= documentBottom - 1)
        return 100;

    const progress =
        articleHeight > viewportHeight
            ? -articleTop / (articleHeight - viewportHeight)
            : (viewportHeight - articleTop) / Math.max(1, articleHeight);
    return Math.min(100, Math.max(0, progress * 100));
}
