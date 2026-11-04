import assert from 'node:assert/strict';
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const base = readFileSync(join(project, 'public/_headers'), 'utf8');
const load = () => import('../scripts/cache-headers.mjs');

function fixture(t: TestContext) {
    const scratch = join(project, '.cache');
    mkdirSync(scratch, { recursive: true });
    const root = mkdtempSync(join(scratch, 'cache-headers-'));
    t.after(() => {
        assert.equal(dirname(root), resolve(scratch));
        assert.ok(root.startsWith(join(scratch, 'cache-headers-')));
        rmSync(root, { recursive: true, force: true });
    });
    const write = (file: string, text: string) => {
        const target = join(root, file);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, text);
    };
    const page = (file: string, path: string, router = true) =>
        write(
            file,
            `<!doctype html><head><link rel="canonical" href="https://example.com${path}">${router ? '<meta name="astro-view-transitions-enabled" content="true">' : ''}</head>`,
        );
    write('_headers', base);
    return {
        root,
        write,
        page,
        read: () => readFileSync(join(root, '_headers'), 'utf8'),
    };
}

test('only generated public directory HTML gets a short freshness policy', async (t) => {
    const f = fixture(t);
    f.page('index.html', '/');
    f.page('posts/公开/index.html', '/posts/%E5%85%AC%E5%BC%80/');
    f.page('404.html', '/404');
    f.page('private/index.html', '/private/', false);
    f.page('redirect/index.html', '/posts/elsewhere/');
    f.write('pagefind/pagefind.js', 'export {}');
    const { prepareCacheHeaders } = await load();
    const result = prepareCacheHeaders(f.root);
    assert.equal(result.cached, 2);
    assert.match(
        f.read(),
        /\n\/\n  ! Cache-Control\n  Cache-Control: public, max-age=60, s-maxage=60\n/,
    );
    assert.match(f.read(), /\/posts\/%E5%85%AC%E5%BC%80\//);
    assert.doesNotMatch(
        f.read(),
        /\n\/(?:404|private|redirect|posts\/elsewhere)/,
    );
    assert.ok(f.read().startsWith(base.trimEnd()));
});

test('regeneration removes withdrawn pages and does not duplicate rules', async (t) => {
    const f = fixture(t);
    f.page('index.html', '/');
    f.page('posts/old/index.html', '/posts/old/');
    const { prepareCacheHeaders } = await load();
    prepareCacheHeaders(f.root);
    const initial = f.read();
    prepareCacheHeaders(f.root);
    assert.equal(f.read(), initial);
    rmSync(join(f.root, 'posts/old/index.html'));
    prepareCacheHeaders(f.root);
    assert.doesNotMatch(f.read(), /\/posts\/old\//);
});

test('explicit route cache policy wins over automatic generation', async (t) => {
    const f = fixture(t);
    f.page('index.html', '/');
    f.page('posts/manual/index.html', '/posts/manual/');
    f.page('pages/preview/index.html', '/pages/preview/');
    f.write(
        '_headers',
        base +
            '\n/posts/manual/\n  ! Cache-Control\n  Cache-Control: no-store\n\n/pages/*\n  ! Cache-Control\n  Cache-Control: no-store\n',
    );
    const { prepareCacheHeaders } = await load();
    prepareCacheHeaders(f.root);
    assert.equal(f.read().split('/posts/manual/').length, 2);
    assert.match(f.read(), /Cache-Control: no-store/);
    assert.doesNotMatch(f.read(), /\n\/pages\/preview\//);
});

test('large sites stay within Cloudflare header limits and leave overflow on revalidation', async (t) => {
    const f = fixture(t);
    f.write('_headers', base.replace(/^\//gm, '  /'));
    f.page('index.html', '/');
    for (let n = 0; n < 110; n++)
        f.page(`posts/p${n}/index.html`, `/posts/p${n}/`);
    const { prepareCacheHeaders } = await load();
    const result = prepareCacheHeaders(f.root);
    const rules = f
        .read()
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('/'));
    assert.equal(rules.length, 100);
    assert.ok(result.skipped > 0);
    assert.ok(rules.includes('/'));
    assert.ok(f.read().includes('Cache-Control: no-cache'));
    assert.ok(
        f
            .read()
            .split('\n')
            .every((line) => line.length <= 2000),
    );
});

test('absolute custom cache rules are honored on the canonical host', async (t) => {
    const f = fixture(t);
    f.page('index.html', '/');
    f.write(
        '_headers',
        base +
            '\nhttps://example.com/\n  ! Cache-Control\n  Cache-Control: no-store\n',
    );
    const { prepareCacheHeaders } = await load();
    assert.equal(prepareCacheHeaders(f.root).cached, 0);
    assert.doesNotMatch(f.read(), /\n\/\n/);
});

test('hostless generated rules preserve cache restrictions on other hosts', async (t) => {
    const f = fixture(t);
    f.page('index.html', '/');
    f.page('posts/preview/index.html', '/posts/preview/');
    f.write(
        '_headers',
        base +
            '\nhttps://preview.example.com/posts/*\n  ! Cache-Control\n  Cache-Control: no-store\n',
    );
    const { prepareCacheHeaders } = await load();
    assert.equal(prepareCacheHeaders(f.root).cached, 1);
    assert.doesNotMatch(f.read(), /\n\/posts\/preview\//);
});

test('a custom global no-store policy is never overridden', async (t) => {
    const f = fixture(t);
    f.page('index.html', '/');
    f.write(
        '_headers',
        base.replace('Cache-Control: no-cache', 'Cache-Control: no-store'),
    );
    const { prepareCacheHeaders } = await load();
    assert.equal(prepareCacheHeaders(f.root).cached, 0);
    assert.doesNotMatch(f.read(), /max-age=60/);
});

test('indented paths and spaced header names retain manual cache policies', async (t) => {
    const f = fixture(t);
    f.page('posts/manual/index.html', '/posts/manual/');
    f.write(
        '_headers',
        base +
            '\n  /posts/manual/\n    ! Cache-Control\n    Cache-Control : no-store\n',
    );
    const { prepareCacheHeaders } = await load();
    assert.equal(prepareCacheHeaders(f.root).cached, 0);
    assert.doesNotMatch(f.read(), /max-age=60/);
});
