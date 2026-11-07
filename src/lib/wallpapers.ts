import type {
    WallpaperAuthorConfig,
    WallpaperConfig,
} from '../types/config.ts';

function normalizeAuthor(
    author: WallpaperAuthorConfig,
    path: string,
): WallpaperAuthorConfig {
    const fail = (field: string, message: string): never => {
        throw new Error(`Invalid ${path}${field} in src/config.ts: ${message}`);
    };
    if (!author || typeof author !== 'object' || Array.isArray(author))
        fail('', '必须为作者配置对象。');
    if (typeof author.name !== 'string' || !author.name.trim())
        fail('.name', '必须为非空字符串。');
    if (
        author.links !== undefined &&
        (!author.links ||
            typeof author.links !== 'object' ||
            Array.isArray(author.links))
    )
        fail('.links', '必须为平台链接对象。');
    const normalizeUrl = (
        value: unknown,
        field: string,
    ): string | undefined => {
        if (value === undefined) return;
        if (typeof value !== 'string') return fail(field, '必须为字符串。');
        const href = value.trim();
        if (!href) return;
        // URL() alone accepts same-scheme shorthands that href can resolve locally.
        if (!/^https?:\/\//i.test(href))
            fail(field, '必须为完整的 HTTP(S) URL。');
        try {
            new URL(href);
        } catch {
            fail(field, '必须为完整的 HTTP(S) URL。');
        }
        return href;
    };
    const url = normalizeUrl(author.url, '.url');
    const links: NonNullable<WallpaperAuthorConfig['links']> = {};
    for (const platform of ['pixiv', 'weibo', 'x'] as const) {
        if (!author.links || !Object.hasOwn(author.links, platform)) continue;
        const href = normalizeUrl(author.links[platform], `.links.${platform}`);
        if (href) links[platform] = href;
    }
    return { name: author.name.trim(), ...(url ? { url } : {}), links };
}

export function normalizeWallpapers(
    wallpapers: readonly WallpaperConfig[],
): WallpaperConfig[] {
    const path = 'theme.global.background.wallpapers';
    if (!Array.isArray(wallpapers))
        throw new Error(`Invalid ${path} in src/config.ts: 必须为壁纸数组。`);
    const ids = new Set<string>();
    return wallpapers.map((wallpaper, index) => {
        for (const field of ['id', 'image'] as const) {
            if (
                typeof wallpaper?.[field] !== 'string' ||
                !wallpaper[field].trim()
            )
                throw new Error(
                    `Invalid ${path}[${index}].${field} in src/config.ts: 必须为非空字符串。`,
                );
        }
        const id = wallpaper.id.trim();
        if (ids.has(id))
            throw new Error(
                `Invalid ${path}[${index}].id in src/config.ts: 壁纸 ID 不可重复。`,
            );
        ids.add(id);
        const author =
            wallpaper.author === undefined
                ? undefined
                : normalizeAuthor(wallpaper.author, `${path}[${index}].author`);
        return {
            id,
            image: wallpaper.image.trim(),
            ...(author ? { author } : {}),
        };
    });
}

export function selectWallpaper(
    wallpapers: readonly WallpaperConfig[],
    sample: number,
): WallpaperConfig | null {
    return wallpapers[Math.floor(sample * wallpapers.length)] ?? null;
}
