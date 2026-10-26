import type {
    GlobalThemeConfig,
    GlassAppearanceConfig,
} from '../types/config.ts';

export interface ResolvedGlobalTheme {
    font: GlobalThemeConfig['font'];
    wallpaper: { image: string; position: string } | null;
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

    const image = global.background.image.trim();
    return {
        font: global.font,
        wallpaper:
            global.background.type === 'image' && image
                ? {
                      image,
                      position: global.background.position.trim() || 'center',
                  }
                : null,
        glass,
    };
}
