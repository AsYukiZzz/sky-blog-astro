import { readFileSync } from 'node:fs';

const types = new Set([
    'feat',
    'fix',
    'docs',
    'style',
    'refactor',
    'perf',
    'test',
    'build',
    'ci',
    'chore',
    'revert',
]);

function reject(reason) {
    console.error(`提交消息不符合规范：${reason}`);
    console.error('格式：type(scope): 中文说明');
    console.error('示例：fix(search): 修复中文搜索高亮');
    process.exit(1);
}

const messagePath = process.argv[2];
if (!messagePath) reject('请提供提交消息文件路径。');

let message;
try {
    message = readFileSync(messagePath, 'utf8');
} catch {
    reject('无法读取提交消息文件。');
}

const title =
    message
        .replace(/^\uFEFF/u, '')
        .split(/\r?\n/u)
        .find((line) => line.trim())
        ?.trim() ?? '';
const match =
    /^([a-z]+)\(([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\)[:：][ \t]*(\S.*)$/u.exec(
        title,
    );

if (!match || !types.has(match[1])) {
    reject(
        '类型须为 feat、fix、docs、style、refactor、perf、test、build、ci、chore 或 revert；范围须为英文小写名称。',
    );
}
if (!/\p{Script=Han}/u.test(match[3])) {
    reject('标题说明须包含中文，技术名词可以保留英文。');
}
