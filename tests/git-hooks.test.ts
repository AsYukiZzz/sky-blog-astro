import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    cpSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
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

function checkMessage(message: string) {
    const directory = mkdtempSync(join(tmpdir(), 'sky-blog message-'));
    try {
        const file = join(directory, 'message.txt');
        writeFileSync(file, `${message}\n`);
        return spawnSync(
            process.execPath,
            [join(projectRoot, 'scripts', 'check-commit-message.mjs'), file],
            { encoding: 'utf8' },
        );
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
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

test('dependency installation does not install Git hooks unless requested', () => {
    const manifest = JSON.parse(
        readFileSync(join(projectRoot, 'package.json'), 'utf8'),
    ) as { scripts?: Record<string, string> };
    const scripts = manifest.scripts ?? {};

    // 安装依赖只会执行这些安装期脚本，它们都不应改动 Git 钩子配置。
    for (const name of ['preinstall', 'install', 'postinstall', 'prepare']) {
        assert.doesNotMatch(
            scripts[name] ?? '',
            /install-git-hooks|check-commit-message|hooksPath/u,
            `安装期脚本 ${name} 不应安装 Git 钩子`,
        );
    }
    assert.equal(
        scripts['hooks:install'],
        'node scripts/install-git-hooks.mjs',
    );
});

test('message checker accepts merge commits and scopes that begin with digits', () => {
    for (const message of [
        'merge(main): 合并 main 分支',
        'fix(404): 修复 404 页面',
    ]) {
        const result = checkMessage(message);
        assert.equal(result.status, 0, result.stderr);
    }
});

test('message checker rejects undeclared types and raw Git merge messages', () => {
    for (const message of [
        'merged(main): 合并 main 分支',
        "Merge branch 'main' into dev",
    ]) {
        const result = checkMessage(message);
        assert.equal(result.status, 1, `应拒绝：${message}`);
    }
});
