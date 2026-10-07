import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHomeGridTemplate } from '../src/lib/home-grid-template.ts';

const ids = ['author', 'stats', 'recent'];

test('whitespace and intentional gaps produce exact 1-based rectangles', () => {
    const areas = [
        'author\tauthor stats stats',
        'author  author stats stats',
        '. . recent recent',
        '. . recent recent',
    ];
    const original = structuredClone(areas);
    const grid = parseHomeGridTemplate(areas, ids, 'wide');
    assert.equal(grid.columns, 4);
    assert.equal(grid.rows, 4);
    assert.deepEqual(grid.order, ids);
    assert.deepEqual(grid.placements[2], {
        id: 'recent',
        row: 3,
        column: 3,
        rowSpan: 2,
        columnSpan: 2,
        size: '2x2',
    });
    assert.equal(grid.areas[0], 'author author stats stats');
    assert.deepEqual(areas, original);
});

test('unknown cards and malformed tokens have layout and cell diagnostics', () => {
    assert.throws(
        () => parseHomeGridTemplate(['author typo'], ids, 'medium'),
        /HOME_CARD_UNKNOWN \[medium\].*typo.*1.*2/s,
    );
    for (const token of ['Author', '..', 'author_', '1author']) {
        assert.throws(
            () => parseHomeGridTemplate([token], ids, 'compact'),
            /HOME_TOKEN_INVALID/,
        );
    }
});

test('L shapes, holes and disconnected occurrences cannot form one card', () => {
    for (const areas of [
        ['author author', 'author .'],
        ['author author author', 'author . author', 'author author author'],
        ['author . author'],
    ]) {
        assert.throws(
            () => parseHomeGridTemplate(areas, ids, 'wide'),
            /HOME_AREA_NON_RECTANGULAR \[wide\].*author/s,
        );
    }
});

test('empty, multiline, unequal and non-string rows are rejected', () => {
    for (const areas of [
        [],
        [''],
        ['. .'],
        ['author\nauthor'],
        ['author author', 'author'],
        [null],
    ]) {
        assert.throws(
            () =>
                parseHomeGridTemplate(
                    areas as unknown as string[],
                    ids,
                    'compact',
                ),
            /HOME_/,
        );
    }
});
