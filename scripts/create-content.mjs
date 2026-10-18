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

const configUrl = new URL('../src/config.ts', import.meta.url);

/**
 * Read the single author ID from the site configuration so generated content
 * passes the same author validation as the rest of the theme.
 */
export async function readConfiguredAuthor(url = configUrl) {
    let config;
    try {
        config = await import(url.href);
    } catch (error) {
        throw new Error(`无法读取站主配置 src/config.ts：${error.message}`);
    }
    const id = config.author?.id;
    if (typeof id !== 'string' || !id.trim()) {
        throw new Error('src/config.ts 中的 author.id 不能为空。');
    }
    return id.trim();
}

const unsafeScalarStart = /^[-?:,[\]{}#&*!|>'"%@`=]/u;
const unsafeScalarBody = /[\u0000-\u001f\u007f]|:\s|\s#|\s$|:$/u;
const reservedScalar =
    /^(?:true|false|yes|no|on|off|null|~|[+-]?\.(?:inf|nan))$/iu;
const dateScalar = /^\d{4}-\d{2}-\d{2}(?:$|[Tt\s])/u;

function quoteScalar(text) {
    // Prefer single quotes (the repository's Prettier style); fall back to
    // double quotes when the value itself contains a single quote.
    return text.includes("'") || /[\u0000-\u001f\u007f]/u.test(text)
        ? JSON.stringify(text)
        : `'${text}'`;
}

/**
 * Serialize a string as a YAML scalar. Plain values are written without
 * quotes; only values that YAML would misread are quoted.
 */
export function yamlScalar(value) {
    const text = String(value);
    if (text === '') return '';
    const numeric = Number(text);
    const quote =
        unsafeScalarStart.test(text) ||
        unsafeScalarBody.test(text) ||
        /^\s/u.test(text) ||
        reservedScalar.test(text) ||
        dateScalar.test(text) ||
        (Number.isFinite(numeric) && text.trim() !== '');
    return quote ? quoteScalar(text) : text;
}

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

async function createContent(
    args,
    { collection, label, usage, checkSlug = true, frontmatter },
) {
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
    if (checkSlug) assertSlugAvailable(base, slug, label);

    const publishedAt = new Date().toISOString();
    const metadata = await frontmatter({
        title,
        slug: checkSlug ? slug : null,
        publishedAt,
    });
    const content = `---\n${metadata}\n---\n`;
    mkdirSync(dirname(file), { recursive: true });
    // Exclusive creation also protects existing files when two commands race.
    writeFileSync(file, content, { encoding: 'utf8', flag: 'wx' });
    console.log(`已创建${label}：${file}`);
    if (!checkSlug) {
        console.log('提示：slug 留空，请在构建前手动填写。');
    }
}

export async function runNewContent(options) {
    try {
        await createContent(process.argv.slice(2), options);
    } catch (error) {
        const message =
            error.code === 'EEXIST'
                ? `${options.label}已存在，未覆盖原文件。`
                : error.message;
        console.error(`错误：${message}`);
        process.exitCode = 1;
    }
}
