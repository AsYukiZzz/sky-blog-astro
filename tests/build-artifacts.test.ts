import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

type ManifestEntry = { path: string; title?: string; legacyPath?: string };
type Manifest = Record<string, ManifestEntry[]>;

function html(path: string, body = '') {
    return `<!doctype html><html><head><link rel="canonical" href="https://example.com${path}"></head><body>${body}</body></html>`;
}

function fixture(t: TestContext) {
    const directory = mkdtempSync(join(tmpdir(), 'sky-build-artifacts-'));
    const dist = join(directory, 'dist');
    t.after(() => {
        assert.equal(dirname(directory), resolve(tmpdir()));
        assert.ok(basename(directory).startsWith('sky-build-artifacts-'));
        rmSync(directory, { recursive: true, force: true });
    });

    function write(path: string, content: string) {
        const file = join(dist, path);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, content);
    }

    function manifest(entries: Manifest) {
        write('content-manifest.json', JSON.stringify(entries));
    }

    for (const route of [
        '',
        'archives',
        'categories',
        'tags',
        'links',
        'moments',
        'posts/target',
    ]) {
        write(join(route, 'index.html'), html(route ? `/${route}/` : '/'));
    }
    write('404.html', html('/404'));
    write(
        'feed.xml',
        '<rss version="2.0"><channel><title>Blog</title><link>https://example.com/</link><item><title>Target</title><link>https://example.com/posts/target/</link></item></channel></rss>',
    );
    write(
        'sitemap-index.xml',
        '<sitemapindex><sitemap><loc>https://example.com/sitemap-0.xml</loc></sitemap></sitemapindex>',
    );
    write(
        'sitemap-0.xml',
        '<urlset><url><loc>https://example.com/</loc></url><url><loc>https://example.com/posts/target/</loc></url></urlset>',
    );
    write('robots.txt', 'User-agent: *\nAllow: /\n');
    write('pagefind/pagefind.js', 'export const search = () => [];');
    write('_redirects', '/rss.xml /feed.xml 301\n');
    manifest({
        posts: [{ path: '/posts/target/', title: 'Target' }],
        pages: [],
        moments: [],
    });

    return {
        write,
        manifest,
        read: (path: string) => readFileSync(join(dist, path), 'utf8'),
        remove: (path: string) => rmSync(join(dist, path)),
        run: (script: 'prepare-build' | 'verify-build') => {
            const result = spawnSync(
                process.execPath,
                [
                    fileURLToPath(
                        new URL(`../scripts/${script}.mjs`, import.meta.url),
                    ),
                ],
                { cwd: directory, encoding: 'utf8' },
            );
            assert.ifError(result.error);
            return {
                status: result.status,
                output: `${result.stdout}${result.stderr}`,
            };
        },
    };
}

for (const [source, asset] of [
    ['/feed.xml', 'feed.xml'],
    ['/images/foo.svg', 'images/foo.svg'],
    ['/images/%66oo.svg', 'images/foo.svg'],
    ['/images', 'images/icons/foo.svg'],
    ['/images/', 'images/icons/foo.svg'],
    ['/%69mages/icons', 'images/icons/foo.svg'],
    ['/posts/occupied/', 'posts/occupied/index.html'],
    ['/flat', 'flat.html'],
]) {
    test(`legacy redirects cannot shadow a built artifact at ${source}`, (t) => {
        const build = fixture(t);
        build.write(asset, asset.endsWith('.html') ? html(source) : '<svg/>');
        build.manifest({
            posts: [
                { path: '/posts/target/', title: 'Target', legacyPath: source },
            ],
            pages: [],
            moments: [],
        });

        const result = build.run('prepare-build');
        assert.notEqual(result.status, 0, result.output);
        assert.match(result.output, /shadows a published (?:route|artifact)/);
        assert.equal(build.read('_redirects'), '/rss.xml /feed.xml 301\n');
    });
}

