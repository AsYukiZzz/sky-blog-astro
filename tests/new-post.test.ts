import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const script = fileURLToPath(
    new URL('../scripts/new-post.mjs', import.meta.url),
);
const astroRequire = createRequire(import.meta.resolve('astro/package.json'));
const { parseFrontmatter } = await import(
    pathToFileURL(astroRequire.resolve('@astrojs/internal-helpers/frontmatter'))
        .href
);
const { author } = await import('../src/config.ts');

function fixture(t: TestContext) {
    const directory = mkdtempSync(join(tmpdir(), 'sky-new-post-'));
    t.after(() => {
        assert.equal(dirname(directory), resolve(tmpdir()));
        assert.ok(basename(directory).startsWith('sky-new-post-'));
        rmSync(directory, { recursive: true, force: true });
    });
    return {
        directory,
        posts: join(directory, 'src/content/posts'),
        run(...args: string[]) {
            return spawnSync(process.execPath, [script, ...args], {
                cwd: directory,
                encoding: 'utf8',
            });
        },
    };
}

test('new-post creates Markdown with the expected metadata template and the current publication time', (t) => {
    const post = fixture(t);
    const before = Date.now();
    const result = post.run('first-post');
    const after = Date.now();

    assert.equal(result.status, 0, result.stderr);
    const raw = readFileSync(join(post.posts, 'first-post.md'), 'utf8');
    const { frontmatter } = parseFrontmatter(raw);
    assert.deepEqual(Object.keys(frontmatter), [
        'title',
        'slug',
        'description',
        'publishedAt',
        'updatedAt',
        'cover',
        'author',
        'categories',
        'tags',
        'pinned',
        'draft',
        'visibility',
    ]);
    const { publishedAt, updatedAt, ...metadata } = frontmatter;
    assert.deepEqual(metadata, {
        title: 'first-post',
        slug: null,
        description: null,
        cover: null,
        author: author.id,
        categories: [],
        tags: [],
        pinned: false,
        draft: false,
        visibility: 'public',
    });
    const published = new Date(publishedAt).getTime();
    assert.ok(published >= before && published <= after);
    assert.equal(new Date(updatedAt).getTime(), published);
    assert.match(raw, /^title: first-post$/mu);
    assert.match(raw, /^slug:$/mu);
    assert.match(raw, /^description:$/mu);
    assert.match(raw, /^cover:$/mu);
    assert.match(raw, new RegExp(`^author: ${author.id}$`, 'mu'));
    assert.match(raw, /^publishedAt: \d{4}-\d{2}-\d{2}T[\d:.]+Z$/mu);
    assert.doesNotMatch(raw, /['"]/u);
    // The schema requires the author to fill this blank before building.
    assert.match(result.stdout, /slug 留空/u);
    assert.match(
        result.stdout,
        /src[\\/]content[\\/]posts[\\/]first-post\.md/u,
    );
});

test('new-post only quotes titles that YAML would otherwise misread', (t) => {
    const post = fixture(t);
    let result = post.run("writer's # notes");
    assert.equal(result.status, 0, result.stderr);
    let raw = readFileSync(join(post.posts, 'writer-s-notes.md'), 'utf8');
    assert.match(raw, /^title: "writer's # notes"$/mu);
    assert.match(raw, /^slug:$/mu);

    result = post.run('2026-10-17');
    assert.equal(result.status, 0, result.stderr);
    raw = readFileSync(join(post.posts, '2026-10-17.md'), 'utf8');
    assert.match(raw, /^title: '2026-10-17'$/mu);
});

test('YAML scalars preserve special floating-point strings in author metadata', async () => {
    const { yamlScalar } = await import('../scripts/create-content.mjs');
    for (const author of [
        '.inf',
        '.Inf',
        '.INF',
        '+.inf',
        '-.inf',
        '.nan',
        '.NaN',
        '.NAN',
    ]) {
        const { frontmatter } = parseFrontmatter(
            `---\nauthor: ${yamlScalar(author)}\n---\n`,
        );
        assert.equal(frontmatter.author, author);
    }
});

test('new-post reads the author from src/config.ts', async (t) => {
    const { readConfiguredAuthor } =
        await import('../scripts/create-content.mjs');
    const directory = mkdtempSync(join(tmpdir(), 'sky-new-post-config-'));
    t.after(() => {
        assert.ok(basename(directory).startsWith('sky-new-post-config-'));
        rmSync(directory, { recursive: true, force: true });
    });
    const config = join(directory, 'config.ts');
    writeFileSync(config, "export const author = { id: 'SaturnHalo' };\n");
    assert.equal(
        await readConfiguredAuthor(pathToFileURL(config)),
        'SaturnHalo',
    );

    const blank = join(directory, 'blank-config.ts');
    writeFileSync(blank, "export const author = { id: '   ' };\n");
    await assert.rejects(
        readConfiguredAuthor(pathToFileURL(blank)),
        /author\.id/u,
    );
});

for (const [input, file, title] of [
    ['notes/first-post.md', 'notes/first-post.md', 'first-post'],
    ['notes/first-post.mdx', 'notes/first-post.mdx', 'first-post'],
    ['notes/first-post.MDX', 'notes/first-post.mdx', 'first-post'],
    ['notes\\first-post', 'notes/first-post.md', 'first-post'],
    ['随笔/我的文章', '随笔/我的文章.md', '我的文章'],
    ["writer's # notes", 'writer-s-notes.md', "writer's # notes"],
    ['true', 'true.md', 'true'],
    ['2026-10-17', '2026-10-17.md', '2026-10-17'],
] as const) {
    test(`new-post handles the filename ${input} without corrupting its YAML`, (t) => {
        const post = fixture(t);
        const result = post.run(input);
        assert.equal(result.status, 0, result.stderr);
        const { frontmatter } = parseFrontmatter(
            readFileSync(join(post.posts, file), 'utf8'),
        );
        assert.equal(frontmatter.title, title);
        assert.equal(frontmatter.slug, null);
    });
}

test('new-post refuses to overwrite an existing article', (t) => {
    const post = fixture(t);
    mkdirSync(post.posts, { recursive: true });
    const file = join(post.posts, 'first-post.md');
    writeFileSync(file, 'Existing article\n');

    const result = post.run('first-post');
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /已存在/u);
    assert.equal(readFileSync(file, 'utf8'), 'Existing article\n');
});

test('new-post refuses the other Markdown extension for the same article slug', (t) => {
    const post = fixture(t);
    assert.equal(post.run('first-post.mdx').status, 0);
    const result = post.run('first-post.md');
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /已存在/u);
    assert.equal(existsSync(join(post.posts, 'first-post.md')), false);
});

