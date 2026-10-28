import type {
    HeroEntry,
    HomeHeroConfig,
    WallpaperConfig,
} from '../types/config.ts';
import { normalizeWallpapers } from './wallpapers.ts';

export function resolveHeroConfig(
    hero: HomeHeroConfig,
    wallpapers: readonly WallpaperConfig[],
): HomeHeroConfig {
    const path = 'theme.home.hero';
    const fail = (field: string, message: string): never => {
        throw new Error(
            `Invalid ${path}.${field} in src/config.ts: ${message}`,
        );
    };
    if (!hero || (hero.size !== 'full' && hero.size !== 'compact'))
        fail('size', '必须为 full 或 compact。');
    const positions = new Set([
        'top-left',
        'bottom-left',
        'top-right',
        'bottom-right',
        'top-center',
        'bottom-center',
        'center',
    ]);
    const entry = (value: HeroEntry, field: string): HeroEntry => {
        if (!value || typeof value !== 'object')
            fail(field, '必须配置完整 Hero 条目。');
        if (typeof value.title !== 'string' || !value.title.trim())
            fail(`${field}.title`, '必须为非空字符串。');
        if (typeof value.subtitle !== 'string')
            fail(`${field}.subtitle`, '必须为字符串，可用空字符串隐藏。');
        if (!positions.has(value.position))
            fail(`${field}.position`, '必须为七种预设位置之一。');
        return {
            title: value.title,
            subtitle: value.subtitle,
            position: value.position,
        };
    };
    const fallback = entry(hero.default, 'default');
    if (
        !hero.byWallpaper ||
        typeof hero.byWallpaper !== 'object' ||
        Array.isArray(hero.byWallpaper)
    )
        fail('byWallpaper', '必须为按壁纸 ID 关联的配置对象。');
    const ids = new Set(
        normalizeWallpapers(wallpapers).map((wallpaper) => wallpaper.id),
    );
    const mapped = new Set<string>();
    const entries = Object.entries(hero.byWallpaper).map(([key, value]) => {
        const id = key.trim();
        if (!ids.has(id)) fail(`byWallpaper.${key}`, '没有对应的壁纸 ID。');
        if (mapped.has(id)) fail(`byWallpaper.${key}`, '关联 ID 不可重复。');
        mapped.add(id);
        return [id, entry(value, `byWallpaper.${key}`)] as const;
    });
    return {
        size: hero.size,
        default: fallback,
        byWallpaper: Object.fromEntries(entries),
    };
}

export function selectHeroEntry(
    hero: HomeHeroConfig,
    wallpaperId: string | null,
): HeroEntry {
    return wallpaperId !== null && Object.hasOwn(hero.byWallpaper, wallpaperId)
        ? hero.byWallpaper[wallpaperId]
        : hero.default;
}
