export interface ContentMeta {
    slug: string;
    publishedAt: Date;
    draft?: boolean;
    visibility?: string;
    pinned?: boolean;
    author?: string;
    categories?: string[];
    tags?: string[];
    __publication?: {
        isPublic: boolean;
        cutoff: string;
    };
}
export interface ContentEntry {
    id: string;
    data: ContentMeta;
}

export function isPublicContent(
    data: Pick<
        ContentMeta,
        'publishedAt' | 'draft' | 'visibility' | '__publication'
    >,
    now = new Date(),
): boolean {
    // Loader decisions travel with the data across Vite and build contexts.
    if (data.__publication) return data.__publication.isPublic;
    return (
        !data.draft &&
        (data.visibility ?? 'public') === 'public' &&
        Number.isFinite(data.publishedAt.getTime()) &&
        data.publishedAt <= now
    );
}

export function sortPosts<T extends ContentEntry>(entries: T[]): T[] {
    return [...entries].sort(
        (a, b) =>
            Number(Boolean(b.data.pinned)) - Number(Boolean(a.data.pinned)) ||
            b.data.publishedAt.getTime() - a.data.publishedAt.getTime() ||
            a.id.localeCompare(b.id),
    );
}

export function routeFor(collection: string, slug: string): string {
    const parts = slug.normalize('NFC').split('/');
    if (
        !/^[a-z][a-z0-9-]*$/.test(collection) ||
        parts.some(
            (part) =>
                !/^[\p{L}\p{N}_~.-]+$/u.test(part) ||
                part === '.' ||
                part === '..',
        )
    ) {
        throw new Error(`Invalid slug: ${slug}`);
    }
    return `/${collection}/${parts.map(encodeURIComponent).join('/')}/`;
}

export function paginateItems<T>(entries: T[], pageSize: number): T[][] {
    if (!Number.isInteger(pageSize) || pageSize < 1)
        throw new Error('pageSize must be a positive integer');
    if (!entries.length) return [[]];
    return Array.from(
        { length: Math.ceil(entries.length / pageSize) },
        (_, index) => entries.slice(index * pageSize, (index + 1) * pageSize),
    );
}

export function dateKey(date: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const value = (type: string) =>
        parts.find((part) => part.type === type)?.value;
    return `${value('year')}-${value('month')}-${value('day')}`;
}

export function archiveGroups<T extends ContentEntry>(
    entries: T[],
    timeZone: string,
): { key: string; entries: T[] }[] {
    const groups = new Map<string, T[]>();
    for (const entry of [...entries].sort(
        (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
    )) {
        const key = dateKey(entry.data.publishedAt, timeZone).slice(0, 7);
        groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    return [...groups].map(([key, groupedEntries]) => ({
        key,
        entries: groupedEntries,
    }));
}

export function validateCollection(
    entries: ContentEntry[],
    collection: string,
    authors: string[],
): void {
    const urls = new Set<string>();
    for (const entry of entries) {
        const path = routeFor(collection, entry.data.slug);
        if (urls.has(path))
            throw new Error(`duplicate slug: ${entry.data.slug}`);
        urls.add(path);
        if (
            entry.data.author !== undefined &&
            (!entry.data.author.trim() || !authors.includes(entry.data.author))
        )
            throw new Error(`${entry.id}: unknown author ${entry.data.author}`);
    }
}

export function validateContent(
    entries: ContentEntry[],
    refs: { authors: string[] },
): void {
    validateCollection(entries, 'posts', refs.authors);
    for (const entry of entries) {
        for (const category of entry.data.categories ?? [])
            routeFor('categories', category);
        for (const tag of entry.data.tags ?? []) routeFor('tags', tag);
    }
}

export function publicTaxonomy(
    entries: ContentEntry[],
    now = new Date(),
): { categories: string[]; tags: string[] } {
    const posts = entries.filter((entry) => isPublicContent(entry.data, now));
    const categories = new Set(
        posts.flatMap((entry) => entry.data.categories ?? []),
    );
    const tags = new Set(posts.flatMap((entry) => entry.data.tags ?? []));
    return {
        categories: [...categories],
        tags: [...tags],
    };
}

export function activityDays(
    entries: ContentEntry[],
    timeZone: string,
): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const entry of entries) {
        const key = dateKey(entry.data.publishedAt, timeZone);
        counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
}
