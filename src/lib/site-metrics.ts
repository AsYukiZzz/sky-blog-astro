import { dateKey } from './content-model.ts';

export function operatingDays(
    startedAt: string,
    timeZone: string,
    now = new Date(),
): number | null {
    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(startedAt) ||
        startedAt.startsWith('0000') ||
        !Number.isFinite(now.getTime())
    )
        return null;
    const start = new Date(`${startedAt}T00:00:00Z`);
    if (
        !Number.isFinite(start.getTime()) ||
        start.toISOString().slice(0, 10) !== startedAt
    )
        return null;
    try {
        // Count local calendar days; elapsed hours would drift at daylight-saving boundaries.
        const today = new Date(`${dateKey(now, timeZone)}T00:00:00Z`);
        return Math.max(
            0,
            Math.round((today.getTime() - start.getTime()) / 86_400_000) + 1,
        );
    } catch {
        return null;
    }
}

export function copyrightYears(
    startYear: number,
    timeZone: string,
    now = new Date(),
): string {
    const currentYear = Number(dateKey(now, timeZone).slice(0, 4));
    return currentYear > startYear
        ? `${startYear}–${currentYear}`
        : String(startYear);
}

export interface PageLoadTiming {
    now: number;
    routeStartedAt?: number;
    navigation?: { startTime: number; loadEventEnd: number };
}

export function pageLoadMilliseconds(timing: PageLoadTiming): number | null {
    const { now, routeStartedAt, navigation } = timing;
    if (!Number.isFinite(now)) return null;
    if (
        routeStartedAt === undefined &&
        (!navigation || navigation.loadEventEnd <= 0)
    )
        return null;
    const elapsed =
        routeStartedAt === undefined
            ? navigation!.loadEventEnd - navigation!.startTime
            : now - routeStartedAt;
    return Number.isFinite(elapsed) && elapsed >= 0
        ? Math.round(elapsed)
        : null;
}
