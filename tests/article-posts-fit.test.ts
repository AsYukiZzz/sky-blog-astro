import assert from 'node:assert/strict';
import test from 'node:test';
import { visibleArticleCount } from '../src/lib/article-posts-fit.ts';

test('only whole article rows fit, including the gaps between them', () => {
    const heights = [40.4, 40.4, 40.4, 40.4, 40.4];
    assert.equal(visibleArticleCount(heights, 126, 3), 2);
    assert.equal(visibleArticleCount(heights, 127.2, 3), 3);
    assert.equal(visibleArticleCount(heights, 214, 3), 5);
});

test('resizing restores rows and expanded source data is never limited or changed', () => {
    const heights = [42, 50, 38, 45, 42, 42, 42, 42];
    assert.equal(visibleArticleCount(heights, 98, 3), 2);
    assert.equal(visibleArticleCount(heights, 230, 3), 5);
    assert.equal(visibleArticleCount(heights, 98, 3), 2);
    assert.equal(visibleArticleCount(heights, 1000, 3, 20), 5);
    assert.deepEqual(heights, [42, 50, 38, 45, 42, 42, 42, 42]);
});

test('fewer articles, a smaller configured limit and no usable row space remain bounded', () => {
    assert.equal(visibleArticleCount([40, 40], 300, 3), 2);
    assert.equal(visibleArticleCount([40, 40, 40, 40], 300, 3, 3), 3);
    assert.equal(visibleArticleCount([40], 39), 0);
    assert.equal(visibleArticleCount([], 300), 0);
    assert.equal(visibleArticleCount([0, 40], 300), 0);
});
