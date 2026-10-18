import assert from 'node:assert/strict';
import test from 'node:test';
import {
    copyrightNote,
    copyrightSummary,
    DEFAULT_COPYRIGHT,
} from '../src/lib/copyright.ts';

test('copyright notes follow the configured type and let note override the default', () => {
    assert.equal(
        copyrightNote(undefined),
        `本文采用 ${DEFAULT_COPYRIGHT.license} 协议，转载时请注明作者和出处。`,
    );
    assert.equal(
        copyrightNote({ ...DEFAULT_COPYRIGHT, note: '自定义声明' }),
        '自定义声明',
    );
    assert.equal(
        copyrightNote({ ...DEFAULT_COPYRIGHT, type: 'repost' }),
        '本文转载自原始作品，版权归原作者所有。',
    );
    assert.equal(
        copyrightNote({
            ...DEFAULT_COPYRIGHT,
            type: 'repost',
            note: '来源说明',
        }),
        '来源说明',
    );
    assert.match(
        copyrightNote({ ...DEFAULT_COPYRIGHT, type: 'ai' }),
        /AI 辅助/u,
    );
    assert.match(
        copyrightNote({ ...DEFAULT_COPYRIGHT, type: 'derivative' }),
        /二次创作/u,
    );
    assert.equal(
        copyrightNote({
            ...DEFAULT_COPYRIGHT,
            type: 'custom',
            note: '声明',
        }),
        '声明',
    );
});

test('copyright summaries stay compact for moments', () => {
    assert.equal(
        copyrightSummary(undefined),
        `原创 · ${DEFAULT_COPYRIGHT.license}`,
    );
    assert.equal(
        copyrightSummary({ ...DEFAULT_COPYRIGHT, type: 'repost' }),
        '转载 · 版权归原作者所有',
    );
    assert.equal(
        copyrightSummary({
            ...DEFAULT_COPYRIGHT,
            type: 'custom',
            note: '声明',
        }),
        '创作声明 · 声明',
    );
});
