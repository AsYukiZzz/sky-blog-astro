import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeWallpapers } from '../src/lib/wallpapers.ts';
import type { WallpaperConfig } from '../src/types/config.ts';

test('author names and configured platform links are trimmed without mutating configuration', () => {
    const author = {
        name: '  画师 <b> & 山间  ',
        links: {
            x: ' https://x.com/artist ',
            weibo: 'https://weibo.com/artist',
            pixiv: 'https://www.pixiv.net/users/123',
        },
    };
    assert.deepEqual(
        normalizeWallpapers([{ id: 'forest', image: '/forest.svg', author }]),
        [
            {
                id: 'forest',
                image: '/forest.svg',
                author: {
                    name: '画师 <b> & 山间',
                    links: {
                        pixiv: 'https://www.pixiv.net/users/123',
                        weibo: 'https://weibo.com/artist',
                        x: 'https://x.com/artist',
                    },
                },
            },
        ],
    );
    assert.equal(author.name, '  画师 <b> & 山间  ');
    assert.equal(author.links.x, ' https://x.com/artist ');
});

test('an author can have a name without source links', () => {
    for (const author of [
        { name: '山间' },
        { name: '山间', links: { pixiv: '', x: ' ' } },
    ]) {
        assert.deepEqual(
            normalizeWallpapers([
                { id: 'forest', image: '/forest.svg', author },
            ])[0].author,
            { name: '山间', links: {} },
        );
    }
});

test('publication URLs belong to the author and are trimmed without mutating configuration', () => {
    const author = {
        name: 'Artist',
        url: ' https://www.pixiv.net/artworks/456?lang=zh&mode=full ',
    };
    assert.deepEqual(
        normalizeWallpapers([{ id: 'forest', image: '/forest.svg', author }])[0]
            .author,
        {
            name: 'Artist',
            url: 'https://www.pixiv.net/artworks/456?lang=zh&mode=full',
            links: {},
        },
    );
    assert.equal(
        author.url,
        ' https://www.pixiv.net/artworks/456?lang=zh&mode=full ',
    );
});

test('omitted and blank publication URLs leave no publication entry', () => {
    for (const url of [undefined, '', '   ']) {
        const author = normalizeWallpapers([
            {
                id: 'forest',
                image: '/forest.svg',
                author: { name: 'Artist', url },
            },
        ])[0].author;
        assert.deepEqual(author, { name: 'Artist', links: {} });
    }
});

test('invalid publication URLs identify author.url and cannot become executable or local links', () => {
    for (const url of [
        null,
        false,
        42,
        [],
        'javascript:alert(1)',
        'data:text/html,hello',
        '/artwork',
        '//example.com/artwork',
        'ftp://example.com/artwork',
        'https:example.com/artwork',
        'https:/example.com/artwork',
        'https://',
    ]) {
        const input = [
            {
                id: 'forest',
                image: '/forest.svg',
                author: { name: 'Artist', url },
            },
        ] as unknown as WallpaperConfig[];
        assert.throws(
            () => normalizeWallpapers(input),
            /theme\.global\.background\.wallpapers\[0\]\.author\.url/,
        );
    }
});

test('invalid author values identify their wallpaper field', () => {
    for (const [author, path] of [
        [null, 'author'],
        [[], 'author'],
        [{ name: '' }, 'author.name'],
        [{ name: 7 }, 'author.name'],
        [{ name: 'Artist', links: null }, 'author.links'],
        [{ name: 'Artist', links: [] }, 'author.links'],
        [{ name: 'Artist', links: { x: false } }, 'author.links.x'],
    ] as const) {
        const input = [
            { id: 'forest', image: '/forest.svg', author },
        ] as unknown as WallpaperConfig[];
        assert.throws(
            () => normalizeWallpapers(input),
            new RegExp(
                `theme\\.global\\.background\\.wallpapers\\[0\\]\\.${path.replaceAll('.', '\\.')}`,
            ),
        );
    }
});

test('platform URLs must include an HTTP(S) authority and cannot be executable or relative', () => {
    for (const href of [
        'javascript:alert(1)',
        'data:text/html,hello',
        '/artist',
        '//x.com/artist',
        'ftp://x.com/artist',
        'https:x.com/artist',
        'https:/x.com/artist',
        'http:x.com/artist',
        'https://',
    ]) {
        assert.throws(
            () =>
                normalizeWallpapers([
                    {
                        id: 'forest',
                        image: '/forest.svg',
                        author: { name: 'Artist', links: { x: href } },
                    },
                ]),
            /theme\.global\.background\.wallpapers\[0\]\.author\.links\.x/,
        );
    }
});

test('complete HTTP and HTTPS links remain usable independently of the blog scheme', () => {
    for (const href of [
        'https://x.com/artist',
        'http://x.com/artist',
        'HTTPS://X.COM/artist',
    ]) {
        const wallpaper = normalizeWallpapers([
            {
                id: 'forest',
                image: '/forest.svg',
                author: { name: 'Artist', links: { x: href } },
            },
        ])[0];
        const link = wallpaper.author?.links?.x;
        assert.equal(link, href);
        assert.equal(new URL(link!, 'https://blog.example/').hostname, 'x.com');
    }
});

test('platform links are selected from own properties, including prototype-like wallpaper IDs', () => {
    const links = Object.assign(
        Object.create({ pixiv: 'https://www.pixiv.net/users/123' }),
        { x: 'https://x.com/artist' },
    );
    assert.deepEqual(
        normalizeWallpapers([
            {
                id: '__proto__',
                image: '/forest.svg',
                author: { name: 'Artist', links },
            },
        ])[0].author,
        { name: 'Artist', links: { x: 'https://x.com/artist' } },
    );
});
