import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    cpSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const scratch = join(project, '.cache');

function filesUnder(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? filesUnder(path) : [path];
    });
}

test(
    'public content keeps utility styles while excluded content cannot emit CSS text or assets',
    { timeout: 120_000 },
    (t) => {
        mkdirSync(scratch, { recursive: true });
        const fixture = mkdtempSync(join(scratch, 'public-style-build-'));
        t.after(() => {
            assert.equal(dirname(resolve(fixture)), resolve(scratch));
            assert.ok(basename(fixture).startsWith('public-style-build-'));
            rmSync(fixture, { recursive: true, force: true });
        });
        for (const entry of [
            'src',
            'public',
            'astro.config.mjs',
            'package.json',
            'tsconfig.json',
        ]) {
            cpSync(join(project, entry), join(fixture, entry), {
                recursive: true,
            });
        }
        const excluded: string[] = [];
        for (const collection of ['posts', 'pages', 'moments']) {
            for (const [state, extra] of Object.entries({
                public: {},
                private: { visibility: 'private' },
                restricted: { visibility: 'restricted' },
                draft: { draft: true },
                future: { publishedAt: '9999-01-01T00:00:00Z' },
            })) {
                const id = `style-${collection}-${state}`;
                const marker = `STYLE_${collection.toUpperCase()}_${state.toUpperCase()}`;
                const metadata = {
                    title: id,
                    slug: id,
                    publishedAt: '2020-01-01T00:00:00Z',
                    ...extra,
                };
                const frontmatter = Object.entries(metadata)
                    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
                    .join('\n');
                writeFileSync(
                    join(fixture, 'src/content', collection, `${id}.mdx`),
                    `---\n${frontmatter}\n---\n<div className="before:content-['${marker}'] bg-[url('/src/assets/${id}.svg')]">Utility style fixture</div>\n` +
                        (state === 'public'
                            ? `<div className="md:hover:bg-fuchsia-300">Variant style fixture</div>\n`
                            : ''),
                );
                writeFileSync(
                    join(fixture, 'src/assets', `${id}.svg`),
                    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text>${marker}_ASSET</text><!--${'x'.repeat(5000)}--></svg>`,
                );
                if (state !== 'public') excluded.push(marker);
            }
        }
        const buildFixture = () =>
            spawnSync(
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
                    timeout: 100_000,
                    maxBuffer: 4 * 1024 * 1024,
                },
            );
        const build = buildFixture();
        assert.ifError(build.error);
        assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
        const outputFiles = filesUnder(join(fixture, 'dist'));
        const styles = outputFiles
            .filter((file) => file.endsWith('.css'))
            .map((file) => readFileSync(file, 'utf8'))
            .join('\n');
        const assets = outputFiles
            .filter((file) => file.endsWith('.svg'))
            .map((file) => readFileSync(file, 'utf8'))
            .join('\n');
        assert.ok(
            styles.includes('md\\:hover\\:bg-fuchsia-300'),
            'public responsive variants must be emitted',
        );
        assert.ok(
            styles.includes('--color-fuchsia-300:'),
            'public utility theme variables must be emitted',
        );
        for (const collection of ['POSTS', 'PAGES', 'MOMENTS']) {
            assert.ok(
                styles.includes(`STYLE_${collection}_PUBLIC`),
                `${collection}: public utility style disappeared`,
            );
            assert.ok(
                assets.includes(`STYLE_${collection}_PUBLIC_ASSET`),
                `${collection}: public utility asset disappeared`,
            );
        }
        for (const marker of excluded) {
            assert.equal(
                styles.includes(marker),
                false,
                `${marker}: excluded content leaked into CSS`,
            );
            assert.equal(
                assets.includes(marker),
                false,
                `${marker}: excluded asset was published`,
            );
        }
        // Reuse the same content cache and generated sources after withdrawing
        // published entries. A later build must remove their CSS and assets.
        for (const collection of ['posts', 'pages', 'moments']) {
            const path = join(
                fixture,
                'src/content',
                collection,
                `style-${collection}-public.mdx`,
            );
            writeFileSync(
                path,
                readFileSync(path, 'utf8').replace(
                    'publishedAt:',
                    'visibility: "private"\npublishedAt:',
                ),
            );
        }
        const withdrawnBuild = buildFixture();
        assert.ifError(withdrawnBuild.error);
        assert.equal(
            withdrawnBuild.status,
            0,
            `${withdrawnBuild.stdout}\n${withdrawnBuild.stderr}`,
        );
        const withdrawnOutput = filesUnder(join(fixture, 'dist'))
            .filter((file) => /\.(css|svg)$/.test(file))
            .map((file) => readFileSync(file, 'utf8'))
            .join('\n');
        for (const collection of ['POSTS', 'PAGES', 'MOMENTS'])
            assert.equal(
                withdrawnOutput.includes(`STYLE_${collection}_PUBLIC`),
                false,
                `${collection}: withdrawn styles or assets survived rebuilding`,
            );
    },
);
