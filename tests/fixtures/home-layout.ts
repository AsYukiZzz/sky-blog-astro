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
    'projects',
    'links',
] as const;

// Tuples are [row, column, columnSpan, rowSpan], with 1-based coordinates.
export const expectedHomePlacements = {
    compact: {
        author: [1, 1, 2, 4],
        stats: [5, 1, 2, 3],
        heatmap: [8, 1, 2, 2],
        categories: [10, 1, 2, 2],
        tags: [12, 1, 2, 2],
        recent: [14, 1, 2, 4],
        popular: [18, 1, 2, 4],
        moments: [22, 1, 2, 3],
        projects: [25, 1, 2, 3],
        links: [28, 1, 2, 3],
    },
    medium: {
        author: [1, 1, 4, 4],
        heatmap: [5, 1, 2, 3],
        stats: [5, 3, 2, 3],
        categories: [8, 1, 2, 2],
        tags: [8, 3, 2, 2],
        recent: [10, 1, 4, 6],
        popular: [16, 1, 4, 6],
        moments: [22, 1, 4, 3],
        projects: [25, 1, 4, 3],
        links: [28, 1, 4, 3],
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
        projects: [14, 1, 2, 3],
        links: [14, 3, 4, 3],
    },
} as const;

export const expectedHomeHeights = { compact: 3824, medium: 3940, wide: 2092 };

export const expectedHomeSizes = {
    author: ['2x4', '4x4'],
    heatmap: ['2x2', '2x3'],
    stats: ['2x3'],
    categories: ['2x2', '2x3'],
    tags: ['2x2', '2x3'],
    recent: ['2x4', '4x5', '4x6'],
    popular: ['2x4', '4x5', '4x6'],
    moments: ['2x3', '4x3'],
    projects: ['2x3', '4x3'],
    links: ['2x3', '4x3'],
} as const;
