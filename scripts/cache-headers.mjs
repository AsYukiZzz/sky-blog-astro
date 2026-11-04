import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { decodeBuildPath } from './build-paths.mjs';

const begin = '# BEGIN GENERATED HTML CACHE';
const end = '# END GENERATED HTML CACHE';
const maxRules = 100;
const maxLineLength = 2000;

/** Only add freshness to actual public, canonical Astro directory pages. */
export function prepareCacheHeaders(directory) {
    const root = resolve(directory);
    const file = join(root, '_headers');
    if (!existsSync(file)) return { cached: 0, skipped: 0 };
    const source = readFileSync(file, 'utf8')
        .replace(
            new RegExp(`\\r?\\n?${begin}[\\s\\S]*?${end}\\r?\\n?`, 'g'),
            '',
        )
        .trimEnd();
    const rules = [];
    for (const line of source.split(/\r?\n/)) {
        const text = line.trim();
        if (!text || text.startsWith('#')) continue;
        if (/^([^\s]+:\/\/|\/)/.test(text)) {
            rules.push({ path: text, cache: [] });
            continue;
        }
        const rule = rules.at(-1);
        if (!rule) continue;
        if (text.startsWith('!')) {
            if (text.slice(1).trim().toLowerCase() === 'cache-control')
                rule.cache.push(null);
        } else {
            const colon = text.indexOf(':');
            if (
                colon >= 0 &&
                text.slice(0, colon).trim().toLowerCase() === 'cache-control'
            )
                rule.cache.push(text.slice(colon + 1).trim());
        }
    }
    if (
        rules.length > maxRules ||
        source.split(/\r?\n/).some((line) => line.length > maxLineLength)
    )
        throw new Error(
            'Existing _headers exceeds Cloudflare limits (100 rules, 2000 characters per line)',
        );
    const customPolicies = rules
        .filter(
            (rule) =>
                rule.cache.length &&
                !(
                    rule.path === '/*' &&
                    rule.cache.length === 1 &&
                    rule.cache[0]?.toLowerCase() === 'no-cache'
                ),
        )
        .map((rule) => {
            // Generated rules apply to every host. Protect restrictions for any
            // explicitly configured host, including preview domains.
            const path = rule.path.replace(/^[^\s]+:\/\/[^/]+/, '') || '/';
            const pattern = path
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replaceAll('*', '.*')
                .replace(/:[A-Za-z]\w*/g, '[^/]+');
            return new RegExp(`^${pattern}$`);
        });
    const paths = new Set();
    function walk(directory) {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const target = join(directory, entry.name);
            if (entry.isDirectory()) {
                if (!['_astro', 'pagefind'].includes(entry.name)) walk(target);
            } else if (entry.name === 'index.html') {
                const html = readFileSync(target, 'utf8');
                if (!html.includes('name="astro-view-transitions-enabled"'))
                    continue;
                const canonical = html.match(
                    /<link\b[^>]*\brel="canonical"[^>]*\bhref="([^"]+)"/,
                );
                if (!canonical) continue;
                try {
                    const path = new URL(canonical[1]).pathname;
                    if (!path.endsWith('/')) continue;
                    const decoded = decodeBuildPath(path);
                    if (join(root, decoded.slice(1), 'index.html') !== target)
                        continue;
                    if (
                        customPolicies.some(
                            (pattern) =>
                                pattern.test(path) ||
                                pattern.test(decodeURI(path)),
                        )
                    )
                        continue;
                    paths.add(path);
                } catch {
                    /* Invalid or redirect-only HTML is not eligible. */
                }
            }
        }
    }
    walk(root);
    let cached = 0;
    let skipped = 0;
    const generated = [];
    for (const path of [...paths].sort()) {
        if (rules.length + cached >= maxRules || path.length > maxLineLength) {
            skipped++;
            continue;
        }
        generated.push(
            `${path}\n  ! Cache-Control\n  Cache-Control: public, max-age=60, s-maxage=60`,
        );
        cached++;
    }
    writeFileSync(
        file,
        `${source}\n\n${begin}\n${generated.join('\n\n')}\n${end}\n`,
    );
    return { cached, skipped };
}
