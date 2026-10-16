import assert from 'node:assert/strict';
import test from 'node:test';
import { columnPages } from '../src/lib/columns-pages.ts';

const column = (slug: string, ids: string[]) => ({
    slug,
    name: slug,
    description: '',
    cover: '/images/mist.svg',
    posts: ids.map((id) => ({
        id,
        data: { slug: id, publishedAt: new Date('2020-01-01') },
    })),
});

test('manual pages preserve order including a partial final page', () => {
    const columns = [column('manual', ['p03', 'p01', 'p02'])];
    const pages = columnPages(columns, 2);
    assert.deepEqual(
        pages.map((page) => page.path),
        ['/columns/manual/', '/columns/manual/page/2/'],
    );
    assert.deepEqual(
        pages.map((page) => page.props.posts.map((post) => post.id)),
        [['p03', 'p01'], ['p02']],
    );
    assert.deepEqual(
        pages.map((page) => page.props.current),
        [1, 2],
    );
    assert.equal(pages[1].props.total, 2);
    assert.equal(pages[0].props.columns, columns);
    assert.equal(pages[0].props.column, columns[0]);
});

test('empty columns still have one detail page', () => {
    const pages = columnPages([column('empty', [])], 2);
    assert.equal(pages.length, 1);
    assert.deepEqual(pages[0].props.posts, []);
    assert.deepEqual(columnPages([], 2), []);
});

test('Unicode paths encode links without encoding route params', () => {
    const [page] = columnPages([column('教程', [])], 2);
    assert.equal(page.params.slug, '教程');
    assert.equal(page.path, '/columns/%E6%95%99%E7%A8%8B/');
});
