import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { createArticleImageProcessor } from '../src/lib/article-images.ts';

const options = {
    publicDir: new URL('../public/', import.meta.url),
    pageUrl: new URL('https://example.com/posts/example/'),
};

test('public SVGs reserve original dimensions and default to native lazy decoding', async () => {
    const process = createArticleImageProcessor();
    const output = await process(
        '<p>before</p><img src="/images/dusk.svg?rev=1" alt="山"><p>after</p>',
        options,
    );
    assert.match(output, /width="960"/);
    assert.match(output, /height="560"/);
    assert.match(output, /loading="lazy"/);
    assert.match(output, /decoding="async"/);
    assert.match(output, /data-article-image-auto/);
    assert.ok(output.startsWith('<p>before</p>'));
    assert.ok(output.endsWith('<p>after</p>'));
});

test('explicit dimensions and loading/decoding policy remain authoritative', async () => {
    const process = createArticleImageProcessor({
        fetch: async () => {
            throw new Error('should not fetch');
        },
    });
    const output = await process(
        '<img src="https://images.example/photo.jpg" width="480" height="280" loading="eager" decoding="sync" fetchpriority="high">',
        options,
    );
    assert.match(
        output,
        /width="480" height="280" loading="eager" decoding="sync" fetchpriority="high"/,
    );
    assert.doesNotMatch(output, /data-article-image-auto/);
});

test('one supplied dimension keeps its size and derives the matching aspect ratio', async () => {
    const process = createArticleImageProcessor();
    const output = await process(
        '<img src="../../images/dusk.svg" width="480">',
        options,
    );
    assert.match(output, /width="480"/);
    assert.match(output, /height="280"/);
});

test('only real rendered image tags change, leaving scripts, templates and surrounding HTML intact', async () => {
    const process = createArticleImageProcessor();
    const before =
        '<script>const demo = \'<img src="/missing.svg">\';</script><template><img src="/template.svg"></template><svg viewBox="0 0 10 10"><image href="/icon.svg" /></svg>';
    assert.equal(await process(before, options), before);
});

test('data image dimensions are inferred without a network request', async () => {
    const process = createArticleImageProcessor();
    const svg = encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"/>',
    );
    const output = await process(
        `<img src="data:image/svg+xml,${svg}">`,
        options,
    );
    assert.match(output, /width="120"/);
    assert.match(output, /height="80"/);
});

test('remote metadata requests are bounded, deduplicated and preserve the original source', async () => {
    let requests = 0;
    let range: string | undefined;
    const server = createServer((request, response) => {
        requests++;
        range = request.headers.range;
        response.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        response.end(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450"/>',
        );
    });
    await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
    );
    try {
        const address = server.address();
        assert.ok(address && typeof address !== 'string');
        const src = `http://127.0.0.1:${address.port}/photo.svg?x=1&amp;y=2`;
        const process = createArticleImageProcessor();
        const output = await process(
            `<img src="${src}"><img src="${src}">`,
            options,
        );
        assert.equal(requests, 1);
        assert.match(range ?? '', /^bytes=0-/);
        assert.equal(
            (output.match(/width="800" height="450"/g) ?? []).length,
            2,
        );
        assert.equal((output.match(/photo.svg\?x=1&amp;y=2/g) ?? []).length, 2);
        assert.doesNotMatch(output, /srcset=/);
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});

test('failed, unsupported and escaped local sources stay usable without invented dimensions', async () => {
    const warnings: string[] = [];
    const process = createArticleImageProcessor({
        fetch: async () => new Response('not an image', { status: 503 }),
        onWarning: (source) => warnings.push(source),
    });
    const output = await process(
        '<img src="https://offline.example/a.jpg"><img src="/%2e%2e%2foutside.svg"><img src="blob:opaque">',
        options,
    );
    assert.doesNotMatch(output, /width=|height=/);
    assert.equal((output.match(/loading="lazy"/g) ?? []).length, 3);
    assert.equal(warnings.length, 3);
});

test('oversized metadata responses are cancelled rather than read without limit', async () => {
    let cancelled = false;
    const process = createArticleImageProcessor({
        maxBytes: 64,
        fetch: async () =>
            new Response(
                new ReadableStream({
                    pull(controller) {
                        controller.enqueue(new Uint8Array(80));
                    },
                    cancel() {
                        cancelled = true;
                    },
                }),
            ),
        onWarning: () => {},
    });
    const output = await process(
        '<img src="https://images.example/invalid.jpg">',
        options,
    );
    assert.equal(cancelled, true);
    assert.doesNotMatch(output, /width=|height=/);
});

test('a larger response still uses valid dimensions from its bounded header', async () => {
    const process = createArticleImageProcessor({
        maxBytes: 128,
        fetch: async () =>
            new Response(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">${' '.repeat(500)}</svg>`,
            ),
        onWarning: () => {},
    });
    const output = await process(
        '<img src="https://images.example/large.svg">',
        options,
    );
    assert.match(output, /width="800" height="450"/);
});
