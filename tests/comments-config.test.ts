import assert from 'node:assert/strict';
import test from 'node:test';
import { commentPath, resolveComments } from '../src/lib/comments.ts';
import type { CommentConfig } from '../src/types/config.ts';

function config(overrides: Partial<CommentConfig> = {}): CommentConfig {
    return {
        enabled: true,
        provider: 'twikoo',
        twikoo: {
            envId: 'https://comments.example.com/.netlify/functions/twikoo',
        },
        ...overrides,
    };
}

test('global and page switches independently hide comments', () => {
    assert.equal(resolveComments(config({ enabled: false })), null);
    assert.equal(resolveComments(config(), false), null);
    assert.equal(resolveComments(config({ twikoo: { envId: '  ' } })), null);
    assert.equal(
        resolveComments(
            config({ enabled: false, provider: 'unknown' } as never),
        ),
        null,
    );
});

test('the configured endpoint is trimmed without changing its interface path', () => {
    const source = config({
        twikoo: { envId: ' https://comments.example.com/api/?tenant=blog ' },
    });
    const original = structuredClone(source);
    assert.deepEqual(resolveComments(source), {
        provider: 'twikoo',
        envId: 'https://comments.example.com/api/?tenant=blog',
        lang: 'zh-CN',
        assetBaseUrl: 'https://cdn.jsdelivr.net/npm/twikoo@2.0.17/dist/',
    });
    assert.deepEqual(source, original);
});

test('CloudBase IDs and nonempty regions are passed through with the chosen language', () => {
    assert.deepEqual(
        resolveComments(
            config({
                twikoo: {
                    envId: ' blog-123456789 ',
                    region: ' ap-guangzhou ',
                    lang: ' en ',
                    assetBaseUrl: '/vendor/twikoo',
                },
            }),
        ),
        {
            provider: 'twikoo',
            envId: 'blog-123456789',
            region: 'ap-guangzhou',
            lang: 'en',
            assetBaseUrl: '/vendor/twikoo/',
        },
    );
});

test('blank optional values use defaults and do not pass an empty region', () => {
    const resolved = resolveComments(
        config({
            twikoo: {
                envId: 'blog-123',
                region: ' ',
                lang: ' ',
                assetBaseUrl: ' ',
            },
        }),
    );
    assert.equal(resolved?.lang, 'zh-CN');
    assert.equal(
        resolved?.assetBaseUrl,
        'https://cdn.jsdelivr.net/npm/twikoo@2.0.17/dist/',
    );
    assert.equal(resolved && 'region' in resolved, false);
});

test('unknown providers and invalid settings report their configuration paths', () => {
    assert.throws(
        () => resolveComments(config({ provider: 'unknown' } as never)),
        /comment\.provider/,
    );
    assert.throws(
        () => resolveComments(config({ enabled: 'true' } as never)),
        /comment\.enabled/,
    );
    assert.throws(
        () => resolveComments(config({ twikoo: { envId: 123 } } as never)),
        /comment\.twikoo\.envId/,
    );
    for (const assetBaseUrl of [
        'javascript:alert(1)',
        '//cdn.example.com/twikoo/',
        'data:text/javascript,',
        'https://cdn.example.com/dist/?v=1',
        '/vendor/twikoo#script',
        '/vendor/twikoo?',
        '/vendor/twikoo#',
        '/\\cdn.example.com/twikoo',
        'https:cdn.example.com/twikoo',
        'https:/cdn.example.com/twikoo',
        '/\t/cdn.example.com/twikoo',
        'https://user:pass@cdn.example.com/twikoo',
        '/vendor/..//cdn.example.com/twikoo',
        '/vendor/%2e%2e//cdn.example.com/twikoo',
    ]) {
        assert.throws(
            () =>
                resolveComments(
                    config({ twikoo: { envId: 'blog-123', assetBaseUrl } }),
                ),
            /comment\.twikoo\.assetBaseUrl/,
        );
    }
    for (const key of ['lang', 'region', 'assetBaseUrl'] as const) {
        assert.throws(
            () =>
                resolveComments(
                    config({
                        twikoo: { envId: 'blog-123', [key]: 123 },
                    } as never),
                ),
            new RegExp(`comment\\.twikoo\\.${key}`),
        );
    }
});

test('resource URLs are serialized from the validated URL rather than an ambiguous input', () => {
    const resolved = resolveComments(
        config({
            twikoo: {
                envId: 'blog-123',
                assetBaseUrl: 'HTTPS://CDN.Example.COM:443/twikoo',
            },
        }),
    );
    assert.equal(resolved?.assetBaseUrl, 'https://cdn.example.com/twikoo/');
});

test('comment paths preserve root, encoding and case while unifying trailing slashes', () => {
    for (const [input, expected] of [
        ['/', '/'],
        ['', '/'],
        ['/posts/example/', '/posts/example'],
        ['/posts/example', '/posts/example'],
        ['/posts/example///', '/posts/example'],
        ['/posts/%E4%B8%AD%E6%96%87/', '/posts/%E4%B8%AD%E6%96%87'],
        ['/posts/Example//Section/', '/posts/Example//Section'],
    ])
        assert.equal(commentPath(input), expected);
    assert.equal(
        commentPath(
            new URL('https://example.com/posts/example/?from=home#section')
                .pathname,
        ),
        '/posts/example',
    );
});
