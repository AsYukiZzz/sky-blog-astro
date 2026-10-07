// Hand-specified expectations from the requested layout, independent of the templates.
export const expectedHomeOrder = [
    'author',
    'stats',
    'heatmap',
    'categories',
    'tags',
    'recent',
    'popular',
    'moments',
    'links',
] as const;

// Tuples are [row, column, columnSpan, rowSpan], with 1-based coordinates.
export const expectedHomePlacements = {
    compact: {
        author: [1, 1, 2, 4],
        stats: [5, 1, 2, 2],
        heatmap: [7, 1, 2, 2],
        categories: [9, 1, 2, 2],
        tags: [11, 1, 2, 2],
        recent: [13, 1, 2, 4],
        popular: [17, 1, 2, 4],
        moments: [21, 1, 2, 3],
        links: [24, 1, 2, 3],
    },
    medium: {
        author: [1, 1, 4, 4],
        heatmap: [5, 1, 2, 2],
        stats: [5, 3, 2, 2],
        categories: [7, 1, 2, 2],
        tags: [7, 3, 2, 2],
        recent: [9, 1, 4, 6],
        popular: [15, 1, 4, 6],
        moments: [21, 1, 4, 3],
        links: [24, 1, 4, 3],
    },
    wide: {
        author: [1, 1, 2, 4],
        heatmap: [1, 3, 2, 3],
        stats: [1, 5, 2, 3],
        recent: [4, 3, 4, 5],
        categories: [5, 1, 2, 3],
        tags: [8, 1, 2, 3],
        popular: [9, 3, 4, 5],
        moments: [11, 1, 2, 3],
        links: [14, 1, 6, 2],
    },
} as const;

export const expectedHomeHeights = { compact: 3312, medium: 3412, wide: 1960 };

export const expectedHomeSizes = {
    author: ['2x4', '4x4'],
    heatmap: ['2x2', '2x3'],
    stats: ['2x2', '2x3'],
    categories: ['2x2', '2x3'],
    tags: ['2x2', '2x3'],
    recent: ['2x4', '4x5', '4x6'],
    popular: ['2x4', '4x5', '4x6'],
    moments: ['2x3', '4x3'],
    links: ['2x3', '4x3', '6x2'],
} as const;
