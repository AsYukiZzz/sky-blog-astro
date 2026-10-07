import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import {
    initialThemeScript,
    themeColorScheme,
    themeState,
} from '../src/lib/theme-state.ts';

test('a saved dark palette wins over a light system preference', () => {
    assert.deepEqual(themeState('night', false), {
        name: 'night',
        colorScheme: 'dark',
    });
    assert.equal(themeColorScheme('abyss'), 'dark');
    assert.equal(themeColorScheme('cupcake'), 'light');
});

test('invalid persisted names fall back to a configured, enabled palette', () => {
    const config = {
        light: 'cupcake',
        dark: 'night',
        themes: ['cupcake', 'night'],
    };
    assert.deepEqual(themeState('removed-palette', true, config), {
        name: 'night',
        colorScheme: 'dark',
    });
    assert.deepEqual(themeState(null, false, config), {
        name: 'cupcake',
        colorScheme: 'light',
    });
    assert.deepEqual(
        themeState('cupcake', true, { ...config, themes: ['night'] }),
        { name: 'night', colorScheme: 'dark' },
    );
});

test('first-paint script applies the same choice even when storage is blocked', () => {
    for (const stored of ['night', 'removed-palette', null, 'blocked']) {
        const root = { dataset: {} as Record<string, string> };
        const context = {
            document: { documentElement: root },
            window: { matchMedia: () => ({ matches: true }) },
            localStorage: {
                getItem() {
                    if (stored === 'blocked')
                        throw new Error('Storage blocked');
                    return stored;
                },
            },
        };
        runInNewContext(initialThemeScript(), context);
        const expected = themeState(stored === 'blocked' ? null : stored, true);
        assert.equal(root.dataset.theme, expected.name);
        assert.equal(root.dataset.colorScheme, expected.colorScheme);
    }
});
