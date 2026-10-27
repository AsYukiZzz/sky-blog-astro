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
import { createServer } from 'node:http';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
    GlobalThemeConfig,
    GlassAppearanceConfig,
    HomeConfig,
    PostConfig,
} from '../../src/types/config';

export const wallpaperSource = '/images/forest.svg?site=wallpaper';

export async function createBackgroundSite(
    options: {
        background?: Partial<GlobalThemeConfig['background']>;
        glass?: Partial<GlassAppearanceConfig>;
        loading?: GlobalThemeConfig['loading'];
        hero?: HomeConfig['hero'];
        headerAppearance?: PostConfig['header']['appearance'];
        comments?: boolean;
        recommendations?: boolean;
        coverlessPost?: boolean;
        updatedPost?: boolean;
        developmentMode?: 'development' | 'loading';
    } = {},
) {
    const project = fileURLToPath(new URL('../../', import.meta.url));
    const scratch = join(project, '.cache');
    mkdirSync(scratch, { recursive: true });
    const directory = mkdtempSync(join(scratch, 'background-site-'));
    const removeFixture = () => {
        assert.equal(dirname(resolve(directory)), resolve(scratch));
        assert.ok(basename(directory).startsWith('background-site-'));
        rmSync(directory, { recursive: true, force: true });
    };
    try {
        for (const entry of [
            'src',
            'public',
            'astro.config.mjs',
            'package.json',
            'tsconfig.json',
        ]) {
            cpSync(join(project, entry), join(directory, entry), {
                recursive: true,
            });
        }
        if (options.coverlessPost) {
            const postPath = join(
                directory,
                'src/content/posts/standalone-example.md',
            );
            const source = readFileSync(postPath, 'utf8');
            const withoutCover = source.replace(/^cover:.*\r?\n/m, '');
            assert.notEqual(withoutCover, source);
            writeFileSync(postPath, withoutCover);
        }
        if (options.updatedPost) {
            const postPath = join(
                directory,
                'src/content/posts/format-example.mdx',
            );
            const source = readFileSync(postPath, 'utf8');
            const withUpdate = source.replace(
                /^publishedAt:.*$/m,
                '$&\nupdatedAt: 2026-10-20T18:30:00+08:00',
            );
            assert.notEqual(withUpdate, source);
            writeFileSync(postPath, withUpdate);
        }
        const configPath = join(directory, 'src/config.ts');
        const background = {
            type: 'image',
            image: wallpaperSource,
            position: 'center',
            ...options.background,
        };
        writeFileSync(
            configPath,
            `${readFileSync(configPath, 'utf8')}\nObject.assign(theme.global.background, ${JSON.stringify(background)});\nObject.assign(theme.global.appearance.glass, ${JSON.stringify(options.glass ?? {})});\n${options.headerAppearance === undefined ? '' : `Object.assign(theme.post, { header: { appearance: ${JSON.stringify(options.headerAppearance)} } });`}\ntheme.post.recommendations.enabled = ${Boolean(options.recommendations)};\n${options.comments ? "Object.assign(theme.post.comment, { enabled: true, repo: 'example/blog', repoId: 'test-repo', categoryId: 'test-category' });" : ''}\n`,
        );
        if (options.loading) {
            writeFileSync(
                configPath,
                `${readFileSync(configPath, 'utf8')}\nObject.assign(theme.global, { loading: ${JSON.stringify(options.loading)} });\n`,
            );
        }
        if (options.hero) {
            writeFileSync(
                configPath,
                `${readFileSync(configPath, 'utf8')}\ntheme.home.hero = ${JSON.stringify(options.hero)};\n`,
            );
        }
        if (options.developmentMode) {
            const { dev } = await import('astro');
            const previousNodeEnv = process.env.NODE_ENV;
            let server;
            try {
                server = await dev({
                    root: directory,
                    mode: options.developmentMode,
                    server: { host: '127.0.0.1', port: 0 },
                    logLevel: 'silent',
                });
            } finally {
                if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
                else process.env.NODE_ENV = previousNodeEnv;
            }
            return {
                origin: `http://127.0.0.1:${server.address.port}`,
                async close() {
                    try {
                        await server.stop();
                    } finally {
                        removeFixture();
                    }
                },
            };
        }
        const build = spawnSync(
            process.execPath,
            [
                join(project, 'node_modules/astro/bin/astro.mjs'),
                'build',
                '--root',
                directory,
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

        const dist = resolve(directory, 'dist');
        const contentTypes: Record<string, string> = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.svg': 'image/svg+xml',
            '.json': 'application/json',
            '.woff2': 'font/woff2',
            '.png': 'image/png',
        };
        const server = createServer((request, response) => {
            try {
                const pathname = decodeURIComponent(
                    new URL(request.url ?? '/', 'http://localhost').pathname,
                );
                let file = resolve(dist, `.${pathname}`);
                if (file !== dist && !file.startsWith(`${dist}${sep}`)) {
                    response.writeHead(403).end();
                    return;
                }
                if (!extname(file)) file = join(file, 'index.html');
                const body = readFileSync(file);
                response.setHeader(
                    'Content-Type',
                    contentTypes[extname(file)] ?? 'application/octet-stream',
                );
                response.end(body);
            } catch {
                response.writeHead(404).end();
            }
        });
        await new Promise<void>((done, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', done);
        });
        const address = server.address();
        assert.ok(address && typeof address !== 'string');
        return {
            origin: `http://127.0.0.1:${address.port}`,
            async close() {
                server.closeAllConnections();
                await new Promise<void>((done, reject) => {
                    server.close((error) => (error ? reject(error) : done()));
                });
                removeFixture();
            },
        };
    } catch (error) {
        removeFixture();
        throw error;
    }
}
