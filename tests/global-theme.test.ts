import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveGlobalTheme } from '../src/lib/global-theme.ts';
import type { GlobalThemeConfig } from '../src/types/config.ts';

function globalConfig(): GlobalThemeConfig {
    return {
        font: 'serif',
        loading: { strategy: 'wallpaper', maxWait: 3000 },
        background: {
            type: 'image',
            wallpapers: [{ id: 'mist', image: '/images/mist.svg' }],
            position: 'center',
        },
        appearance: {
            glass: {
                blur: 32,
                saturation: 1.3,
                opacity: { light: 0.72, dark: 0.65 },
            },
        },
    };
}

test('image backgrounds expose normalized candidates and one shared crop alignment', () => {
    const config = globalConfig();
    config.background.wallpapers = [
        { id: ' forest ', image: '  /images/forest.svg  ' },
    ];
    config.background.position = '  center top  ';
    assert.deepEqual(resolveGlobalTheme(config).wallpapers, [
        { id: 'forest', image: '/images/forest.svg' },
    ]);
    assert.equal(resolveGlobalTheme(config).wallpaperPosition, 'center top');
});

test('solid backgrounds do not expose an image source to the renderer', () => {
    const config = globalConfig();
    config.background.type = 'solid';
    assert.deepEqual(resolveGlobalTheme(config).wallpapers, []);
});

test('an empty wallpaper list leaves only the theme background', () => {
    const config = globalConfig();
    config.background.wallpapers = [];
    assert.deepEqual(resolveGlobalTheme(config).wallpapers, []);
});

test('blank image alignment falls back to center', () => {
    const config = globalConfig();
    config.background.position = '   ';
    assert.equal(resolveGlobalTheme(config).wallpaperPosition, 'center');
});

test('glass settings preserve valid zeros and opacity boundaries', () => {
    const config = globalConfig();
    config.appearance.glass = {
        blur: 0,
        saturation: 0,
        opacity: { light: 0, dark: 1 },
    };
    assert.deepEqual(resolveGlobalTheme(config).glass, {
        blur: 0,
        saturation: 0,
        opacity: { light: 0, dark: 1 },
    });
});

for (const field of ['blur', 'saturation'] as const) {
    test(`invalid glass ${field} reports its configuration path`, () => {
        for (const value of [-1, NaN, Infinity, -Infinity]) {
            const config = globalConfig();
            config.appearance.glass[field] = value;
            assert.throws(
                () => resolveGlobalTheme(config),
                new RegExp(`theme\\.global\\.appearance\\.glass\\.${field}`),
            );
        }
    });
}

for (const scheme of ['light', 'dark'] as const) {
    test(`invalid ${scheme} glass opacity reports its configuration path`, () => {
        for (const value of [-0.01, 1.01, NaN, Infinity, -Infinity]) {
            const config = globalConfig();
            config.appearance.glass.opacity[scheme] = value;
            assert.throws(
                () => resolveGlobalTheme(config),
                new RegExp(
                    `theme\\.global\\.appearance\\.glass\\.opacity\\.${scheme}`,
                ),
            );
        }
    });
}
