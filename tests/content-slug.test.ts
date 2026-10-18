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
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

const scripts = fileURLToPath(new URL('../scripts/', import.meta.url));

function fixture(t: TestContext, collection: string, command: string) {
    const directory = mkdtempSync(join(tmpdir(), 'sky-content-slug-'));
    const base = join(directory, 'src/content', collection);
    t.after(() => {
        assert.equal(dirname(directory), resolve(tmpdir()));
        assert.ok(basename(directory).startsWith('sky-content-slug-'));
        rmSync(directory, { recursive: true, force: true });
    });
    return {
        directory,
        base,
        write(file: string, content: string) {
            const path = join(base, file);
            mkdirSync(dirname(path), { recursive: true });
            writeFileSync(path, content);
            return path;
        },
        run(name: string) {
            return spawnSync(
                process.execPath,
                [join(scripts, `${command}.mjs`), name],
                {
                    cwd: directory,
                    encoding: 'utf8',
                },
            );
        },
    };
}

// new-post leaves slug blank for the author, so only new-moment has an
// explicit slug to validate before writing.
for (const [collection, command] of [['moments', 'new-moment']] as const) {
    for (const extension of ['md', 'mdx']) {
        test(`${command} rejects an existing custom slug in a nested ${extension} file before writing`, (t) => {
            const content = fixture(t, collection, command);
            const original = `---\ntitle: Existing\nslug: "notes/first-entry" # custom address\npublishedAt: '2026-01-01T00:00:00Z'\ndraft: true\n---\nOriginal body.\n`;
            const existing = content.write(
                `archive/existing.${extension}`,
                original,
            );
            const result = content.run('notes/first-entry');

            assert.equal(result.status, 1, result.stderr);
            assert.match(result.stderr, /slug.*已存在/u);
            assert.match(result.stderr, /notes\/first-entry/u);
            assert.ok(result.stderr.includes(`existing.${extension}`));
            assert.equal(existsSync(join(content.base, 'notes')), false);
            assert.equal(readFileSync(existing, 'utf8'), original);
        });
    }

    test(`${command} compares custom slugs using the same Unicode normalization as routes`, (t) => {
        const content = fixture(t, collection, command);
        // Both decomposed and composed Hangul consist of valid letter segments.
        const original =
            "\uFEFF---\r\ntitle: Existing\r\nslug: >-\r\n    \u1100\u1161\r\npublishedAt: '2026-01-01T00:00:00Z'\r\n---\r\n";
        const existing = content.write('legacy.mdx', original);
        const result = content.run('가');

        assert.equal(result.status, 1, result.stderr);
        assert.match(result.stderr, /slug.*已存在/u);
        assert.equal(existsSync(join(content.base, '가.md')), false);
        assert.equal(readFileSync(existing, 'utf8'), original);
    });

    test(`${command} ignores slug text in the body when the actual frontmatter slug differs`, (t) => {
        const content = fixture(t, collection, command);
        const original =
            "---\ntitle: Existing\nslug: archive/older\npublishedAt: '2026-01-01T00:00:00Z'\n---\n\n```yaml\nslug: notes/first-entry\n```\n";
        const existing = content.write('existing.md', original);
        const result = content.run('notes/first-entry');

        assert.equal(result.status, 0, result.stderr);
        assert.equal(
            existsSync(join(content.base, 'notes/first-entry.md')),
            true,
        );
        assert.equal(readFileSync(existing, 'utf8'), original);
    });

    test(`${command} reports invalid existing YAML rather than creating unchecked content`, (t) => {
        const content = fixture(t, collection, command);
        const original = '---\ntitle: Existing\nslug: "unterminated\n---\n';
        const existing = content.write('broken.md', original);
        const result = content.run('notes/first-entry');

        assert.equal(result.status, 1, result.stderr);
        assert.match(result.stderr, /元信息.*解析/u);
        assert.match(result.stderr, /broken\.md/u);
        assert.equal(existsSync(join(content.base, 'notes')), false);
        assert.equal(readFileSync(existing, 'utf8'), original);
    });

    test(`${command} refuses collection links while checking existing slugs`, (t) => {
        const content = fixture(t, collection, command);
        const outside = join(content.directory, 'outside');
        mkdirSync(outside);
        mkdirSync(content.base, { recursive: true });
        try {
            symlinkSync(outside, join(content.base, 'linked'), 'junction');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'EPERM') {
                t.skip(
                    'This environment does not permit creating directory links',
                );
                return;
            }
            throw error;
        }

        const result = content.run('notes/first-entry');
        assert.equal(result.status, 1, result.stderr);
        assert.match(result.stderr, /链接/u);
        assert.equal(existsSync(join(content.base, 'notes')), false);
    });
}
