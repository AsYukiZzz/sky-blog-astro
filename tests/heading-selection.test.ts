import assert from 'node:assert/strict';
import test from 'node:test';
import { activeHeadingIndex } from '../src/lib/reading-progress.ts';

test('an empty article has no active heading, while scrolling before the first selects the first', () => {
    assert.equal(activeHeadingIndex([], 120), -1);
    assert.equal(activeHeadingIndex([500, 1000], 120), 0);
});

test('heading selection includes the exact threshold and the last coincident heading', () => {
    assert.equal(activeHeadingIndex([500, 1000, 1000, 2000], 999), 0);
    assert.equal(activeHeadingIndex([500, 1000, 1000, 2000], 1000), 2);
    assert.equal(activeHeadingIndex([500, 1000, 1000, 2000], 2200), 3);
});

test('long articles select intermediate headings without losing fractional positions', () => {
    const tops = Array.from(
        { length: 1000 },
        (_, index) => 500.5 + index * 100,
    );
    assert.equal(activeHeadingIndex(tops, 40500.4), 399);
    assert.equal(activeHeadingIndex(tops, 40500.5), 400);
});
