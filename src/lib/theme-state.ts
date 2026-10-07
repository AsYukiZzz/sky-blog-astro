import { theme, type ThemeConfig } from '../config/theme.ts';
import { themeCatalog, type ColorScheme } from '../config/theme-catalog.ts';

type PaletteOptions = Pick<ThemeConfig, 'light' | 'dark' | 'themes'>;
const paletteSchemes: Record<string, ColorScheme> = Object.fromEntries(
    themeCatalog.map(({ name, colorScheme }) => [name, colorScheme]),
);

// Keep this resolver self-contained: the same function is serialized for first paint.
function resolveThemePreference(
    name: string | null | undefined,
    prefersDark: boolean,
    config: PaletteOptions,
    schemes: Record<string, ColorScheme>,
): { name: string; colorScheme: ColorScheme } {
    if (!config.themes.length)
        throw new Error('Enable at least one theme palette');
    const fallback = prefersDark ? config.dark : config.light;
    const selected =
        name && config.themes.includes(name)
            ? name
            : config.themes.includes(fallback)
              ? fallback
              : config.themes[0];
    return {
        name: selected,
        colorScheme:
            schemes[selected] ?? (selected === config.dark ? 'dark' : 'light'),
    };
}

export function themeColorScheme(name: string): ColorScheme {
    return paletteSchemes[name] ?? (name === theme.dark ? 'dark' : 'light');
}

export function themeState(
    name: string | null | undefined,
    prefersDark: boolean,
    config: PaletteOptions = theme,
) {
    return resolveThemePreference(name, prefersDark, config, paletteSchemes);
}

export function initialThemeScript(config: PaletteOptions = theme): string {
    const serialize = (value: unknown) =>
        JSON.stringify(value).replaceAll('<', '\\u003c');
    const options = {
        light: config.light,
        dark: config.dark,
        themes: config.themes,
    };
    return `(() => {
        const resolve = ${resolveThemePreference.toString()};
        let selected = null;
        try { selected = localStorage.getItem('sky-theme'); } catch {}
        const state = resolve(selected, window.matchMedia('(prefers-color-scheme: dark)').matches, ${serialize(options)}, ${serialize(paletteSchemes)});
        document.documentElement.dataset.theme = state.name;
        document.documentElement.dataset.colorScheme = state.colorScheme;
    })();`;
}
