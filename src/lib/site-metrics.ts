import {
    dateKey,
    isPublicContent,
    publicTaxonomy,
    type ContentEntry,
} from './content-model.ts';

/** Han characters count individually; other text is counted by words. */
export function contentWordCount(body: string | undefined): number {
    let fence: string | undefined;
    const prose: string[] = [];
    for (const line of (body ?? '').split(/\r?\n/)) {
        const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
        if (fence) {
            if (
                marker &&
                marker[1][0] === fence[0] &&
                marker[1].length >= fence.length &&
                marker[2].trim() === ''
            )
                fence = undefined;
            continue;
        }
        if (marker) fence = marker[1];
        else prose.push(line);
    }
    const text = prose
        .join('\n')
        .replace(/<!--[\s\S]*?(?:-->|$)/g, ' ')
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
        .replace(
            /^import\s+(?:[\s\S]*?\s+from\s+)?['"][^'"\r\n]+['"];?[ \t]*(?:\r?\n|$)/gm,
            ' ',
        )
        .replace(/^export[^\r\n]*$/gm, ' ')
        .replace(/^ {0,3}\[[^\]\r\n]+\]:[^\r\n]*$/gm, ' ')
        .replace(/!\[[^\]]*\]\([^\r\n]*?\)/g, ' ')
        .replace(/\[([^\]]+)\]\([^\r\n]*?\)/g, '$1')
        .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
        .replace(/<[^>]*>/g, ' ')
        .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s*)?/gm, ' ')
        .replace(/&(?:#\d+|#x[\da-f]+|[a-z]+);/gi, ' ');
    const han = (text.match(/\p{Script=Han}/gu) ?? []).length;
    const words = (
        text
            .replace(/\p{Script=Han}/gu, ' ')
            .match(/[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu) ?? []
    ).length;
    return han + words;
}

interface BlogStat {
    href?: string;
    count: number | string;
    label: string;
    icon: string;
    color: string;
    uptime?: true;
    title?: string;
}

/** Share the same public content totals and row order across both card layouts. */
export function blogStats(
    posts: readonly (ContentEntry & { body?: string })[],
    moments: readonly (ContentEntry & { body?: string })[],
    site: { startedAt: string; timezone: string; language: string },
    now = new Date(),
): BlogStat[] {
    const publicPosts = posts.filter((entry) =>
        isPublicContent(entry.data, now),
    );
    const publicMoments = moments.filter((entry) =>
        isPublicContent(entry.data, now),
    );
    const { categories, tags } = publicTaxonomy(publicPosts, now);
    const words = [...publicPosts, ...publicMoments].reduce(
        (total, entry) => total + contentWordCount(entry.body),
        0,
    );
    return [
        {
            href: '/archives/',
            count: publicPosts.length,
            label: '文章数',
            icon: 'document',
            color: 'primary',
        },
        {
            href: '/moments/',
            count: publicMoments.length,
            label: '随笔数',
            icon: 'message',
            color: 'info',
        },
        {
            href: '/categories/',
            count: categories.length,
            label: '分类数',
            icon: 'folder',
            color: 'secondary',
        },
        {
            href: '/tags/',
            count: tags.length,
            label: '标签数',
            icon: 'tag',
            color: 'accent',
        },
        {
            count: operatingDays(site.startedAt, site.timezone, now) ?? '—',
            label: '运营天数',
            icon: 'calendar',
            color: 'success',
            uptime: true,
            title: site.startedAt
                ? `自 ${site.startedAt} 开始运营，当天计为第 1 天`
                : '建站日期尚未设置',
        },
        {
            count: new Intl.NumberFormat(site.language, {
                notation: 'compact',
                maximumFractionDigits: 1,
            }).format(words),
            label: '累计字数',
            icon: 'book',
            color: 'warning',
            title: `已公开文章和随笔共 ${words.toLocaleString(site.language)} 字；汉字按字、其他文字按词计数，不含代码块。`,
        },
    ];
}

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
