import assert from 'node:assert/strict';
import test from 'node:test';
import { readingProgress } from '../src/lib/reading-progress.ts';

const article = {
    articleTop: -600,
    articleHeight: 3000,
    viewportHeight: 1440,
    scrollTop: 1000,
    documentHeight: 6000,
};

test('reading progress completes when the article bottom reaches a tall viewport', () => {
    assert.equal(readingProgress({ ...article, articleTop: -1560 }), 100);
});

test('reading progress completes at document bottom even when other layout height limits scrolling', () => {
    assert.equal(
        readingProgress({
            ...article,
            scrollTop: 4560,
        }),
        100,
    );
});

test('long articles retain intermediate progress before their bottom is visible', () => {
    assert.equal(readingProgress({ ...article, articleTop: -780 }), 50);
});

test('reading progress stays at zero before a long article is reached', () => {
    assert.equal(readingProgress({ ...article, articleTop: 200 }), 0);
});

test('a short article completes when all of its content fits in the viewport', () => {
    assert.equal(
        readingProgress({
            ...article,
            articleTop: 400,
            articleHeight: 700,
        }),
        100,
    );
});

test('a short article entering the viewport retains intermediate progress', () => {
    assert.equal(
        readingProgress({
            ...article,
            articleTop: 1090,
            articleHeight: 700,
        }),
        50,
    );
});

test('an article below the viewport has zero progress', () => {
    assert.equal(
        readingProgress({
            ...article,
            articleTop: 1600,
            articleHeight: 700,
        }),
        0,
    );
});

test('document completion tolerates fractional scroll positions', () => {
    assert.equal(readingProgress({ ...article, scrollTop: 4559.5 }), 100);
});

test('an article in a document that needs no scrolling is complete', () => {
    assert.equal(
        readingProgress({
            ...article,
            articleTop: 200,
            articleHeight: 700,
            scrollTop: 0,
            documentHeight: 1200,
        }),
        100,
    );
});
