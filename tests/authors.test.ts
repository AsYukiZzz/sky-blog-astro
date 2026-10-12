import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const sourceDirectory = new URL('../src/', import.meta.url).href;
let fixtureIndex = 0;

async function loadAuthors(entries: unknown[]) {
    const fixtureId = fixtureIndex++;
    // Replace only Vite's raw-import wiring; exercise the real JSONC parser and schema.
    const hooks = registerHooks({
        resolve(specifier, context, nextResolve) {
            if (context.parentURL?.startsWith(sourceDirectory)) {
                if (specifier.endsWith('authors.jsonc?raw'))
                    return nextResolve(
                        `${specifier}&fixture=${fixtureId}`,
                        context,
                    );
                if (
                    specifier.startsWith('.') &&
                    !specifier.endsWith('.jsonc?raw') &&
                    !/\.[a-z]+$/i.test(specifier)
                )
                    return nextResolve(`${specifier}.ts`, context);
            }
            return nextResolve(specifier, context);
        },
        load(url, context, nextLoad) {
            const moduleUrl = new URL(url);
            if (
                url.startsWith(sourceDirectory) &&
                moduleUrl.pathname.endsWith('.jsonc') &&
                moduleUrl.searchParams.has('raw')
            ) {
                const source = moduleUrl.pathname.endsWith('/authors.jsonc')
                    ? JSON.stringify(entries)
                    : readFileSync(fileURLToPath(url), 'utf8');
                return {
                    format: 'module',
                    source: `export default ${JSON.stringify(source)};`,
                    shortCircuit: true,
                };
            }
            return nextLoad(url, context);
        },
    });
    try {
        const { authors } = await import(
            `../src/data/index.ts?authors-fixture=${fixtureId}`
        );
        return authors;
    } finally {
        hooks.deregister();
    }
}

const profile = { name: 'Author', bio: 'A writer', avatar: '/avatar.svg' };

test("author data retains each author's own contact links", async () => {
    const authors = await loadAuthors([
        {
            ...profile,
            id: 'alice',
            social: [
                {
                    label: 'Email',
                    href: 'mailto:alice@example.com',
                    icon: 'mail',
                },
                { label: 'WeChat', href: '', icon: 'wechat' },
            ],
        },
        {
            ...profile,
            id: 'bob',
            social: [{ label: 'Website', href: '/pages/bob/', icon: 'link' }],
        },
    ]);
    assert.deepEqual(authors[0].social, [
        { label: 'Email', href: 'mailto:alice@example.com', icon: 'mail' },
        { label: 'WeChat', href: '', icon: 'wechat' },
    ]);
    assert.deepEqual(authors[1].social, [
        { label: 'Website', href: '/pages/bob/', icon: 'link' },
    ]);
});

test('authors without configured contacts receive an empty contact list', async () => {
    const authors = await loadAuthors([
        { ...profile, id: 'alice' },
        { ...profile, id: 'bob', social: [] },
    ]);
    assert.deepEqual(authors[0].social, []);
    assert.deepEqual(authors[1].social, []);
});

test('invalid author contacts report the data file and social field', async () => {
    for (const social of [
        null,
        'https://example.com',
        [{ href: '/contact/', icon: 'mail' }],
        [{ label: 'Email', href: 42, icon: 'mail' }],
        [{ label: 'Email', href: '/contact/', icon: false }],
    ]) {
        await assert.rejects(
            loadAuthors([{ ...profile, id: 'alice', social }]),
            /Invalid data in src\/data\/authors\.jsonc:.*social/s,
        );
    }
});
