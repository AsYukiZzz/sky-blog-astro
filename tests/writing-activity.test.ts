import assert from 'node:assert/strict';
import test from 'node:test';
import { recentWritingActivity } from '../src/lib/writing-activity.ts';

const post = (id: string, publishedAt: string, extra = {}) => ({
    id,
    data: { slug: id, publishedAt: new Date(publishedAt), ...extra },
});

test('the inclusive 90-day window follows the site date across years and leap day', () => {
    const activity = recentWritingActivity(
        [],
        'Asia/Shanghai',
        new Date('2024-03-01T16:05:00Z'),
    );
    assert.equal(activity.startKey, '2023-12-04');
    assert.equal(activity.endKey, '2024-03-02');
    const days = activity.days.filter((day) => day.inRange);
    assert.equal(days.length, 90);
    assert.equal(days[0].key, '2023-12-04');
    assert.equal(days.at(-1)?.key, '2024-03-02');
    assert.ok(days.some((day) => day.key === '2024-02-29'));
    assert.equal(activity.days.length % 7, 0);
});

test('counts use local publication days and omit hidden, old, and scheduled posts', () => {
    const activity = recentWritingActivity(
        [
            post('first-day', '2026-07-05T16:00:00Z'),
            post('too-old', '2026-07-05T15:59:59Z'),
            post('boundary', '2026-09-30T16:30:00Z'),
            post('same-day', '2026-10-01T00:00:00Z'),
            post('latest', '2026-10-03T10:00:00Z'),
            post('scheduled-today', '2026-10-03T13:00:00Z'),
            post('draft', '2026-10-02T00:00:00Z', { draft: true }),
            post('private', '2026-09-01T00:00:00Z', { visibility: 'private' }),
            post('restricted', '2026-10-02T00:00:00Z', {
                visibility: 'restricted',
            }),
        ],
        'Asia/Shanghai',
        new Date('2026-10-03T12:00:00Z'),
    );
    assert.equal(activity.totalCount, 4);
    assert.equal(activity.activeDays, 3);
    assert.equal(
        activity.latestPublishedAt?.toISOString(),
        '2026-10-03T10:00:00.000Z',
    );
    assert.equal(
        activity.days.find((day) => day.key === '2026-07-06')?.count,
        1,
    );
    assert.equal(
        activity.days.find((day) => day.key === '2026-10-01')?.count,
        2,
    );
    assert.equal(
        activity.days.find((day) => day.key === '2026-10-03')?.count,
        1,
    );
    assert.ok(
        activity.days
            .filter((day) => !day.inRange)
            .every((day) => day.count === 0),
    );
});

test('an empty blog still has a complete calendar with zero activity', () => {
    const activity = recentWritingActivity(
        [],
        'America/Los_Angeles',
        new Date('2026-10-03T02:00:00Z'),
    );
    assert.equal(activity.days.filter((day) => day.inRange).length, 90);
    assert.equal(activity.endKey, '2026-10-02');
    assert.equal(activity.totalCount, 0);
    assert.equal(activity.activeDays, 0);
    assert.equal(activity.latestPublishedAt, undefined);
    assert.ok(activity.days.every((day) => day.count === 0));
});
