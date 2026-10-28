import type {
    GlobalThemeConfig,
    GlassAppearanceConfig,
    WallpaperConfig,
} from '../types/config.ts';
import { normalizeWallpapers } from './wallpapers.ts';

export interface ResolvedGlobalTheme {
    font: GlobalThemeConfig['font'];
    wallpapers: WallpaperConfig[];
    wallpaperPosition: string;
    glass: GlassAppearanceConfig;
}

export function resolveGlobalTheme(
    global: GlobalThemeConfig,
): ResolvedGlobalTheme {
    const { glass } = global.appearance;
    const validate = (field: string, value: number, max = Infinity) => {
        if (!Number.isFinite(value) || value < 0 || value > max)
            throw new Error(
                `Invalid theme.global.appearance.glass.${field} in src/config.ts: 必须为${max === 1 ? ' 0 到 1 的' : '非负'}有限数值。`,
            );
    };
    validate('blur', glass.blur);
    validate('saturation', glass.saturation);
    validate('opacity.light', glass.opacity.light, 1);
    validate('opacity.dark', glass.opacity.dark, 1);

    const wallpapers = normalizeWallpapers(global.background.wallpapers);
    if (
        global.background.type !== 'image' &&
        global.background.type !== 'solid'
    )
        throw new Error(
            'Invalid theme.global.background.type in src/config.ts: 必须为 image 或 solid。',
        );
    return {
        font: global.font,
        wallpapers: global.background.type === 'image' ? wallpapers : [],
        wallpaperPosition: global.background.position.trim() || 'center',
        glass,
    };
}
