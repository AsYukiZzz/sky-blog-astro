import {
    existsSync,
    lstatSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { parseFrontmatter } from 'astro/markdown';

function isValidSegment(part) {
    return (
        part.trim().length > 0 &&
        !part.startsWith('.') &&
        !/[. ]$/u.test(part) &&
        !/[<>:"|?*\u0000-\u001f\u007f]/u.test(part) &&
        !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part)
    );
}

function assertSlugAvailable(directory, slug, label) {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        // Match the collection glob: hidden files and directories are excluded.
        if (entry.name.startsWith('.')) continue;
        const file = join(directory, entry.name);
        if (entry.isSymbolicLink()) {
            throw new Error(`${label}目录不能包含内容链接：${file}`);
        }
        if (entry.isDirectory()) {
            assertSlugAvailable(file, slug, label);
            continue;
        }
        if (!entry.isFile() || !/\.(md|mdx)$/u.test(entry.name)) continue;

        let frontmatter;
        try {
            ({ frontmatter } = parseFrontmatter(readFileSync(file, 'utf8')));
        } catch (error) {
            throw new Error(`${file} 的元信息无法解析：${error.message}`);
        }
        if (
            typeof frontmatter.slug === 'string' &&
            frontmatter.slug.normalize('NFC') === slug
        ) {
            throw new Error(`${label} slug 已存在：${slug}（${file}）`);
        }
    }
}

function createContent(args, { collection, label, usage, fields }) {
    if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
        console.log(usage);
        return;
    }
    if (args.length !== 1 || !args[0].trim()) {
        throw new Error(`请提供一个${label}文件名。\n${usage}`);
    }

    const input = args[0].replaceAll('\\', '/');
    const parts = input.split('/');
    if (
        input.startsWith('/') ||
        input.startsWith('-') ||
        /^[a-z]:/iu.test(input) ||
        parts.some((part) => !isValidSegment(part))
    ) {
        throw new Error(
            `文件名必须是${label}目录内的有效相对路径，不能包含 ..。`,
        );
    }

    const extension = parts
        .at(-1)
        .match(/\.(md|mdx)$/iu)?.[0]
        .toLowerCase();
    if (extension) {
        parts[parts.length - 1] = parts.at(-1).slice(0, -extension.length);
    }
    const title = parts.at(-1);
    const slugParts = parts.map((part) =>
        part
            .normalize('NFC')
            .replace(/[^\p{L}\p{N}_~.-]+/gu, '-')
            .replace(/^-+|-+$/gu, ''),
    );
    if (slugParts.some((part) => !isValidSegment(part))) {
        throw new Error(
            '文件名无法生成有效 slug，请使用中文、字母或数字命名。',
        );
    }

    const base = join('src', 'content', collection);
    const stem = join(base, ...slugParts);
    const file = `${stem}${extension ?? '.md'}`;

    // Refuse directory links so a relative filename stays inside its collection.
    let directory = process.cwd();
    for (const part of [
        'src',
        'content',
        collection,
        ...slugParts.slice(0, -1),
    ]) {
        directory = join(directory, part);
        if (existsSync(directory) && lstatSync(directory).isSymbolicLink()) {
            throw new Error(`${label}目录不能包含目录链接：${directory}`);
        }
    }
    for (const suffix of ['.md', '.mdx']) {
        if (existsSync(`${stem}${suffix}`)) {
            throw new Error(`${label}已存在：${stem}${suffix}`);
        }
    }
    const slug = slugParts.join('/');
    assertSlugAvailable(base, slug, label);

    const content = `---
title: ${JSON.stringify(title)}
slug: ${JSON.stringify(slug)}
publishedAt: ${JSON.stringify(new Date().toISOString())}
description: ''
cover: ''
${Object.entries(fields)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n')}
draft: false
visibility: public
---

`;
    mkdirSync(dirname(file), { recursive: true });
    // Exclusive creation also protects existing files when two commands race.
    writeFileSync(file, content, { encoding: 'utf8', flag: 'wx' });
    console.log(`已创建${label}：${file}`);
}

export function runNewContent(options) {
    try {
        createContent(process.argv.slice(2), options);
    } catch (error) {
        const message =
            error.code === 'EEXIST'
                ? `${options.label}已存在，未覆盖原文件。`
                : error.message;
        console.error(`错误：${message}`);
        process.exitCode = 1;
    }
}