for (const [first, second] of [
    ['hello world', 'hello-world'],
    ['note book/hello world', 'note-book/hello-world.mdx'],
    ['café', 'cafe\u0301'],
] as const) {
    test(`new-post rejects filenames that normalize to the same file as ${first}`, (t) => {
        const post = fixture(t);
        assert.equal(post.run(first).status, 0);
        const result = post.run(second);
        assert.equal(result.status, 1, result.stderr);
        assert.match(result.stderr, /已存在/u);
    });
}

test('new-post reports missing or extra arguments without creating content', (t) => {
    const post = fixture(t);
    for (const args of [[], ['first-post', 'second-post']]) {
        const result = post.run(...args);
        assert.equal(result.status, 1, result.stderr);
        assert.match(result.stderr, /pnpm new-post/u);
        assert.equal(existsSync(post.posts), false);
    }
});

test('new-post help succeeds without creating content', (t) => {
    const post = fixture(t);
    const result = post.run('--help');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /pnpm new-post/u);
    assert.equal(existsSync(post.posts), false);
});

test('new-post rejects paths that escape the posts directory and invalid filenames before writing', (t) => {
    const post = fixture(t);
    for (const name of [
        '../outside',
        '..\\outside',
        'notes/../../outside',
        join(post.directory, 'outside.md'),
        'C:\\outside.md',
        'C:outside.md',
        '/outside.md',
        'notes/',
        '   ',
        'notes/..',
        'notes/invalid:name',
        'CON',
        'notes/...',
        'notes/.hidden',
        'notes/CON#',
        'notes/-.hidden',
        'notes/...-',
        '--unknown',
    ]) {
        const result = post.run(name);
        assert.equal(result.status, 1, `${name}: ${result.stderr}`);
        assert.match(result.stderr, /错误/u);
        assert.equal(existsSync(post.posts), false, name);
        assert.equal(
            existsSync(join(post.directory, 'outside.md')),
            false,
            name,
        );
    }
});

test('new-post refuses to write through a directory link outside the content tree', (t) => {
    const post = fixture(t);
    const outside = join(post.directory, 'outside');
    mkdirSync(outside);
    mkdirSync(post.posts, { recursive: true });
    try {
        symlinkSync(outside, join(post.posts, 'linked'), 'junction');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EPERM') {
            t.skip('This environment does not permit creating directory links');
            return;
        }
        throw error;
    }

    const result = post.run('linked/first-post');
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /链接/u);
    assert.equal(existsSync(join(outside, 'first-post.md')), false);
});
