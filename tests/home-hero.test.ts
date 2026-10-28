import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveHeroConfig, selectHeroEntry } from '../src/lib/home-hero.ts';
import type { HomeHeroConfig } from '../src/types/config.ts';

const wallpapers = [{ id: 'forest', image: '/forest.webp' }];
function config(): HomeHeroConfig {
    return {
        size: 'full',
        default: {
            title: 'Sky',
            subtitle: 'Default story',
            position: 'bottom-left',
        },
        byWallpaper: {
            forest: { title: 'Forest', subtitle: '', position: 'top-right' },
        },
    };
}

test('wallpaper IDs select complete Hero entries and unmatched IDs use the default', () => {
    const hero = resolveHeroConfig(config(), wallpapers);
    assert.deepEqual(selectHeroEntry(hero, 'forest'), {
        title: 'Forest',
        subtitle: '',
        position: 'top-right',
    });
    assert.deepEqual(selectHeroEntry(hero, 'unmapped'), {
        title: 'Sky',
        subtitle: 'Default story',
        position: 'bottom-left',
    });
    assert.equal(selectHeroEntry(hero, null), hero.default);
    assert.equal(selectHeroEntry(hero, 'constructor'), hero.default);
});

test('Hero default is required even when every wallpaper has a mapped entry', () => {
    const value = config();
    Reflect.deleteProperty(value, 'default');
    assert.throws(
        () => resolveHeroConfig(value, wallpapers),
        /theme\.home\.hero\.default/,
    );
});

test('unknown wallpaper mappings report the misspelled configuration key', () => {
    const value = config();
    value.byWallpaper.froest = value.byWallpaper.forest;
    assert.throws(
        () => resolveHeroConfig(value, wallpapers),
        /theme\.home\.hero\.byWallpaper\.froest/,
    );
});

test('a blank title and missing subtitle are rejected at their entry paths', () => {
    const value = config();
    value.default.title = '  ';
    assert.throws(
        () => resolveHeroConfig(value, wallpapers),
        /theme\.home\.hero\.default\.title/,
    );
    value.default.title = 'Sky';
    Reflect.deleteProperty(value.byWallpaper.forest, 'subtitle');
    assert.throws(
        () => resolveHeroConfig(value, wallpapers),
        /theme\.home\.hero\.byWallpaper\.forest\.subtitle/,
    );
});

test('arbitrary positions are rejected while the seven supported positions are accepted', () => {
    const value = config();
    for (const position of [
        'top-left',
        'bottom-left',
        'top-right',
        'bottom-right',
        'top-center',
        'bottom-center',
        'center',
    ] as const) {
        value.default.position = position;
        assert.equal(
            resolveHeroConfig(value, wallpapers).default.position,
            position,
        );
    }
    const invalid = {
        ...value,
        default: { ...value.default, position: 'left' },
    };
    assert.throws(
        () => resolveHeroConfig(invalid as HomeHeroConfig, wallpapers),
        /theme\.home\.hero\.default\.position/,
    );
});

test('an own prototype-like wallpaper ID matches without reading inherited entries', () => {
    const value = config();
    value.byWallpaper = JSON.parse(
        '{"__proto__":{"title":"Own entry","subtitle":"","position":"center"}}',
    );
    const hero = resolveHeroConfig(value, [
        { id: '__proto__', image: '/own.webp' },
    ]);
    assert.deepEqual(selectHeroEntry(hero, '__proto__'), {
        title: 'Own entry',
        subtitle: '',
        position: 'center',
    });
    assert.equal(selectHeroEntry(hero, 'toString'), hero.default);
});
