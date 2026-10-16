import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    cpSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const longColumnName =
    '这是一段用于验证专栏标题在手机上正常换行的中文名称'.repeat(3);
export const hiddenColumnPosts = [
    'SECRET_DRAFT_FIXTURE',
    'SECRET_PRIVATE_FIXTURE',
    'SECRET_RESTRICTED_FIXTURE',
    'SECRET_FUTURE_FIXTURE',
];

export async function createColumnsSite(options: { empty?: boolean } = {}) {
    const project = fileURLToPath(new URL('../../', import.meta.url));
    const scratch = join(project, '.cache');
    mkdirSync(scratch, { recursive: true });
    const directory = mkdtempSync(join(scratch, 'columns-site-'));
    const remove = () => {
        assert.equal(dirname(resolve(directory)), resolve(scratch));
        assert.ok(basename(directory).startsWith('columns-site-'));
        rmSync(directory, { recursive: true, force: true });
    };
    try {
        for (const entry of [
            'src',
            'public',
            'astro.config.mjs',
            'package.json',
            'tsconfig.json',
        ])
            cpSync(join(project, entry), join(directory, entry), {
                recursive: true,
            });
        const configPath = join(directory, 'src/config.ts');
        writeFileSync(
            configPath,
            `${readFileSync(configPath, 'utf8')}\nsite.pageSize = 2;\ntheme.extra.sakana.enabled = false;\n`,
        );
        const writePost = (id: string, data: Record<string, unknown> = {}) => {
            const fields = {
                title: `文章 ${id}`,
                slug: id,
                publishedAt: '2020-01-01T00:00:00Z',
                ...data,
            };
            const metadata = Object.entries(fields)
                .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
                .join('\n');
            writeFileSync(
                join(directory, 'src/content/posts', `${id}.md`),
                `---\n${metadata}\n---\n正文 ${id}。\n`,
            );
        };
        writePost('p01', { publishedAt: '2021-01-01T00:00:00Z' });
        writePost('p02', { pinned: true });
        writePost('p03');
        writePost('p04');
        writePost(hiddenColumnPosts[0], { draft: true });
        writePost(hiddenColumnPosts[1], { visibility: 'private' });
        writePost(hiddenColumnPosts[2], { visibility: 'restricted' });
        writePost(hiddenColumnPosts[3], {
            publishedAt: '2099-01-01T00:00:00Z',
        });
        const columns = options.empty
            ? []
            : [
                  {
                      slug: 'manual',
                      name: '手动示例',
                      description: '按手动顺序阅读。',
                      cover: '/images/mist.svg',
                      posts: [
                          'p03',
                          hiddenColumnPosts[0],
                          'p01',
                          hiddenColumnPosts[1],
                          'p02',
                          hiddenColumnPosts[2],
                          hiddenColumnPosts[3],
                      ],
                  },
                  ...Array.from({ length: 9 }, (_, index) => ({
                      slug: `empty-${index + 1}`,
                      name: `空专栏 ${index + 1}`,
                      posts: [],
                  })),
                  {
                      slug: '教程',
                      name: longColumnName,
                      description: '<strong>介绍</strong>',
                      posts: ['p04'],
                  },
              ];
        writeFileSync(
            join(directory, 'src/data/columns.jsonc'),
            JSON.stringify(columns),
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
        const types: Record<string, string> = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.svg': 'image/svg+xml',
            '.json': 'application/json',
            '.xml': 'application/xml',
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
                if (statSync(file).isDirectory())
                    file = join(file, 'index.html');
                const body = readFileSync(file);
                response.setHeader(
                    'Content-Type',
                    types[extname(file)] ?? 'application/octet-stream',
                );
                response.end(body);
            } catch {
                response
                    .writeHead(404, {
                        'Content-Type': 'text/html; charset=utf-8',
                    })
                    .end(readFileSync(join(dist, '404.html')));
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
            dist,
            async close() {
                server.closeAllConnections();
                await new Promise<void>((done, reject) =>
                    server.close((error) => (error ? reject(error) : done())),
                );
                remove();
            },
        };
    } catch (error) {
        remove();
        throw error;
    }
}
