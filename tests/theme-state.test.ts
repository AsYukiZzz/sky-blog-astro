import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { initialThemeScript, themeState } from '../src/lib/theme-state.ts';

test('saved light and dark themes override the system preference', () => {
    assert.deepEqual(themeState('dark', false), {
        name: 'dark',
        colorScheme: 'dark',
    });
    assert.deepEqual(themeState('light', true), {
        name: 'light',
        colorScheme: 'light',
    });
});

test('removed themes and missing preferences fall back to the system scheme', () => {
    for (const stored of [
        'night',
        'cupcake',
        'removed-palette',
        '',
        null,
        undefined,
    ]) {
        assert.deepEqual(themeState(stored, true), {
            name: 'dark',
            colorScheme: 'dark',
        });
        assert.deepEqual(themeState(stored, false), {
            name: 'light',
            colorScheme: 'light',
        });
    }
});

test('first paint uses only light or dark even when storage is blocked', () => {
    for (const [stored, prefersDark, expected] of [
        ['dark', false, 'dark'],
        ['light', true, 'light'],
        ['night', false, 'light'],
        ['cupcake', true, 'dark'],
        ['removed-palette', true, 'dark'],
        [null, false, 'light'],
        ['blocked', true, 'dark'],
    ] as const) {
        const root = { dataset: {} as Record<string, string> };
        runInNewContext(initialThemeScript(), {
            document: { documentElement: root },
            window: { matchMedia: () => ({ matches: prefersDark }) },
            localStorage: {
                getItem() {
                    if (stored === 'blocked')
                        throw new Error('Storage blocked');
                    return stored;
                },
            },
        });
        assert.equal(root.dataset.theme, expected);
        assert.equal(root.dataset.colorScheme, expected);
    }
});
