// Only include complete rows, keeping the sidebar usable at short window heights.
export function visibleArticleCount(
    heights: number[],
    available: number,
    gap = 0,
    limit = 5,
): number {
    let used = 0;
    let count = 0;
    const maximum = Math.max(0, Math.min(5, Math.floor(limit)));
    for (const height of heights.slice(0, maximum)) {
        const next = used + height + (count ? Math.max(0, gap) : 0);
        if (height <= 0 || !Number.isFinite(next) || next > available) break;
        used = next;
        count++;
    }
    return count;
}
