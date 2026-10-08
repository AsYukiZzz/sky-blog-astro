import assert from 'node:assert/strict';
import test from 'node:test';
import { homeCardSpecs } from '../src/components/home/card-specs.ts';
import { homePresets } from '../src/config/home-presets.ts';
import { compileHomeLayout } from '../src/lib/home-layout.ts';
import { homeLayoutCss } from '../src/lib/home-layout-css.ts';
import type { HomeConfig } from '../src/lib/home-cards.ts';

const compile = (config: HomeConfig) =>
    compileHomeLayout(config, homeCardSpecs, homePresets);
const ids = Object.keys(homeCardSpecs) as (keyof typeof homeCardSpecs)[];

test('source previews cover the largest capacity across all layouts', () => {
    const plan = compile({ preset: 'default' });
    assert.equal(
        plan.cards.find((card) => card.id === 'recent')?.maxPreviewItems,
        5,
    );
    assert.equal(
        plan.cards.find((card) => card.id === 'categories')?.maxPreviewItems,
        5,
    );
});

test('scalar inheritance and whole-template replacement never mutate input or presets', () => {
    const config: HomeConfig = {
        preset: 'default',
        layouts: {
            wide: {
                rowHeight: 120,
                areas: [...homePresets.default.wide.areas, '. . . . . .'],
            },
        },
    };
    const originalConfig = structuredClone(config);
    const originalPresets = structuredClone(homePresets);
    const plan = compile(config);
    assert.equal(plan.layouts.wide.rowHeight, 120);
    assert.equal(plan.layouts.wide.gap, 20);
    assert.equal(plan.layouts.wide.rows, 17);
    plan.layouts.wide.areas[0] = 'changed';
    assert.deepEqual(config, originalConfig);
    assert.deepEqual(homePresets, originalPresets);
});

test('disabling preserves partial gaps and columns, only removing newly empty rows', () => {
    const plan = compile({ preset: 'default', disabled: ['author', 'stats'] });
    assert.equal(plan.layouts.wide.columns, 6);
    assert.equal(plan.layouts.wide.rows, 16);
    assert.equal(plan.layouts.wide.areas[0], '. . heatmap heatmap . .');
    assert.equal(plan.layouts.compact.rows, 23);
    const withBlank = compile({
        preset: 'default',
        disabled: ['author'],
        layouts: {
            compact: { areas: ['. .', ...homePresets.default.compact.areas] },
        },
    });
    assert.equal(withBlank.layouts.compact.areas[0], '. .');
    assert.equal(withBlank.layouts.compact.rows, 26);
    const withoutMoments = compile({
        preset: 'default',
        disabled: ['moments'],
    });
    assert.ok(withoutMoments.cards.every((card) => card.id !== 'moments'));
    assert.equal(withoutMoments.layouts.medium.rows, 26);
});

test('all disabled cards produce no grid or residual blank height', () => {
    const plan = compile({ preset: 'default', disabled: ids });
    assert.deepEqual(plan.cards, []);
    for (const layout of Object.values(plan.layouts))
        assert.equal(layout.rows, 0);
    assert.equal(homeLayoutCss(plan), '');
});

test('configuration rejects unknown keys and invalid finite integer breakpoints', () => {
    const configs = [
        { preset: 'missing' },
        { preset: 'default', columns: 6 },
        { preset: 'default', disabled: ['typo'] },
        { preset: 'default', layouts: { mobile: {} } },
        { preset: 'default', layouts: { wide: { columns: 8 } } },
        { preset: 'default', layouts: { compact: { minWidth: 1 } } },
        { preset: 'default', layouts: { medium: { minWidth: 960 } } },
        { preset: 'default', layouts: { wide: { minWidth: Infinity } } },
        { preset: 'default', layouts: { wide: { rowHeight: 0 } } },
        { preset: 'default', layouts: { wide: { gap: -1 } } },
        { preset: 'default', layouts: { wide: { rowHeight: 112.5 } } },
        { preset: 'default', layouts: { wide: null } },
        { preset: 'default', disabled: 'author' },
    ];
    for (const config of configs)
        assert.throws(() => compile(config as unknown as HomeConfig), /HOME_/);
});

test('unsupported size is rejected before disabling with allowed sizes in diagnostics', () => {
    const config: HomeConfig = {
        preset: 'default',
        disabled: ['author'],
        layouts: {
            compact: {
                areas: homePresets.default.compact.areas.filter(
                    (_, i) => i !== 0,
                ),
            },
        },
    };
    assert.throws(
        () => compile(config),
        /HOME_SIZE_UNSUPPORTED \[compact\].*author.*2x3.*2x4.*4x4/s,
    );
});

