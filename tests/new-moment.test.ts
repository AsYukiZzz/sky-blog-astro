import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const script = fileURLToPath(
    new URL('../scripts/new-moment.mjs', import.meta.url),
);
const postScript = fileURLToPath(
    new URL('../scripts/new-post.mjs', import.meta.url),
);
const astroRequire = createRequire(import.meta.resolve('astro/package.json'));
const { parseFrontmatter } = await import(
    pathToFileURL(astroRequire.resolve('@astrojs/internal-helpers/frontmatter'))
        .href
);

function fixture(t: TestContext) {
    const directory = mkdtempSync(join(tmpdir(), 'sky-new-moment-'));
    t.after(() => {
        assert.equal(dirname(directory), resolve(tmpdir()));
        assert.ok(basename(directory).startsWith('sky-new-moment-'));
        rmSync(directory, { recursive: true, force: true });
    });
    return {
        directory,
        moments: join(directory, 'src/content/moments'),
        posts: join(directory, 'src/content/posts'),
        run(...args: string[]) {
            return spawnSync(process.execPath, [script, ...args], {
                cwd: directory,
                encoding: 'utf8',
            });
        },
    };
}

test('new-moment creates Markdown with moment metadata and the current publication time', (t) => {
    const moment = fixture(t);
    const before = Date.now();
    const result = moment.run('first-moment');
    const after = Date.now();

    assert.equal(result.status, 0, result.stderr);
    const { frontmatter } = parseFrontmatter(
        readFileSync(join(moment.moments, 'first-moment.md'), 'utf8'),
    );
    const { publishedAt, ...metadata } = frontmatter;
    assert.deepEqual(metadata, {
        title: 'first-moment',
        slug: 'first-moment',
        description: '',
        cover: '',
        tags: [],
        images: [],
        draft: false,
        visibility: 'public',
    });
    const published = new Date(publishedAt).getTime();
    assert.ok(published >= before && published <= after);
    assert.match(result.stdout, /随笔/u);
    assert.equal(existsSync(moment.posts), false);
});

test('new-moment creates nested MDX with Chinese names and preserves the title', (t) => {
    const moment = fixture(t);
    const result = moment.run('日常/今天的一点 记录.MDX');
    assert.equal(result.status, 0, result.stderr);
    const { frontmatter } = parseFrontmatter(
        readFileSync(join(moment.moments, '日常/今天的一点-记录.mdx'), 'utf8'),
    );
    assert.equal(frontmatter.title, '今天的一点 记录');
    assert.equal(frontmatter.slug, '日常/今天的一点-记录');
    assert.deepEqual(frontmatter.images, []);
});

test('new-moment refuses overwrites and normalized names with the same slug', (t) => {
    const moment = fixture(t);
    assert.equal(moment.run('daily/first moment').status, 0);
    const file = join(moment.moments, 'daily/first-moment.md');
    const original = readFileSync(file, 'utf8');
    for (const name of ['daily/first moment', 'daily/first-moment.mdx']) {
        const result = moment.run(name);
        assert.equal(result.status, 1, result.stderr);
        assert.match(result.stderr, /随笔已存在/u);
        assert.equal(readFileSync(file, 'utf8'), original);
    }
    assert.equal(
        existsSync(join(moment.moments, 'daily/first-moment.mdx')),
        false,
    );
});

test('new-moment and new-post can create the same filename in their own collections', (t) => {
    const moment = fixture(t);
    const post = spawnSync(process.execPath, [postScript, 'same-name'], {
        cwd: moment.directory,
        encoding: 'utf8',
    });
    assert.equal(post.status, 0, post.stderr);
    const original = readFileSync(join(moment.posts, 'same-name.md'), 'utf8');
    const result = moment.run('same-name');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(join(moment.moments, 'same-name.md')), true);
    assert.equal(
        readFileSync(join(moment.posts, 'same-name.md'), 'utf8'),
        original,
    );
});

test('new-moment help and argument errors show the moment command without creating content', (t) => {
    const moment = fixture(t);
    for (const flag of ['--help', '-h']) {
        const result = moment.run(flag);
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /pnpm new-moment/u);
        assert.doesNotMatch(result.stdout, /pnpm new-post/u);
    }
    for (const args of [[], ['first-moment', 'second-moment']]) {
        const result = moment.run(...args);
        assert.equal(result.status, 1, result.stderr);
        assert.match(result.stderr, /pnpm new-moment/u);
    }
    assert.equal(existsSync(moment.moments), false);
    assert.equal(existsSync(moment.posts), false);
});

test('new-moment rejects paths outside its collection before writing', (t) => {
    const moment = fixture(t);
    for (const name of [
        '../posts/outside',
        '..\\posts\\outside',
        '/outside.md',
    ]) {
        const result = moment.run(name);
        assert.equal(result.status, 1, result.stderr);
        assert.match(result.stderr, /错误/u);
    }
    assert.equal(existsSync(moment.moments), false);
    assert.equal(existsSync(moment.posts), false);
});

test('new-moment refuses to write through a linked moment directory', (t) => {
    const moment = fixture(t);
    const outside = join(moment.directory, 'outside');
    mkdirSync(outside);
    mkdirSync(moment.moments, { recursive: true });
    try {
        symlinkSync(outside, join(moment.moments, 'linked'), 'junction');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EPERM') {
            t.skip('This environment does not permit creating directory links');
            return;
        }
        throw error;
    }
    const result = moment.run('linked/first-moment');
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /链接/u);
    assert.equal(existsSync(join(outside, 'first-moment.md')), false);
});
