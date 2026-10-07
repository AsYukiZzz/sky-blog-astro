import assert from 'node:assert/strict';
import test from 'node:test';
import { buildToc, type TocHeading, type TocNode } from '../src/lib/toc.ts';

const heading = (depth: number, slug: string): TocHeading => ({
    depth,
    slug,
    text: slug,
});
const outline = (nodes: TocNode[]): unknown[] =>
    nodes.map((node) => [node.slug, outline(node.children)]);

test('all six heading levels remain nested under their nearest parent', () => {
    const headings = [1, 2, 3, 4, 5, 6].map((depth) =>
        heading(depth, `h${depth}`),
    );
    assert.deepEqual(outline(buildToc(headings)), [
        ['h1', [['h2', [['h3', [['h4', [['h5', [['h6', []]]]]]]]]]]],
    ]);
});

test('skipped levels, sibling headings and new roots retain the document order', () => {
    const headings = [
        heading(2, 'intro'),
        heading(4, 'detail'),
        heading(6, 'example'),
        heading(4, 'other-detail'),
        heading(3, 'next'),
        heading(2, 'summary'),
        heading(1, 'appendix'),
    ];
    assert.deepEqual(outline(buildToc(headings)), [
        [
            'intro',
            [
                ['detail', [['example', []]]],
                ['other-detail', []],
                ['next', []],
            ],
        ],
        ['summary', []],
        ['appendix', []],
    ]);
});

test('provided Unicode slugs and duplicate titles are preserved without mutating headings', () => {
    const headings = Object.freeze([
        Object.freeze({ depth: 2, slug: '配置', text: '配置与部署' }),
        Object.freeze({ depth: 3, slug: '配置-1', text: '配置与部署' }),
    ]);
    const tree = buildToc(headings);
    assert.equal(tree[0].text, '配置与部署');
    assert.equal(tree[0].children[0].slug, '配置-1');
    assert.equal(tree[0].children[0].text, '配置与部署');
    assert.notEqual(tree[0], headings[0]);
    assert.deepEqual(headings, [
        { depth: 2, slug: '配置', text: '配置与部署' },
        { depth: 3, slug: '配置-1', text: '配置与部署' },
    ]);
});

test('a document without headings produces an empty outline', () => {
    assert.deepEqual(buildToc([]), []);
});
