import assert from 'node:assert/strict';
import test from 'node:test';
import { parseJsonc } from '../src/lib/jsonc.ts';

test('JSONC comments and trailing commas preserve URLs and comment-like strings', () => {
    const source = `// 友情链接
    [
        {
            "url": "https://example.com/a//b",
            /* 可省略图片 */
            "logo": "",
            "description": "/* literal */ and // literal",
            "values": [1, 2,],
        },
    ]`;
    assert.deepEqual(parseJsonc(source, 'links.jsonc'), [
        {
            url: 'https://example.com/a//b',
            logo: '',
            description: '/* literal */ and // literal',
            values: [1, 2],
        },
    ]);
});

test('malformed JSONC reports its file and line instead of returning partial data', () => {
    assert.throws(
        () => parseJsonc('[\r\n    {"name": },\r\n]', 'links.jsonc'),
        (error) => {
            assert.ok(error instanceof SyntaxError);
            assert.match(error.message, /links\.jsonc:2:\d+/);
            return true;
        },
    );
    assert.throws(
        () => parseJsonc('{"name":"Sky"} true', 'authors.jsonc'),
        /authors\.jsonc/,
    );
});

test('empty or comments-only configuration is rejected', () => {
    for (const source of ['', '// 尚未填写', '/* 尚未填写 */']) {
        assert.throws(() => parseJsonc(source, 'links.jsonc'), /links\.jsonc/);
    }
});

test('UTF-8 BOM does not prevent JSONC configuration from loading', () => {
    assert.deepEqual(
        parseJsonc('\uFEFF// 配置\n["format-example",]', 'popular-posts.jsonc'),
        ['format-example'],
    );
});
