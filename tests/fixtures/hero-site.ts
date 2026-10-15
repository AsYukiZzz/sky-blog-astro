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

export const heroImagePaths = [
    '/images/mist.svg?hero=first',
    '/images/mist.svg?hero=second&label=天空',
];

export async function createHeroSite() {
    const project = fileURLToPath(new URL('../../', import.meta.url));
    const scratch = join(project, '.cache');
    mkdirSync(scratch, { recursive: true });
    const directory = mkdtempSync(join(scratch, 'hero-site-'));
    const removeFixture = () => {
        assert.equal(dirname(resolve(directory)), resolve(scratch));
        assert.ok(basename(directory).startsWith('hero-site-'));
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
        const configPath = join(directory, 'src/config.ts');
        const imageConfig = [
            '',
            ` ${heroImagePaths[0]} `,
            '  ',
            heroImagePaths[1],
        ];
        writeFileSync(
            configPath,
            `${readFileSync(configPath, 'utf8')}\ntheme.home.hero.background = 'image';\ntheme.home.hero.image = ${JSON.stringify(imageConfig)};\n`,
        );
        writeFileSync(
            join(directory, 'public/hero-outside.html'),
            '<!doctype html><html><head><title>Outside</title></head><body>A document without ClientRouter.</body></html>',
        );
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
