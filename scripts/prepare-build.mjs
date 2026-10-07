import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { decodeBuildPath } from './build-paths.mjs';

const dist = resolve('dist');
const manifest = JSON.parse(
    readFileSync(join(dist, 'content-manifest.json'), 'utf8'),
);
const file = join(dist, '_redirects');
const redirects = existsSync(file)
    ? readFileSync(file, 'utf8')
          .split(/\r?\n/)
          .filter((line) => line.trim())
    : [];
const sources = new Set(
    redirects
        .filter((line) => !line.trim().startsWith('#'))
        .map((line) => {
            const source = line.trim().split(/\s+/)[0];
            try {
                return decodeBuildPath(source);
            } catch {
                // Existing rules may use Cloudflare placeholders or wildcards.
                return source;
            }
        }),
);
// Pagefind runs after this script; platform paths may have no artifact yet.
const protectedNamespaces = new Set([
    '_astro',
    '_headers',
    '_redirects',
    '_routes.json',
    '_worker.js',
    'cdn-cgi',
    'pagefind',
]);
for (const post of manifest.posts) {
    if (!post.legacyPath) continue;
    const source = post.legacyPath;
    const pathname = decodeBuildPath(source, `legacyPath for ${post.title}`);
    if (pathname === decodeBuildPath(post.path, `post path for ${post.title}`))
        continue;
    if (sources.has(pathname))
        throw new Error(`Duplicate redirect source: ${source}`);
    if (protectedNamespaces.has(pathname.split('/')[1]))
        throw new Error(
            `legacyPath shadows a protected platform/search path: ${source}`,
        );
    const sourceFile = join(dist, pathname.slice(1));
    if (existsSync(sourceFile) || existsSync(`${sourceFile}.html`))
        throw new Error(`legacyPath shadows a published artifact: ${source}`);
    redirects.push(`${source} ${post.path} 301`);
    sources.add(pathname);
}
writeFileSync(file, `${redirects.join('\n')}\n`);
console.log(`Prepared ${redirects.length} Cloudflare Pages redirects.`);
