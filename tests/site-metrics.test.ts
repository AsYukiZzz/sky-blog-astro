import assert from 'node:assert/strict';
import test from 'node:test';
import {
    copyrightYears,
    operatingDays,
    pageLoadMilliseconds,
} from '../src/lib/site-metrics.ts';

test('operating days include the first day and advance at midnight in the site timezone', () => {
    assert.equal(
        operatingDays(
            '2026-10-01',
            'Asia/Shanghai',
            new Date('2026-10-01T04:00:00Z'),
        ),
        1,
    );
    assert.equal(
        operatingDays(
            '2026-10-01',
            'Asia/Shanghai',
            new Date('2026-10-04T15:59:59Z'),
        ),
        4,
    );
    assert.equal(
        operatingDays(
            '2026-10-01',
            'Asia/Shanghai',
            new Date('2026-10-04T16:00:00Z'),
        ),
        5,
    );
});

test('calendar day counting survives leap days, year changes and daylight saving', () => {
    assert.equal(
        operatingDays(
            '2024-02-28',
            'Asia/Shanghai',
            new Date('2024-03-01T00:00:00Z'),
        ),
        3,
    );
    assert.equal(
        operatingDays(
            '2025-12-31',
            'Asia/Shanghai',
            new Date('2026-01-01T00:00:00Z'),
        ),
        2,
    );
    assert.equal(
        operatingDays(
            '2024-03-09',
            'America/Los_Angeles',
            new Date('2024-03-11T07:00:00Z'),
        ),
        3,
    );
});

test('missing and invalid founding dates stay unknown; a future founding date counts zero days', () => {
    const now = new Date('2026-10-05T08:00:00Z');
    for (const startedAt of [
        '',
        '2026-02-30',
        '2025-02-29',
        '2026-13-01',
        '2026-1-1',
        'not a date',
    ]) {
        assert.equal(
            operatingDays(startedAt, 'Asia/Shanghai', now),
            null,
            startedAt,
        );
    }
    assert.equal(operatingDays('2026-10-06', 'Asia/Shanghai', now), 0);
    assert.equal(operatingDays('2026-10-01', 'invalid/timezone', now), null);
    assert.equal(
        operatingDays('2026-10-01', 'Asia/Shanghai', new Date('invalid')),
        null,
    );
});

test('copyright years follow the site year without repeating a single year', () => {
    assert.equal(
        copyrightYears(2026, 'Asia/Shanghai', new Date('2026-10-05T08:00:00Z')),
        '2026',
    );
    assert.equal(
        copyrightYears(2025, 'Asia/Shanghai', new Date('2025-12-31T16:00:00Z')),
        '2025–2026',
    );
});

test('initial page timing waits for a completed navigation entry', () => {
    assert.equal(
        pageLoadMilliseconds({
            now: 700,
            navigation: { startTime: 0, loadEventEnd: 0 },
        }),
        null,
    );
    assert.equal(
        pageLoadMilliseconds({
            now: 1700,
            navigation: { startTime: 0, loadEventEnd: 823.6 },
        }),
        824,
    );
    assert.equal(pageLoadMilliseconds({ now: 500 }), null);
});

test('client navigation measures this route instead of reusing the first document timing', () => {
    assert.equal(
        pageLoadMilliseconds({
            now: 25000.7,
            routeStartedAt: 24680,
            navigation: { startTime: 0, loadEventEnd: 823.6 },
        }),
        321,
    );
    assert.equal(pageLoadMilliseconds({ now: 100, routeStartedAt: 100 }), 0);
    assert.equal(pageLoadMilliseconds({ now: 100, routeStartedAt: 200 }), null);
    assert.equal(
        pageLoadMilliseconds({ now: Number.NaN, routeStartedAt: 0 }),
        null,
    );
});
