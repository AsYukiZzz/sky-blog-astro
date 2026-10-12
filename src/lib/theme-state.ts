export type ColorScheme = 'light' | 'dark';

// Keep this resolver self-contained: the same function is serialized for first paint.
export function themeState(
    name: string | null | undefined,
    prefersDark: boolean,
): { name: ColorScheme; colorScheme: ColorScheme } {
    const selected =
        name === 'light' || name === 'dark'
            ? name
            : prefersDark
              ? 'dark'
              : 'light';
    return { name: selected, colorScheme: selected };
}

export function initialThemeScript(): string {
    return `(() => {
        const resolve = ${themeState.toString()};
        let selected = null;
        try { selected = localStorage.getItem('sky-theme'); } catch {}
        const state = resolve(selected, window.matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.dataset.theme = state.name;
        document.documentElement.dataset.colorScheme = state.colorScheme;
    })();`;
}
