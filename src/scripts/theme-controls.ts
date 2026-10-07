import { theme } from '../config/theme';
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
        document
            .querySelectorAll<HTMLElement>('[data-set-theme]')
            .forEach((button) =>
                button.setAttribute(
                    'aria-pressed',
                    String(button.dataset.setTheme === state.name),
                ),
            );
        updateCommentTheme(state.name);
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
                        ? theme.light
                        : theme.dark,
                );
            const option = target.closest<HTMLElement>('[data-set-theme]');
            const name = option?.dataset.setTheme;
            if (name && theme.themes.includes(name)) applyTheme(name);
        },
        { signal },
    );
}
