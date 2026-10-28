import type { WallpaperConfig } from '../types/config.ts';

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
        return { id, image: wallpaper.image.trim() };
    });
}

export function selectWallpaper(
    wallpapers: readonly WallpaperConfig[],
    sample: number,
): WallpaperConfig | null {
    return wallpapers[Math.floor(sample * wallpapers.length)] ?? null;
}
