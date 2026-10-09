import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { themeCatalog } from '../src/config/theme-catalog.ts';
import {
    initialThemeScript,
    themeColorScheme,
    themeState,
} from '../src/lib/theme-state.ts';

test('palette schemes match the installed DaisyUI definitions', () => {
    for (const { name } of themeCatalog) {
        const css = readFileSync(
            new URL(
                `../node_modules/daisyui/theme/${name}.css`,
                import.meta.url,
            ),
            'utf8',
        );
        const expected = css.match(/color-scheme:\s*(light|dark)/)?.[1];
        assert.ok(expected, `${name} must declare its color scheme`);
        assert.equal(themeColorScheme(name), expected, `${name} color scheme`);
    }
});

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