for (const source of [
    '/_redirects',
    '/_headers',
    '/_routes.json',
    '/_worker.js/function',
    '/_astro/not-created-yet.css',
    '/cdn-cgi/trace',
    '/pagefind',
    '/pagefind/not-created-yet.js',
    '/%70agefind/not-created-yet.js',
]) {
    test(`legacy redirects cannot occupy the protected namespace ${source}`, (t) => {
        const build = fixture(t);
        build.manifest({
            posts: [
                { path: '/posts/target/', title: 'Target', legacyPath: source },
            ],
            pages: [],
            moments: [],
        });

        const result = build.run('prepare-build');
        assert.notEqual(result.status, 0, result.output);
        assert.match(result.output, /protected|shadows a published/);
    });
}

for (const source of [
    '/archives/%2e%2e/outside',
    '/archives%2ftarget',
    '/%2fexample.com/path',
    '/archives/%5coutside',
    '/archives\\outside',
    '/archives/%00title',
    '/archives/%252e%252e/outside',
    '/archives/%E0%A4',
]) {
    test(`legacy redirects report an invalid path for ${source}`, (t) => {
        const build = fixture(t);
        build.manifest({
            posts: [
                { path: '/posts/target/', title: 'Target', legacyPath: source },
            ],
            pages: [],
            moments: [],
        });

        const result = build.run('prepare-build');
        assert.notEqual(result.status, 0, result.output);
        assert.match(result.output, /Invalid legacyPath for Target/);
    });
}

test('legacy redirects retain safely encoded historical paths and existing rules', (t) => {
    const build = fixture(t);
    build.manifest({
        posts: [
            {
                path: '/posts/target/',
                title: 'Target',
                legacyPath: '/archives/%E6%97%A7%E6%96%87%20title',
            },
        ],
        pages: [],
        moments: [],
    });

    const result = build.run('prepare-build');
    assert.equal(result.status, 0, result.output);
    assert.equal(
        build.read('_redirects'),
        '/rss.xml /feed.xml 301\n/archives/%E6%97%A7%E6%96%87%20title /posts/target/ 301\n',
    );
});

for (const source of ['/posts/target', '/posts/target/', '/posts/%74arget/']) {
    test(`legacy redirects skip a self route expressed as ${source}`, (t) => {
        const build = fixture(t);
        build.manifest({
            posts: [
                { path: '/posts/target/', title: 'Target', legacyPath: source },
            ],
            pages: [],
            moments: [],
        });

        const result = build.run('prepare-build');
        assert.equal(result.status, 0, result.output);
        assert.equal(build.read('_redirects'), '/rss.xml /feed.xml 301\n');
    });
}

for (const secondSource of ['/archives/%6fld', '/archives/old/']) {
    test(`legacy redirects reject an equivalent duplicate source ${secondSource}`, (t) => {
        const build = fixture(t);
        build.manifest({
            posts: [
                {
                    path: '/posts/target/',
                    title: 'Target',
                    legacyPath: '/archives/old',
                },
                {
                    path: '/posts/another/',
                    title: 'Another',
                    legacyPath: secondSource,
                },
            ],
            pages: [],
            moments: [],
        });

        const result = build.run('prepare-build');
        assert.notEqual(result.status, 0, result.output);
        assert.match(result.output, /Duplicate redirect source/);
    });
}

test('legacy redirects reject an encoded duplicate of an existing rule', (t) => {
    const build = fixture(t);
    build.write('_redirects', '/archives/old /posts/target/ 301\n');
    build.manifest({
        posts: [
            {
                path: '/posts/target/',
                title: 'Target',
                legacyPath: '/archives/%6fld',
            },
        ],
        pages: [],
        moments: [],
    });

    const result = build.run('prepare-build');
    assert.notEqual(result.status, 0, result.output);
    assert.match(result.output, /Duplicate redirect source/);
});

