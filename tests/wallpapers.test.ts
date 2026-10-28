import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeWallpapers, selectWallpaper } from '../src/lib/wallpapers.ts';

test('wallpaper candidates normalize sources and IDs without mutating configuration', () => {
    const input = [
        { id: ' forest ', image: ' /images/forest.svg ' },
        { id: 'sea', image: '/images/sea.webp' },
    ];
    assert.deepEqual(normalizeWallpapers(input), [
        { id: 'forest', image: '/images/forest.svg' },
        { id: 'sea', image: '/images/sea.webp' },
    ]);
    assert.equal(input[0].id, ' forest ');
});

test('random samples select the first and last wallpaper and may repeat', () => {
    const candidates = [
        { id: 'forest', image: '/forest.webp' },
        { id: 'sea', image: '/sea.webp' },
    ];
    assert.equal(selectWallpaper(candidates, 0)?.id, 'forest');
    assert.equal(selectWallpaper(candidates, 0.999)?.id, 'sea');
    assert.equal(selectWallpaper(candidates, 0.999)?.id, 'sea');
    assert.equal(selectWallpaper([], 0.4), null);
});

test('duplicate trimmed wallpaper IDs report the conflicting entry', () => {
    assert.throws(
        () =>
            normalizeWallpapers([
                { id: 'forest', image: '/one.webp' },
                { id: ' forest ', image: '/two.webp' },
            ]),
        /theme\.global\.background\.wallpapers\[1\]\.id/,
    );
});

for (const field of ['id', 'image'] as const) {
    test(`a blank wallpaper ${field} reports its configuration path`, () => {
        assert.throws(
            () =>
                normalizeWallpapers([
                    { id: 'forest', image: '/one.webp', [field]: '  ' },
                ]),
            new RegExp(
                `theme\\.global\\.background\\.wallpapers\\[0\\]\\.${field}`,
            ),
        );
    });
}
