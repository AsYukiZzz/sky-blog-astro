import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

function withFixture(run: (directory: string) => void) {
    const directory = mkdtempSync(join(tmpdir(), 'sky-blog hooks-'));
    try {
        cpSync(join(projectRoot, 'scripts'), join(directory, 'scripts'), {
            recursive: true,
        });
        cpSync(join(projectRoot, '.githooks'), join(directory, '.githooks'), {
            recursive: true,
        });
        run(directory);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}

function git(directory: string, args: string[]) {
    return spawnSync(
        'git',
        [
            '-c',
            'user.name=Commit Test',
            '-c',
            'user.email=commit-test@example.invalid',
            '-c',
            'commit.gpgsign=false',
            ...args,
        ],
        { cwd: directory, encoding: 'utf8' },
    );
}

function install(directory: string) {
    return spawnSync(
        process.execPath,
        [join(directory, 'scripts', 'install-git-hooks.mjs')],
        { cwd: directory, encoding: 'utf8' },
    );
}

test('installed Git hooks reject invalid commits and allow Chinese commit descriptions', () => {
    withFixture((directory) => {
        assert.equal(git(directory, ['init', '--quiet']).status, 0);
        const setup = install(directory);
        assert.equal(setup.status, 0, setup.stderr);
        assert.equal(
            git(directory, [
                'config',
                '--local',
                '--get',
                'core.hooksPath',
            ]).stdout.trim(),
            '.githooks',
        );

        const invalid = git(directory, [
            'commit',
            '--quiet',
            '--allow-empty',
            '-m',
            'fix: 修复搜索问题',
        ]);
        assert.equal(invalid.status, 1, invalid.stderr);
        assert.match(invalid.stderr, /type\(scope\): 中文说明/u);
        assert.notEqual(
            git(directory, ['rev-parse', '--verify', 'HEAD']).status,
            0,
        );

        const prefixed = git(directory, [
            'commit',
            '--quiet',
            '--allow-empty',
            '-m',
            '# 这不是合法标题\n\nfix(search): 修复搜索问题',
        ]);
        assert.equal(prefixed.status, 1, prefixed.stderr);
        assert.match(prefixed.stderr, /type\(scope\): 中文说明/u);
        assert.notEqual(
            git(directory, ['rev-parse', '--verify', 'HEAD']).status,
            0,
        );

        const valid = git(directory, [
            'commit',
            '--quiet',
            '--allow-empty',
            '-m',
            'chore(repo): 配置提交规范',
        ]);
        assert.equal(valid.status, 0, valid.stderr);
        assert.equal(
            git(directory, ['log', '-1', '--format=%s']).stdout.trim(),
            'chore(repo): 配置提交规范',
        );
    });
});

test('hook installation preserves an existing custom hooks path', () => {
    withFixture((directory) => {
        assert.equal(git(directory, ['init', '--quiet']).status, 0);
        assert.equal(
            git(directory, [
                'config',
                '--local',
                'core.hooksPath',
                'custom-hooks',
            ]).status,
            0,
        );
        const setup = install(directory);
        assert.equal(setup.status, 0, setup.stderr);
        assert.equal(
            git(directory, [
                'config',
                '--local',
                '--get',
                'core.hooksPath',
            ]).stdout.trim(),
            'custom-hooks',
        );
        assert.match(setup.stderr, /已有.*钩子/u);
    });
});

test('hook installation succeeds without Git metadata in downloaded source archives', () => {
    withFixture((directory) => {
        const setup = install(directory);
        assert.equal(setup.status, 0, setup.stderr);
        assert.match(setup.stdout, /未检测到 Git 仓库/u);
    });
});
