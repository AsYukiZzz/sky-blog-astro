import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const checker = fileURLToPath(
    new URL('../scripts/check-commit-message.mjs', import.meta.url),
);

function checkMessage(message: string) {
    const directory = mkdtempSync(join(tmpdir(), 'sky-blog-commit-message-'));
    try {
        const messagePath = join(directory, 'COMMIT_EDITMSG');
        writeFileSync(messagePath, message, 'utf8');
        return spawnSync(process.execPath, [checker, messagePath], {
            encoding: 'utf8',
        });
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}

test('commit messages accept English types and scopes with Chinese descriptions', () => {
    for (const message of [
        'feat(search): 支持中文搜索高亮',
        'fix(image-preview)：修复 SVG 预览尺寸',
        'chore(repo): 配置提交规范\n\n增加提交前的消息格式检查。',
        '\uFEFF\r\ndocs(readme): 简化使用说明\r\n\r\n# 提交模板说明\r\n',
    ]) {
        const result = checkMessage(message);
        assert.equal(result.error, undefined);
        assert.equal(result.status, 0, `${message}\n${result.stderr}`);
    }
});

test('commit messages reject missing scopes, non-English identifiers and non-Chinese descriptions', () => {
    for (const message of [
        'fix: 修复搜索问题',
        'fix(): 修复搜索问题',
        '修复(search): 修复搜索问题',
        'fix(搜索): 修复搜索问题',
        'fix(search): fix search highlighting',
        'fix(search): fix search\n\n中文说明只放在正文。',
        'fix(search): ',
        'feature(search): 支持中文搜索高亮',
        'Fix(Search): 修复搜索问题',
        'fix(search) 修复搜索问题',
        '# 只有提交模板注释\n',
        '# 这不是合法标题\n\nfix(search): 修复搜索问题',
    ]) {
        const result = checkMessage(message);
        assert.equal(result.error, undefined);
        assert.equal(result.status, 1, message);
        assert.match(result.stderr, /type\(scope\): 中文说明/u);
    }
});

test('commit-message checking fails closed when its message file cannot be read', () => {
    const result = spawnSync(
        process.execPath,
        [
            checker,
            join(tmpdir(), 'sky-blog-missing-message-file', 'COMMIT_EDITMSG'),
        ],
        { encoding: 'utf8' },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /读取提交消息/u);
});
