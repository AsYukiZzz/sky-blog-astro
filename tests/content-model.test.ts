import assert from 'node:assert/strict';
import test from 'node:test';
import {
    isPublicContent,
    sortPosts,
    routeFor,
    paginateItems,
    archiveGroups,
    validateContent,
    validateCollection,
    publicTaxonomy,
    activityDays,
} from '../src/lib/content-model.ts';

const now = new Date('2026-10-01T12:00:00Z');
const make = (id: string, data: Record<string, unknown> = {}) => ({
    id,
    data: {
        title: id,
        slug: id,
        publishedAt: new Date('2026-09-20T00:00:00Z'),
        author: 'sky',
        categories: ['development'],
        tags: ['astro'],
        ...data,
    },
});

test('only public, published content participates in every aggregate', () => {
    const entries = [
        make('public'),
        make('draft', { draft: true }),
        make('private', { visibility: 'private' }),
        make('protected', { visibility: 'restricted' }),
        make('future', { publishedAt: new Date('2026-10-02T00:00:00Z') }),
    ];
    assert.deepEqual(
        entries
            .filter((entry) => isPublicContent(entry.data, now))
            .map((entry) => entry.id),
        ['public'],
    );
});

test('pinned posts sort ahead of newer posts without mutating the collection', () => {
    const entries = [
        make('older'),
        make('new', { publishedAt: new Date('2026-09-30T00:00:00Z') }),
        make('pinned', { pinned: true }),
    ];
    assert.deepEqual(
        sortPosts(entries).map((entry) => entry.id),
        ['pinned', 'new', 'older'],
    );
    assert.deepEqual(
        entries.map((entry) => entry.id),
        ['older', 'new', 'pinned'],
    );
});

test('nested and Chinese slugs generate encoded local routes and reject traversal', () => {
    assert.equal(
        routeFor('posts', '教程/你好世界'),
        '/posts/%E6%95%99%E7%A8%8B/%E4%BD%A0%E5%A5%BD%E4%B8%96%E7%95%8C/',
    );
    for (const slug of [
        '../secret',
        'foo//bar',
        'foo?bar',
        'https://example.com',
        '/absolute',
        'foo/..',
    ])
        assert.throws(() => routeFor('posts', slug), /slug/);
});

test('pagination keeps the final partial page and has a single empty state', () => {
    assert.deepEqual(paginateItems([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
    assert.deepEqual(paginateItems([], 2), [[]]);
    assert.throws(() => paginateItems([1], 0), /pageSize/);
});

test('archives use the configured timezone at month boundaries', () => {
    const groups = archiveGroups(
        [
            make('boundary', { publishedAt: new Date('2026-09-30T16:30:00Z') }),
            make('september'),
        ],
        'Asia/Shanghai',
    );
    assert.deepEqual(
        groups.map((group) => [
            group.key,
            group.entries.map((entry) => entry.id),
        ]),
        [
            ['2026-10', ['boundary']],
            ['2026-09', ['september']],
        ],
    );
});

test('content validation rejects duplicate URLs and unresolved authors', () => {
    const refs = {
        authors: ['sky'],
    };
    assert.throws(
        () =>
            validateContent(
                [make('one', { slug: 'same' }), make('two', { slug: 'same' })],
                refs,
            ),
        /duplicate/,
    );
    assert.throws(
        () => validateContent([make('missing', { author: 'unknown' })], refs),
        /author/,
    );
    assert.doesNotThrow(() => validateContent([make('valid')], refs));
});

test('content validation accepts taxonomy IDs without a registry', () => {
    assert.doesNotThrow(() =>
        validateContent(
            [
                make('new-taxonomy', {
                    categories: ['开发/随手记'],
                    tags: ['新标签', 'new-topic'],
                }),
            ],
            { authors: ['sky'] },
        ),
    );
});

test('content validation rejects taxonomy IDs that cannot form local routes', () => {
    for (const field of ['categories', 'tags']) {
        for (const id of ['', ' ', '..', 'foo//bar', 'foo?bar', '/absolute']) {
            assert.throws(
                () =>
                    validateContent([make('invalid', { [field]: [id] })], {
                        authors: ['sky'],
                    }),
                /Invalid slug/,
                `${field} must reject ${JSON.stringify(id)}`,
            );
        }
    }
});

test('activity counts include all posts and roll over in the site timezone', () => {
    const counts = activityDays(
        [
            make('one', { publishedAt: new Date('2026-09-30T16:30:00Z') }),
            make('two', { publishedAt: new Date('2026-10-01T00:00:00Z') }),
        ],
        'Asia/Shanghai',
    );
    assert.deepEqual(counts, { '2026-10-01': 2 });
});

test('all content collections reject duplicate routes and unresolved authors', () => {
    for (const collection of ['pages', 'moments']) {
        assert.throws(
            () =>
                validateCollection(
                    [
                        make('one', { slug: 'same' }),
                        make('two', { slug: 'same' }),
                    ],
                    collection,
                    ['sky'],
                ),
            /duplicate/,
        );
        assert.throws(
            () =>
                validateCollection(
                    [make('unknown-author', { author: 'unknown' })],
                    collection,
                    ['sky'],
                ),
            /author/,
        );
    }
});

test('all content collections reject explicitly blank author references', () => {
    for (const collection of ['posts', 'pages', 'moments']) {
        for (const author of ['', '   ', '\t\n']) {
            assert.throws(
                () =>
                    validateCollection(
                        [make('blank-author', { author })],
                        collection,
                        ['sky'],
                    ),
                /author/,
                `${collection} must reject ${JSON.stringify(author)}`,
            );
        }
    }
});

test('public taxonomy never reveals categories or tags exclusive to non-public content', () => {
    const entries = [
        make('public'),
        ...[
            { visibility: 'private' },
            { visibility: 'restricted' },
            { draft: true },
            { publishedAt: new Date('2099-01-01') },
        ].map((state, index) =>
            make(`hidden-${index}`, {
                ...state,
                categories: ['secret-category'],
                tags: ['secret-tag'],
            }),
        ),
    ];
    assert.deepEqual(publicTaxonomy(entries, now), {
        categories: ['development'],
        tags: ['astro'],
    });
    assert.deepEqual(publicTaxonomy([], now), {
        categories: [],
        tags: [],
    });
});

test('public taxonomy uses article values and removes duplicates', () => {
    const entries = [
        make('one', {
            categories: ['开发/随手记', 'development', '开发/随手记'],
            tags: ['新标签', 'astro', '新标签'],
        }),
        make('two', {
            categories: ['development'],
            tags: ['astro', 'new-topic'],
        }),
    ];
    assert.deepEqual(publicTaxonomy(entries, now), {
        categories: ['开发/随手记', 'development'],
        tags: ['新标签', 'astro', 'new-topic'],
    });
});

test('public taxonomy preserves article occurrence order without mutating entries', () => {
    const entries = [
        make('one', {
            categories: ['new-category', 'development', 'design'],
            tags: ['new-tag', 'astro'],
        }),
        make('two', { categories: ['design'], tags: ['astro'] }),
    ];
    const snapshot = structuredClone(entries);
    assert.deepEqual(publicTaxonomy(entries, now), {
        categories: ['new-category', 'development', 'design'],
        tags: ['new-tag', 'astro'],
    });
    assert.deepEqual(entries, snapshot);
});

test('articles without categories or tags produce empty taxonomy', () => {
    assert.deepEqual(
        publicTaxonomy(
            [
                make('missing', { categories: undefined, tags: undefined }),
                make('empty', { categories: [], tags: [] }),
            ],
            now,
        ),
        {
            categories: [],
            tags: [],
        },
    );
});
