import { themeState } from '../lib/theme-state';
import { browserStorage } from './browser-storage';
import { updateCommentTheme } from './comments';

export function setupThemeControls(signal: AbortSignal) {
    if (signal.aborted) return;
    const preference = matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = (name: string | null | undefined, save = true) => {
        const state = themeState(name, preference.matches);
        document.documentElement.dataset.theme = state.name;
        document.documentElement.dataset.colorScheme = state.colorScheme;
        if (save) browserStorage.set('sky-theme', state.name);
        updateCommentTheme(state.colorScheme);
    };

    applyTheme(
        browserStorage.get('sky-theme') ??
            document.documentElement.dataset.theme,
        false,
    );
    document.addEventListener(
        'click',
        (event) => {
            const target =
                event.target instanceof Element ? event.target : null;
            if (!target) return;
            if (target.closest('[data-theme-toggle]'))
                applyTheme(
                    document.documentElement.dataset.colorScheme === 'dark'
                        ? 'light'
                        : 'dark',
                );
        },
        { signal },
    );
}
