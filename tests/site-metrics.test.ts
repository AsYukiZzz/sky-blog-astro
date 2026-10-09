import assert from 'node:assert/strict';
import test from 'node:test';
import {
    blogStats,
    contentWordCount,
    copyrightYears,
    operatingDays,
    pageLoadMilliseconds,
} from '../src/lib/site-metrics.ts';

test('content word counts combine Han characters and words without counting punctuation', () => {
    for (const [body, expected] of [
        [undefined, 0],
        ['', 0],
        [' \n🌱，。！？', 0],
        ['你好，Astro theme 2026 🌱', 5],
        ['𠮷野家 café', 4],
    ] as const) {
        assert.equal(contentWordCount(body), expected);
    }
});

test('content word counts keep visible prose while ignoring Markdown destinations and images', () => {
    const body = [
        '# 标题',
        '**你好** _世界_ [Astro 官网](https://example.com/path?q=1)',
        '![图片描述](https://example.com/image.png)',
        '- [x] 写作',
        '1. 发布',
        '[官网]: https://example.com/reference',
    ].join('\n');
    assert.equal(contentWordCount(body), 13);
});

test('content word counts exclude backtick, tilde and unfinished code fences', () => {
    const body = [
        '正文',
        '```js',
        'const hidden = "代码示例";',
        '```',
        '后记',
        '~~~html',
        '<div>隐藏文字</div>',
        '~~~~',
        '```',
        'unfinished code must not count',
    ].join('\n');
    assert.equal(contentWordCount(body), 4);
});

test('content word counts ignore MDX imports and markup but retain component prose', () => {
    const body = [
        "import Callout from '../../components/Callout.astro';",
        '<!-- 隐藏注释 -->',
        '<Callout title="属性内容" type="info">',
        '正文 Astro',
        '</Callout>',
        '<style>body { color: red; }</style>',
        '<script>console.log("隐藏脚本")</script>',
    ].join('\n');
    assert.equal(contentWordCount(body), 3);
});

test('blog stats summarize only published public posts and moments in the requested row order', () => {
    const entry = (
        id: string,
        body: string,
        extra: Record<string, unknown> = {},
    ) => ({
        id,
        body,
        data: {
            slug: id,
            publishedAt: new Date('2026-09-30T00:00:00Z'),
            categories: ['development'],
            tags: ['astro'],
            ...extra,
        },
    });
    const stats = blogStats(
        [
            entry('first', '你好 Astro'),
            entry('second', '世界', { tags: ['markdown'] }),
            entry('private', '私密内容'.repeat(100), {
                visibility: 'private',
                categories: ['private'],
                tags: ['secret'],
            }),
            entry('draft', '草稿', { draft: true }),
            entry('future', '未来文章', {
                publishedAt: new Date('2027-01-01T00:00:00Z'),
            }),
        ],
        [
            entry('moment', '随笔 Hello'),
            entry('restricted', '限制内容', { visibility: 'restricted' }),
        ],
        {
            startedAt: '2026-10-01',
            timezone: 'Asia/Shanghai',
            language: 'zh-CN',
        },
        new Date('2026-10-09T03:00:00Z'),
    );
    assert.deepEqual(
        stats.map((stat) => [stat.label, stat.count, stat.href]),
        [
            ['文章数', 2, '/archives/'],
            ['随笔数', 1, '/moments/'],
            ['分类数', 1, '/categories/'],
            ['标签数', 2, '/tags/'],
            ['运营天数', 9, undefined],
            ['累计字数', '8', undefined],
        ],
    );
});

test('blog stats show empty content and unknown uptime without invented values', () => {
    const stats = blogStats([], [], {
        startedAt: '',
        timezone: 'Asia/Shanghai',
        language: 'zh-CN',
    });
    assert.deepEqual(
        stats.map((stat) => stat.count),
        [0, 0, 0, 0, '—', '0'],
    );
});

test('taxonomy counts use the same publication cutoff as article and word totals', () => {
    const stats = blogStats(
        [
            {
                id: 'published-at-cutoff',
                body: '正文',
                data: {
                    slug: 'published-at-cutoff',
                    publishedAt: new Date('2099-01-01T00:00:00Z'),
                    categories: ['future-category'],
                    tags: ['future-tag'],
                },
            },
        ],
        [],
        { startedAt: '', timezone: 'Asia/Shanghai', language: 'zh-CN' },
        new Date('2099-01-01T01:00:00Z'),
    );
    assert.deepEqual(
        stats.map((stat) => stat.count),
        [1, 0, 1, 1, '—', '2'],
    );
});

