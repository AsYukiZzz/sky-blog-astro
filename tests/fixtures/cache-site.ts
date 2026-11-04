import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function createCacheSite() {
    const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
    const lines = readFileSync(join(dist, '_headers'), 'utf8').split(/\r?\n/);
    const headersFor = (path: string) => {
        const headers = new Headers();
        let matches = false;
        for (const line of lines) {
            if (!line.trim() || line.trim().startsWith('#')) continue;
            const text = line.trim();
            if (/^([^\s]+:\/\/|\/)/.test(text)) {
                const pattern = text
                    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                    .replaceAll('*', '.*');
                matches = new RegExp('^' + pattern + '$').test(path);
            } else if (matches) {
                if (text.startsWith('! ')) headers.delete(text.slice(2).trim());
                else {
                    const colon = text.indexOf(':');
                    headers.append(
                        text.slice(0, colon).trim(),
                        text.slice(colon + 1).trim(),
                    );
                }
            }
        }
        return headers;
    };
    type Variant = {
        cache?: string;
        age?: number;
        version?: string;
        status?: number;
        delay?: number;
    };
    const variants = new Map<string, Variant>();
    const hits: { url: string; status: number; prefetch: boolean }[] = [];
    const types: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.woff2': 'font/woff2',
        '.json': 'application/json',
    };
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const server = createServer((request, response) => {
        const url = new URL(request.url!, 'http://localhost');
        const key = url.pathname + url.search;
        const variant = variants.get(key) ?? {};
        try {
            let file = resolve(dist, '.' + decodeURIComponent(url.pathname));
            assert.ok(
                file === resolve(dist) || file.startsWith(resolve(dist) + sep),
            );
            if (!extname(file)) file = join(file, 'index.html');
            let body = readFileSync(file);
            const headers = headersFor(url.pathname);
            if (variant.version)
                body = Buffer.from(
                    body
                        .toString()
                        .replace(
                            '</head>',
                            `<meta name="cache-test-version" content="${variant.version}"></head>`,
                        ),
                );
            const etag =
                '"' + createHash('sha256').update(body).digest('hex') + '"';
            headers.set(
                'Content-Type',
                types[extname(file)] ?? 'application/octet-stream',
            );
            headers.set('ETag', etag);
            if (variant.cache) headers.set('Cache-Control', variant.cache);
            if (variant.age !== undefined)
                headers.set('Age', String(variant.age));
            const status =
                variant.status ??
                (request.headers['if-none-match'] === etag ? 304 : 200);
            hits.push({
                url: key,
                status,
                prefetch: String(request.headers['sec-purpose'] ?? '').includes(
                    'prefetch',
                ),
            });
            response.writeHead(status, Object.fromEntries(headers));
            const end = () => response.end(status === 304 ? undefined : body);
            if (variant.delay) {
                response.flushHeaders();
                const timer = setTimeout(() => {
                    timers.delete(timer);
                    end();
                }, variant.delay);
                timers.add(timer);
            } else end();
        } catch {
            response.writeHead(404, { 'Cache-Control': 'no-store' }).end();
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
        variants,
        hits,
        async close() {
            for (const timer of timers) clearTimeout(timer);
            server.closeAllConnections();
            await new Promise<void>((done, reject) =>
                server.close((error) => (error ? reject(error) : done())),
            );
        },
    };
}
