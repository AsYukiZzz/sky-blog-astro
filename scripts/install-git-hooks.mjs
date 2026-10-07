import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
if (!existsSync(join(root, '.git'))) {
    console.log('未检测到 Git 仓库，跳过提交钩子安装。');
    process.exit(0);
}

const options = { cwd: root, encoding: 'utf8' };
const existing = spawnSync(
    'git',
    ['config', '--get', 'core.hooksPath'],
    options,
);
if (existing.error || (existing.status !== 0 && existing.status !== 1)) {
    console.error('无法读取 Git 钩子配置，请确认 Git 可用且当前仓库受信任。');
    process.exit(1);
}
const hooksPath = existing.stdout.trim();
if (hooksPath && hooksPath !== '.githooks') {
    console.warn(`检测到已有 Git 钩子路径 ${hooksPath}，已保留原配置。`);
    console.warn('请将提交消息检查器整合到现有 commit-msg 钩子。');
    process.exit(0);
}

try {
    chmodSync(join(root, '.githooks', 'commit-msg'), 0o755);
} catch {
    console.error('无法设置 commit-msg 钩子的执行权限。');
    process.exit(1);
}
const installed = spawnSync(
    'git',
    ['config', '--local', 'core.hooksPath', '.githooks'],
    options,
);
if (installed.error || installed.status !== 0) {
    console.error('无法启用 Git 提交钩子，请检查仓库配置的写入权限。');
    process.exit(1);
}
console.log('已启用提交消息检查：type(scope): 中文说明。');