test('general build verification accepts a declared and linked about page', (t) => {
    const build = fixture(t);
    build.write('pages/about/index.html', html('/pages/about/'));
    build.write('index.html', html('/', '<a href="/pages/about/">About</a>'));
    build.manifest({
        posts: [{ path: '/posts/target/', title: 'Target' }],
        pages: [{ path: '/pages/about/' }],
        moments: [],
    });

    const result = build.run('verify-build');
    assert.equal(result.status, 0, result.output);
});

test('general build verification permits different homepage presentation', (t) => {
    const build = fixture(t);
    build.write(
        'index.html',
        html(
            '/',
            '<div class="post-list hero-moments-wrap"><nav aria-label="文章分页"><a href="/posts/target/">Target</a></nav></div>',
        ),
    );

    const result = build.run('verify-build');
    assert.equal(result.status, 0, result.output);
});

test('general build verification accepts additional manifest collections', (t) => {
    const build = fixture(t);
    build.write('docs/guide/index.html', html('/docs/guide/'));
    build.manifest({
        posts: [{ path: '/posts/target/', title: 'Target' }],
        pages: [],
        moments: [],
        docs: [{ path: '/docs/guide/' }],
    });

    const result = build.run('verify-build');
    assert.equal(result.status, 0, result.output);
});

for (const collection of ['posts', 'pages', 'moments', 'docs']) {
    test(`general build verification rejects a missing ${collection} manifest route`, (t) => {
        const build = fixture(t);
        build.manifest({
            posts: [{ path: '/posts/target/', title: 'Target' }],
            pages: [],
            moments: [],
            [collection]: [{ path: `/${collection}/missing/` }],
        });

        const result = build.run('verify-build');
        assert.notEqual(result.status, 0, result.output);
        assert.match(result.output, /route missing/i);
    });
}

test('general build verification follows a safely encoded manifest route', (t) => {
    const build = fixture(t);
    build.write('pages/旧文/index.html', html('/pages/%E6%97%A7%E6%96%87/'));
    build.manifest({
        posts: [{ path: '/posts/target/', title: 'Target' }],
        pages: [{ path: '/pages/%E6%97%A7%E6%96%87/' }],
        moments: [],
    });
    build.write(
        'index.html',
        html(
            '/',
            '<a href="/pages/%E6%97%A7%E6%96%87/?from=home#top">Page</a>',
        ),
    );

    const result = build.run('verify-build');
    assert.equal(result.status, 0, result.output);
});

for (const artifact of [
    'feed.xml',
    'sitemap-index.xml',
    'pagefind/pagefind.js',
]) {
    test(`general build verification still requires ${artifact}`, (t) => {
        const build = fixture(t);
        build.remove(artifact);

        const result = build.run('verify-build');
        assert.notEqual(result.status, 0, result.output);
        assert.match(result.output, /Missing build artifact/);
    });
}

test('general build verification still rejects a broken local link', (t) => {
    const build = fixture(t);
    build.write('index.html', html('/', '<a href="/missing/">Missing</a>'));

    const result = build.run('verify-build');
    assert.notEqual(result.status, 0, result.output);
    assert.match(result.output, /Broken local link \/missing\//);
});

test('general build verification still requires exactly one canonical', (t) => {
    const build = fixture(t);
    build.write(
        'index.html',
        html('/', '<link rel="canonical" href="https://example.com/">'),
    );

    const result = build.run('verify-build');
    assert.notEqual(result.status, 0, result.output);
    assert.match(result.output, /Canonical must be unique/);
});

for (const asset of [
    'pages/private/index.html',
    'feed.xml',
    'images/private.svg',
]) {
    test(`general build verification rejects non-public fixture data in ${asset}`, (t) => {
        const build = fixture(t);
        build.write(asset, 'SECRET_PRIVATE_FIXTURE');

        const result = build.run('verify-build');
        assert.notEqual(result.status, 0, result.output);
        assert.match(result.output, /Non-public content or asset leaked/);
    });
}
