import type {
    HomeCardSpec,
    HomeCardSizeSpec,
    HomeCssVars,
} from '../../lib/home-cards.ts';

function size(
    profile: string,
    columns: 2 | 4 | 6,
    rows: 2 | 3 | 4 | 5 | 6,
    previewLimit?: number,
    cssVars: HomeCssVars = {},
): HomeCardSizeSpec {
    return {
        profile,
        minInlineSize: { 2: 280, 4: 580, 6: 900 }[columns],
        minBlockSize: { 2: 220, 3: 320, 4: 440, 5: 560, 6: 680 }[rows],
        ...(previewLimit === undefined ? {} : { previewLimit }),
        cssVars,
    };
}

const postVars = {
    '--home-card-item-display': 'block',
    '--home-card-title-lines': 2,
    '--home-card-excerpt-display': 'none',
    '--home-card-excerpt-lines': 1,
};

const expandedPostVars = {
    '--home-card-title-lines': 1,
    '--home-card-excerpt-display': 'block',
    '--home-card-excerpt-lines': 2,
};

/** Content capacities belong to cards; layout templates only describe geometry. */
const specs = {
    author: {
        headingId: 'home-author-title',
        baseCssVars: {
            '--home-card-author-details': 'block',
            '--home-card-author-bio-lines': 'unset',
        },
        sizes: {
            '2x4': size('full', 2, 4),
            '4x4': size('wide', 4, 4),
        },
    },
    heatmap: {
        headingId: 'home-writing-title',
        ignoreSearch: true,
        baseCssVars: {},
        sizes: {
            '2x2': { ...size('compact', 2, 2), minInlineSize: 288 },
            '2x3': { ...size('full', 2, 3), minInlineSize: 288 },
        },
    },
    stats: {
        headingId: 'home-stats-title',
        baseCssVars: { '--home-card-stats-columns': 2 },
        sizes: {
            '2x2': size('compact', 2, 2),
            '2x3': size('full', 2, 3),
        },
    },
    categories: {
        headingId: 'home-categories-title',
        baseCssVars: { '--home-card-item-display': 'flex' },
        sizes: {
            '2x2': size('compact', 2, 2, 3),
            '2x3': size('full', 2, 3, 5),
        },
    },
    tags: {
        headingId: 'home-tags-title',
        baseCssVars: { '--home-card-item-display': 'inline-flex' },
        sizes: {
            '2x2': size('compact', 2, 2, 8),
            '2x3': size('full', 2, 3, 14),
        },
    },
    recent: {
        headingId: 'home-recent-title',
        baseCssVars: postVars,
        sizes: {
            '2x4': size('compact', 2, 4, 3),
            '4x5': size('expanded', 4, 5, 5, expandedPostVars),
            '4x6': size('expanded', 4, 6, 5, expandedPostVars),
        },
    },
    popular: {
        headingId: 'home-popular-title',
        baseCssVars: { ...postVars, '--home-card-excerpt-display': 'block' },
        sizes: {
            '2x4': size('compact', 2, 4, 3),
            '4x5': size('expanded', 4, 5, 5, expandedPostVars),
            '4x6': size('expanded', 4, 6, 5, expandedPostVars),
        },
    },
    moments: {
        headingId: 'home-moments-title',
        anchor: 'home-moments',
        baseCssVars: {
            '--home-card-item-display': 'flex',
            '--home-card-moment-lines': 3,
        },
        sizes: {
            '2x3': size('compact', 2, 3, 2),
            '4x3': size('wide', 4, 3, 2),
        },
    },
    links: {
        headingId: 'home-links-title',
        baseCssVars: {
            '--home-card-item-display': 'flex',
            '--home-card-links-columns': 1,
        },
        sizes: {
            '2x3': size('compact', 2, 3, 3),
            '4x3': size('wide', 4, 3, 6, { '--home-card-links-columns': 3 }),
            '6x2': size('full', 6, 2, 6, { '--home-card-links-columns': 3 }),
        },
    },
} satisfies Record<string, HomeCardSpec>;

export type HomeCardId = keyof typeof specs;
export const homeCardSpecs: Readonly<Record<HomeCardId, HomeCardSpec>> = specs;
