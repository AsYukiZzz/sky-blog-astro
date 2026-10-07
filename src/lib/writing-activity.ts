import {
    activityDays,
    dateKey,
    isPublicContent,
    type ContentEntry,
} from './content-model.ts';

export interface WritingDay {
    key: string;
    count: number;
    inRange: boolean;
    week: number;
    day: number;
}

export interface WritingActivity {
    startKey: string;
    endKey: string;
    days: WritingDay[];
    totalCount: number;
    activeDays: number;
    latestPublishedAt?: Date;
}

export function recentWritingActivity(
    entries: ContentEntry[],
    timeZone: string,
    now = new Date(),
): WritingActivity {
    const endKey = dateKey(now, timeZone);
    // Use UTC arithmetic on local calendar dates so daylight saving never changes a day.
    const start = new Date(`${endKey}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - 89);
    const startKey = start.toISOString().slice(0, 10);
    const leadingDays = start.getUTCDay();
    const calendarStart = new Date(start);
    calendarStart.setUTCDate(calendarStart.getUTCDate() - leadingDays);
    const publicEntries = entries.filter((entry) =>
        isPublicContent(entry.data, now),
    );
    const counts = activityDays(publicEntries, timeZone);
    const days = Array.from(
        { length: Math.ceil((leadingDays + 90) / 7) * 7 },
        (_, index) => {
            const date = new Date(calendarStart);
            date.setUTCDate(calendarStart.getUTCDate() + index);
            const key = date.toISOString().slice(0, 10);
            const inRange = key >= startKey && key <= endKey;
            return {
                key,
                inRange,
                count: inRange ? (counts[key] ?? 0) : 0,
                week: Math.floor(index / 7),
                day: index % 7,
            };
        },
    );
    const latestPublishedAt = publicEntries.reduce<Date | undefined>(
        (latest, entry) =>
            !latest || entry.data.publishedAt > latest
                ? entry.data.publishedAt
                : latest,
        undefined,
    );
    return {
        startKey,
        endKey,
        days,
        latestPublishedAt,
        totalCount: days.reduce((sum, day) => sum + day.count, 0),
        activeDays: days.filter((day) => day.count > 0).length,
    };
}
