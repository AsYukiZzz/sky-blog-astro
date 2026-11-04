interface ReadingProgressMetrics {
    articleTop: number;
    articleHeight: number;
    viewportHeight: number;
    scrollTop: number;
    documentHeight: number;
}

// Tops are sorted document coordinates; the first title stays selected above it.
export function activeHeadingIndex(
    tops: readonly number[],
    boundary: number,
): number {
    if (!tops.length) return -1;
    let low = 0;
    let high = tops.length;
    while (low < high) {
        const middle = (low + high) >>> 1;
        if (tops[middle] <= boundary) low = middle + 1;
        else high = middle;
    }
    return Math.max(0, low - 1);
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
