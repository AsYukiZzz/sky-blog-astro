import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { decodeBuildPath } from './build-paths.mjs';

const root = resolve('dist');
const required = [
    'index.html',
    'archives/index.html',
    'categories/index.html',
    'tags/index.html',
    'links/index.html',
    'moments/index.html',
    '404.html',
    'feed.xml',
    'sitemap-index.xml',
    'robots.txt',
    'pagefind/pagefind.js',
    'content-manifest.json',
];
for (const file of required)
    assert.ok(existsSync(join(root, file)), `Missing build artifact: ${file}`);
const files = [];
function walk(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
        const target = join(path, entry.name);
        if (entry.isDirectory()) walk(target);
        else files.push(target);
    }
}
walk(root);
for (const file of files.filter((path) =>
    /\.(?:html|json|xml|js|css|svg|txt)$/.test(path),
)) {
    assert.ok(
        !/SECRET_(DRAFT|PRIVATE|FUTURE)_FIXTURE/.test(
            readFileSync(file, 'utf8'),
        ),
        `Non-public content or asset leaked: ${file}`,
    );
}
let links = 0;
for (const file of files.filter((path) => path.endsWith('.html'))) {
    const html = readFileSync(file, 'utf8');
    assert.equal(
        (html.match(/rel="canonical"/g) ?? []).length,
        1,
        `Canonical must be unique: ${file}`,
    );
    assert.ok(
        !/SECRET_(DRAFT|PRIVATE|FUTURE)_FIXTURE/.test(html),
        `Non-public content leaked: ${file}`,
    );
    assert.ok(
        !/\/apis\/[^"'\s<>]*halo|\/plugins\/Plugin/.test(html),
        `Halo runtime dependency: ${file}`,
    );
    for (const match of html.matchAll(/(?:href|src)="(\/[^"#]*)"/g)) {
        const source = match[1].split(/[?#]/)[0];
        if (source.startsWith('//')) continue;
        const pathname = decodeBuildPath(source, `local link in ${file}`);
        const target = join(root, pathname.slice(1));
        assert.ok(
            existsSync(target) &&
                (statSync(target).isFile() ||
                    existsSync(join(target, 'index.html'))),
            `Broken local link ${source} in ${file}`,
        );
        links++;
    }
}
const feed = readFileSync(join(root, 'feed.xml'), 'utf8');
assert.ok(
    !/SECRET_(DRAFT|PRIVATE|FUTURE)_FIXTURE/.test(feed),
    'Non-public content leaked into RSS',
);
const manifest = JSON.parse(
    readFileSync(join(root, 'content-manifest.json'), 'utf8'),
);
assert.ok(Array.isArray(manifest.posts), 'Post manifest must be an array');
for (const [collection, entries] of Object.entries(manifest)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
        const pathname = decodeBuildPath(
            entry.path,
            `${collection} manifest path`,
        );
        assert.ok(
            existsSync(join(root, pathname.slice(1), 'index.html')),
            `${collection} route missing: ${entry.path}`,
        );
    }
}
console.log(
    `Verified ${files.filter((path) => path.endsWith('.html')).length} HTML pages, ${links} local links, RSS, sitemap and Pagefind.`,
);