test('every layout retains the card set while visual order can differ', () => {
    assert.throws(
        () =>
            compile({
                preset: 'default',
                layouts: {
                    compact: {
                        areas: homePresets.default.compact.areas.filter(
                            (row) => !row.includes('links'),
                        ),
                    },
                },
            }),
        /HOME_CARD_SET_MISMATCH/,
    );
    const areas = homePresets.default.compact.areas;
    const plan = compile({
        preset: 'default',
        layouts: {
            compact: {
                areas: [
                    ...areas.slice(4, 6),
                    ...areas.slice(0, 4),
                    ...areas.slice(6),
                ],
            },
        },
    });
    assert.equal(plan.cards[0].id, 'stats');
    assert.equal(plan.layouts.medium.order[0], 'author');
});

test('minimum card width and height are checked at the beginning of each breakpoint', () => {
    assert.throws(
        () =>
            compile({
                preset: 'default',
                layouts: { medium: { minWidth: 500 } },
            }),
        /HOME_CARD_TOO_NARROW \[medium\]/,
    );
    assert.throws(
        () =>
            compile({
                preset: 'default',
                layouts: { wide: { rowHeight: 80 } },
            }),
        /HOME_CARD_TOO_SHORT \[wide\]/,
    );
    assert.throws(
        () =>
            compile({
                preset: 'default',
                layouts: {
                    compact: {
                        areas: homePresets.default.compact.areas.map(
                            (row) => `${row} . .`,
                        ),
                    },
                },
            }),
        /HOME_CARD_TOO_NARROW \[compact\]/,
    );
});

test('CSS emits complete size variables and equal-specificity preview resets at every breakpoint', () => {
    const plan = compile({ preset: 'default' });
    const css = homeLayoutCss(plan);
    assert.match(css, /@container home-cards \(width >= 640px\)/);
    assert.match(css, /@container home-cards \(width >= 960px\)/);
    assert.match(css, /grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
    assert.equal(
        (
            css.match(
                /data-home-card="recent"\] \[data-home-items\] > \[data-home-item\]:nth-child\(n\)/g,
            ) ?? []
        ).length,
        3,
    );
    assert.equal(
        (css.match(/--home-card-excerpt-display:none/g) ?? []).length,
        1,
    );
    assert.match(css, /--home-card-excerpt-display:block/);
    assert.match(
        css,
        /nth-child\(-n \+ 5\)\{display:var\(--home-card-item-display\)\}/,
    );
});

test('new registered IDs need no card-specific rules in the compiler', () => {
    const layout = {
        minWidth: 0,
        rowHeight: 112,
        gap: 16,
        areas: ['weather weather', 'weather weather'],
    };
    const presets = {
        default: {
            compact: layout,
            medium: { ...layout, minWidth: 640 },
            wide: { ...layout, minWidth: 960 },
        },
    } satisfies typeof homePresets;
    const plan = compileHomeLayout(
        { preset: 'default' },
        {
            weather: {
                headingId: 'weather-title',
                baseCssVars: {},
                sizes: {
                    '2x2': {
                        profile: 'compact',
                        minInlineSize: 280,
                        minBlockSize: 220,
                        cssVars: {},
                    },
                },
            },
        },
        presets,
    );
    assert.equal(plan.cards[0].id, 'weather');
});

test('a variable introduced by one size is cleared again by subsequent layouts', () => {
    const specs = structuredClone(homeCardSpecs);
    specs.author.sizes = {
        ...specs.author.sizes,
        '4x4': {
            ...specs.author.sizes['4x4']!,
            cssVars: { '--home-card-test-color': 'red' },
        },
    };
    const plan = compileHomeLayout({ preset: 'default' }, specs, homePresets);
    assert.equal(
        plan.layouts.medium.placements.find((card) => card.id === 'author')
            ?.cssVars['--home-card-test-color'],
        'red',
    );
    assert.equal(
        plan.layouts.wide.placements.find((card) => card.id === 'author')
            ?.cssVars['--home-card-test-color'],
        'initial',
    );
});

test('column gaps cannot exceed the smallest container even when all cards span every column', () => {
    assert.throws(
        () =>
            compile({ preset: 'default', layouts: { compact: { gap: 400 } } }),
        /HOME_GRID_TOO_NARROW \[compact\]/,
    );
    // Zero-width tracks still produce the declared width; negative tracks do not.
    assert.equal(
        compile({ preset: 'default', layouts: { compact: { gap: 288 } } })
            .layouts.compact.gap,
        288,
    );
});

test('list cards must declare a preview limit for every registered size', () => {
    const specs = structuredClone(homeCardSpecs);
    delete specs.recent.sizes['4x6']!.previewLimit;
    assert.throws(
        () => compileHomeLayout({ preset: 'default' }, specs, homePresets),
        /HOME_PREVIEW_LIMIT_MISMATCH \[recent\]/,
    );
});
