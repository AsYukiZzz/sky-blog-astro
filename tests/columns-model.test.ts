import assert from 'node:assert/strict';
import test from 'node:test';
import { columnsSchema, resolveColumns } from '../src/lib/columns-model.ts';

const now = new Date('2026-10-01T12:00:00Z');
const post = (id: string, data: Record<string, unknown> = {}) => ({
    id,
    data: {
        slug: id,
        title: id,
        publishedAt: new Date('2026-09-20T00:00:00Z'),
        ...data,
    },
});
const configs = (items: { slug: string; posts: string[]; name?: string }[]) =>
    columnsSchema.parse(items.map((item) => ({ name: item.slug, ...item })));

test('columns preserve both configured orders without mutating inputs', () => {
    const input = configs([
        { slug: 'second', posts: ['old', 'new', 'pinned'] },
        { slug: 'first', posts: [] },
    ]);
    const entries = [
        post('new', { publishedAt: new Date('2026-09-30') }),
        post('pinned', { pinned: true }),
        post('old', { publishedAt: new Date('2026-01-01') }),
    ];
    const before = structuredClone({ input, entries });
    const result = resolveColumns(input, entries, now);
    assert.deepEqual(
        result.map((column) => column.slug),
        ['second', 'first'],
    );
    assert.deepEqual(
        result[0].posts.map((entry) => entry.id),
        ['old', 'new', 'pinned'],
    );
    assert.deepEqual({ input, entries }, before);
});

test('hidden references remain valid but never appear in public results', () => {
    const entries = [
        post('published'),
        post('SECRET_DRAFT_FIXTURE', { draft: true }),
        post('SECRET_PRIVATE_FIXTURE', { visibility: 'private' }),
        post('SECRET_RESTRICTED_FIXTURE', { visibility: 'restricted' }),
        post('SECRET_FUTURE_FIXTURE', { publishedAt: new Date('2099-01-01') }),
    ];
    const result = resolveColumns(
        configs([{ slug: 'guide', posts: entries.map((entry) => entry.id) }]),
        entries,
        now,
    );
    assert.deepEqual(
        result[0].posts.map((entry) => entry.id),
        ['published'],
    );
    assert.doesNotMatch(JSON.stringify(result), /SECRET_/);
});

test('empty configuration and empty columns have stable public output', () => {
    assert.deepEqual(resolveColumns([], [], now), []);
    const [empty] = resolveColumns(
        configs([{ slug: 'empty', posts: [] }]),
        [],
        now,
    );
    assert.deepEqual(empty.posts, []);
    assert.equal(empty.cover, '/images/mist.svg');
    assert.equal(empty.description, '');
});

test('duplicate column routes reject canonically equivalent slugs', () => {
    assert.throws(
        () =>
            resolveColumns(
                configs([
                    { slug: 'café', posts: [] },
                    { slug: 'cafe\u0301', posts: [] },
                ]),
                [],
                now,
            ),
        /columns\.jsonc.*café/s,
    );
});

test('post references are unique within and across columns including hidden posts', () => {
    const entries = [post('café', { draft: true })];
    for (const input of [
        configs([{ slug: 'first', posts: ['café', 'cafe\u0301'] }]),
        configs([
            { slug: 'first', posts: ['café'] },
            { slug: 'second', posts: ['cafe\u0301'] },
        ]),
    ])
        assert.throws(
            () => resolveColumns(input, entries, now),
            /columns\.jsonc.*café/s,
        );
});

test('missing references identify their column and data file', () => {
    assert.throws(
        () =>
            resolveColumns(
                configs([{ slug: 'guide', posts: ['missing'] }]),
                [],
                now,
            ),
        (error: Error) =>
            /columns\.jsonc/.test(error.message) &&
            /guide/.test(error.message) &&
            /missing/.test(error.message),
    );
});

test('Chinese and nested references resolve by slug instead of filename', () => {
    const entries = [
        post('different-file', { slug: '教程/你好世界' }),
        post('accent-file', { slug: 'café' }),
    ];
    const [column] = resolveColumns(
        configs([{ slug: '教程', posts: ['教程/你好世界', 'cafe\u0301'] }]),
        entries,
        now,
    );
    assert.deepEqual(
        column.posts.map((entry) => entry.id),
        ['different-file', 'accent-file'],
    );
});

test('column schemas reject invalid identifiers and unsupported sorting fields', () => {
    for (const slug of ['', ' ', '.', '..', 'one/two', '/one', 'one?two']) {
        assert.equal(
            columnsSchema.safeParse([{ slug, name: 'Guide', posts: [] }])
                .success,
            false,
            slug,
        );
    }
    assert.equal(
        columnsSchema.safeParse([{ slug: 'guide', name: '  ', posts: [] }])
            .success,
        false,
    );
    assert.equal(
        columnsSchema.safeParse([
            { slug: 'guide', name: 'Guide', posts: ['../secret'] },
        ]).success,
        false,
    );
    assert.equal(
        columnsSchema.safeParse([
            { slug: 'guide', name: 'Guide', posts: [], sort: 'manual' },
        ]).success,
        false,
    );
    assert.equal(
        columnsSchema.parse([{ slug: 'guide', name: ' Guide ', posts: [] }])[0]
            .name,
        'Guide',
    );
});

test('column covers accept local and HTTP images with an empty fallback', () => {
    for (const cover of [
        '',
        '/images/mist.svg',
        'https://example.com/cover.webp',
        'http://example.com/image.png',
    ]) {
        const input = columnsSchema.parse([
            { slug: 'guide', name: 'Guide', posts: [], cover },
        ]);
        assert.equal(
            resolveColumns(input, [], now)[0].cover,
            cover || '/images/mist.svg',
        );
    }
    for (const cover of [
        '//example.com/image.png',
        'javascript:alert(1)',
        'data:image/svg+xml,x',
        'relative.png',
        '/\\example.com/image',
    ]) {
        assert.equal(
            columnsSchema.safeParse([
                { slug: 'guide', name: 'Guide', posts: [], cover },
            ]).success,
            false,
            cover,
        );
    }
});