test('large cumulative word counts stay compact while preserving the exact total in the title', () => {
    const stats = blogStats(
        [
            {
                id: 'long',
                data: { slug: 'long', publishedAt: new Date('2026-01-01') },
                body: '字'.repeat(12345),
            },
        ],
        [],
        { startedAt: '', timezone: 'Asia/Shanghai', language: 'zh-CN' },
        new Date('2026-10-09T03:00:00Z'),
    );
    assert.equal(stats.at(-1)?.count, '1.2万');
    assert.match(stats.at(-1)?.title ?? '', /12,345 字/);
});

test('operating days include the first day and advance at midnight in the site timezone', () => {
    assert.equal(
        operatingDays(
            '2026-10-01',
            'Asia/Shanghai',
            new Date('2026-10-01T04:00:00Z'),
        ),
        1,
    );
    assert.equal(
        operatingDays(
            '2026-10-01',
            'Asia/Shanghai',
            new Date('2026-10-04T15:59:59Z'),
        ),
        4,
    );
    assert.equal(
        operatingDays(
            '2026-10-01',
            'Asia/Shanghai',
            new Date('2026-10-04T16:00:00Z'),
        ),
        5,
    );
});

test('calendar day counting survives leap days, year changes and daylight saving', () => {
    assert.equal(
        operatingDays(
            '2024-02-28',
            'Asia/Shanghai',
            new Date('2024-03-01T00:00:00Z'),
        ),
        3,
    );
    assert.equal(
        operatingDays(
            '2025-12-31',
            'Asia/Shanghai',
            new Date('2026-01-01T00:00:00Z'),
        ),
        2,
    );
    assert.equal(
        operatingDays(
            '2024-03-09',
            'America/Los_Angeles',
            new Date('2024-03-11T07:00:00Z'),
        ),
        3,
    );
});

test('missing and invalid founding dates stay unknown; a future founding date counts zero days', () => {
    const now = new Date('2026-10-05T08:00:00Z');
    for (const startedAt of [
        '',
        '2026-02-30',
        '2025-02-29',
        '2026-13-01',
        '2026-1-1',
        'not a date',
    ]) {
        assert.equal(
            operatingDays(startedAt, 'Asia/Shanghai', now),
            null,
            startedAt,
        );
    }
    assert.equal(operatingDays('2026-10-06', 'Asia/Shanghai', now), 0);
    assert.equal(operatingDays('2026-10-01', 'invalid/timezone', now), null);
    assert.equal(
        operatingDays('2026-10-01', 'Asia/Shanghai', new Date('invalid')),
        null,
    );
});

test('copyright years follow the site year without repeating a single year', () => {
    assert.equal(
        copyrightYears(2026, 'Asia/Shanghai', new Date('2026-10-05T08:00:00Z')),
        '2026',
    );
    assert.equal(
        copyrightYears(2025, 'Asia/Shanghai', new Date('2025-12-31T16:00:00Z')),
        '2025–2026',
    );
});

test('initial page timing waits for a completed navigation entry', () => {
    assert.equal(
        pageLoadMilliseconds({
            now: 700,
            navigation: { startTime: 0, loadEventEnd: 0 },
        }),
        null,
    );
    assert.equal(
        pageLoadMilliseconds({
            now: 1700,
            navigation: { startTime: 0, loadEventEnd: 823.6 },
        }),
        824,
    );
    assert.equal(pageLoadMilliseconds({ now: 500 }), null);
});

test('client navigation measures this route instead of reusing the first document timing', () => {
    assert.equal(
        pageLoadMilliseconds({
            now: 25000.7,
            routeStartedAt: 24680,
            navigation: { startTime: 0, loadEventEnd: 823.6 },
        }),
        321,
    );
    assert.equal(pageLoadMilliseconds({ now: 100, routeStartedAt: 100 }), 0);
    assert.equal(pageLoadMilliseconds({ now: 100, routeStartedAt: 200 }), null);
    assert.equal(
        pageLoadMilliseconds({ now: Number.NaN, routeStartedAt: 0 }),
        null,
    );
});
