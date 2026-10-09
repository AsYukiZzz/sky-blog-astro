import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    cpSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const scratch = join(project, '.cache');

test(
    'taxonomy archives preserve nested names without colliding with pagination',
    { timeout: 120_000 },
    (t) => {
        mkdirSync(scratch, { recursive: true });
        const fixture = mkdtempSync(join(scratch, 'taxonomy-build-'));
        t.after(() => {
            assert.equal(dirname(resolve(fixture)), resolve(scratch));
            assert.ok(basename(fixture).startsWith('taxonomy-build-'));
            rmSync(fixture, { recursive: true, force: true });
        });
        for (const entry of [
            'src',
            'public',
            'astro.config.mjs',
            'package.json',
            'tsconfig.json',
        ])
            cpSync(join(project, entry), join(fixture, entry), {
                recursive: true,
            });

        const writePost = (id: string, data: Record<string, unknown>) => {
            const metadata = Object.entries({
                title: id,
                slug: id,
                publishedAt: '2020-01-01T00:00:00Z',
                ...data,
            })
                .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
                .join('\n');
            writeFileSync(
                join(fixture, 'src/content/posts', `${id}.md`),
                `---\n${metadata}\n---\n${id}\n`,
            );
        };
        for (let index = 0; index < 7; index++)
            writePost(`pagination-${index}`, {
                categories: ['notes', 'clean', '\u1100\u1161'],
                tags: ['notes', 'clean', '\u1100\u1161'],
            });
        writePost('nested-name', {
            categories: ['notes/page/2', '가/page/2'],
            tags: ['notes/page/2', '가/page/2'],
        });
        writePost('private-name', {
            categories: ['clean/page/2'],
            tags: ['clean/page/2'],
            visibility: 'private',
        });

        const build = spawnSync(
            process.execPath,
            [
                join(project, 'node_modules/astro/bin/astro.mjs'),
                'build',
                '--root',
                fixture,
            ],
            {
                cwd: project,
                encoding: 'utf8',
                windowsHide: true,
                timeout: 100_000,
                maxBuffer: 4 * 1024 * 1024,
            },
        );
        assert.ifError(build.error);
        assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
        for (const kind of ['categories', 'tags']) {
            for (const [slug, encoded] of [
                ['notes', 'notes'],
                ['가', '%EA%B0%80'],
            ]) {
                const first = readFileSync(
                    join(fixture, 'dist', kind, slug, 'index.html'),
                    'utf8',
                );
                const second = readFileSync(
                    join(fixture, 'dist', kind, slug, '@page/2/index.html'),
                    'utf8',
                );
                const nested = readFileSync(
                    join(fixture, 'dist', kind, slug, 'page/2/index.html'),
                    'utf8',
                );
                assert.ok(
                    first.includes(`href="/${kind}/${encoded}/@page/2/"`),
                    `${kind}: first page must link to safe pagination`,
                );
                assert.ok(
                    second.includes(`href="/${kind}/${encoded}/"`),
                    `${kind}: page 2 must link back to page 1`,
                );
                assert.ok(
                    second.includes('pagination-'),
                    `${kind}: pagination must contain its own posts`,
                );
                assert.ok(
                    nested.includes('nested-name'),
                    `${kind}: the nested archive must keep its posts`,
                );
                assert.equal(
                    second.includes('nested-name'),
                    false,
                    `${kind}: page 2 must not become the nested archive`,
                );
                assert.equal(
                    nested.includes('pagination-'),
                    false,
                    `${kind}: the nested archive must not become page 2`,
                );
            }
            const clean = readFileSync(
                join(fixture, 'dist', kind, 'clean/index.html'),
                'utf8',
            );
            assert.ok(
                clean.includes(`href="/${kind}/clean/page/2/"`),
                `${kind}: ordinary pagination must keep its URL`,
            );
            assert.equal(
                clean.includes('@page'),
                false,
                `${kind}: private names must not change public URLs`,
            );
            assert.ok(
                readFileSync(
                    join(fixture, 'dist', kind, 'clean/page/2/index.html'),
                    'utf8',
                ).includes('pagination-'),
            );
        }
    },
);
