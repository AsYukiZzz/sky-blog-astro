import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test, { after, type TestContext } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { LoaderContext } from 'astro/loaders';
import { isPublicContent, publicTaxonomy } from '../src/lib/content-model.ts';
import { recentWritingActivity } from '../src/lib/writing-activity.ts';

const astroPackage = new URL(import.meta.resolve('astro/package.json'));
const astroModule = (path: string) => new URL(`dist/${path}`, astroPackage);
const sourceDirectory = new URL('../src/', import.meta.url).href;
// Use Astro's real schema, Markdown parser, datastore and collection reader.
// The hooks replace only the virtual module wiring normally supplied by Vite.
const contentModule = `
    export { defineCollection } from ${JSON.stringify(astroModule('content/config.js').href)};
    import { createGetCollection } from ${JSON.stringify(astroModule('content/runtime.js').href)};
    export const getCollection = createGetCollection({
        liveCollections: {},
        logger: { warn: (...args) => { throw new Error(args.join(' ')); } },
    });
`;
const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === 'astro:content')
            return {
                url: `data:text/javascript,${encodeURIComponent(contentModule)}`,
                shortCircuit: true,
            };
        if (specifier === 'astro:asset-imports')
            return {
                url: 'data:text/javascript,export default new Map();',
                shortCircuit: true,
            };
        if (
            context.parentURL?.startsWith(sourceDirectory) &&
            specifier.endsWith('.jsonc?raw')
        )
            return nextResolve(specifier, context);
        if (
            context.parentURL?.startsWith(sourceDirectory) &&
            specifier.startsWith('.') &&
            !/\.[a-z]+$/i.test(specifier)
        )
            return nextResolve(`${specifier}.ts`, context);
        return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
        if (url.startsWith(sourceDirectory) && url.endsWith('.jsonc?raw'))
            return {
                format: 'module',
                source: `export default ${JSON.stringify(readFileSync(fileURLToPath(url), 'utf8'))};`,
                shortCircuit: true,
            };
        return nextLoad(url, context);
    },
});
after(() => hooks.deregister());

const { MutableDataStore } = await import(
    astroModule('content/mutable-data-store.js').href
);
const { globalDataStore } = await import(
    astroModule('content/data-store.js').href
);
const { markdownContentEntryType } = await import(
    astroModule('vite-plugin-markdown/content-entry-type.js').href
);
const { getPosts, getPages, getMoments } =
    await import('../src/lib/content.ts');
const cutoff = new Date('2026-10-01T12:00:00Z');
const afterCutoff = new Date('2026-10-01T12:00:02Z');
const collectionNames = ['posts', 'pages', 'moments'] as const;
type CollectionName = (typeof collectionNames)[number];
let fixtureIndex = 0;

async function fixture(t: TestContext) {
    const temporaryRoot = resolve(tmpdir());
    const directory = await mkdtemp(join(temporaryRoot, 'sky-publication-'));
    assert.equal(dirname(directory), temporaryRoot);
    t.after(async () => {
        await store.waitUntilSaveComplete();
        await rm(directory, { recursive: true, force: true });
    });
    const root = pathToFileURL(`${directory}/`);
    const { collections } = await import(
        `../src/content.config.ts?publication-fixture=${fixtureIndex++}`
    );
    const store = new MutableDataStore();
    const errors: string[] = [];
    const config = {
        root,
        srcDir: new URL('src/', root),
        prerenderConflictBehavior: 'error',
    };
    const logger = {
        info() {},
        warn(message: string) {
            errors.push(message);
        },
        error(message: string) {
            errors.push(message);
        },
    };
    async function load(collection: CollectionName, watcher?: EventEmitter) {
        const context = {
            collection,
            config,
            logger,
            store: store.scopedStore(collection),
            meta: store.metaStore(collection),
            parseData: async ({ data }: { data: Record<string, unknown> }) =>
                collections[collection].schema.parse(data),
            generateDigest: (contents: string) =>
                createHash('sha256').update(contents).digest('hex'),
            entryTypes: new Map([['.md', markdownContentEntryType]]),
            watcher,
        };
        await collections[collection].loader.load(
            context as unknown as LoaderContext,
        );
        assert.deepEqual(errors, []);
    }
    async function write(
        collection: CollectionName,
        id: string,
        data: Record<string, unknown> = {},
    ) {
        const base = join(directory, 'src', 'content', collection);
        await mkdir(base, { recursive: true });
        const fields = {
            title: id,
            slug: id,
            publishedAt: '2026-09-20T00:00:00Z',
            ...data,
        };
        const frontmatter = Object.entries(fields)
            .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
            .join('\n');
        const path = join(base, `${id}.md`);
        await writeFile(
            path,
            `---\n${frontmatter}\n---\nBody for ${id}.\n![Image](./${id}.svg)\n<div class="before:content-['STYLE_${id}']"></div>\n`,
        );
        return path;
    }
    return { directory, collections, store, load, write };
}

test('loader publication decisions survive the deadline and separate query contexts', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: cutoff.getTime() });
    const { store, load, write, directory } = await fixture(t);
    for (const collection of collectionNames) {
        await write(collection, 'published', {
            categories: ['development'],
            tags: ['astro'],
        });
        await write(collection, 'future', {
            publishedAt: '2026-10-01T12:00:01Z',
            categories: ['life'],
            tags: ['life'],
        });
        await write(collection, 'private', { visibility: 'private' });
        await write(collection, 'restricted', { visibility: 'restricted' });
        await write(collection, 'draft', { draft: true });
        await load(collection);
        // A later collection is loaded after the deadline within the same build.
        t.mock.timers.setTime(afterCutoff.getTime());
    }
    const restored = await MutableDataStore.fromString(store.toString());
    globalDataStore.set(restored);
    const separateQuery = await import(
        new URL(
            '../src/lib/content-model.ts?separate-publication-query',
            import.meta.url,
        ).href
    );
    for (const collection of collectionNames) {
        const future = restored.get(collection, 'future');
        assert.equal(future.body, undefined);
        assert.equal(future.rendered, undefined);
        assert.equal(Boolean(future.deferredRender), false);
        assert.equal(
            separateQuery.isPublicContent(future.data, afterCutoff),
            false,
            `${collection} must preserve its loader's exclusion`,
        );
    }
    for (const query of [getPosts, getPages, getMoments])
        assert.deepEqual(
            (await query()).map((entry) => entry.id),
            ['published'],
        );
    assert.deepEqual(publicTaxonomy(restored.values('posts')), {
        categories: ['development'],
        tags: ['astro'],
    });
    assert.equal(
        recentWritingActivity(
            restored.values('posts'),
            'Asia/Shanghai',
            afterCutoff,
        ).totalCount,
        1,
    );
    const modulesPath = join(directory, 'module-imports.mjs');
    const assetsPath = join(directory, 'asset-imports.mjs');
    await restored.writeModuleImports(modulesPath);
    await restored.writeAssetImports(assetsPath);
    const modules = await readFile(modulesPath, 'utf8');
    const assets = await readFile(assetsPath, 'utf8');
    for (const id of ['future', 'private', 'restricted', 'draft']) {
        assert.equal(modules.includes(`${id}.md`), false);
        assert.equal(assets.includes(`${id}.svg`), false);
    }
    assert.equal(modules.includes('published.md'), true);
    for (const collection of collectionNames) {
        const styleSource = await readFile(
            join(directory, '.astro/public-content', `${collection}.mdx`),
            'utf8',
        );
        assert.ok(styleSource.includes('STYLE_published'));
        for (const id of ['future', 'private', 'restricted', 'draft'])
            assert.equal(styleSource.includes(`STYLE_${id}`), false);
    }
});

test('development reloads restore future content with its body and can hide it again', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: cutoff.getTime() });
    const { store, write, load, directory } = await fixture(t);
    const watcher = Object.assign(new EventEmitter(), { add() {} });
    const data = { publishedAt: '2026-10-01T12:00:01Z' };
    const path = await write('posts', 'future', data);
    await load('posts', watcher);
    assert.equal(store.get('posts', 'future').body, undefined);
    const styleSource = () =>
        readFile(join(directory, '.astro/public-content/posts.mdx'), 'utf8');
    assert.equal((await styleSource()).includes('STYLE_future'), false);
    t.mock.timers.setTime(afterCutoff.getTime());
    // A watcher reload must reconsider an unchanged file after its deadline.
    for (const listener of watcher.listeners('change')) await listener(path);
    assert.match(store.get('posts', 'future').body, /Body for future/);
    assert.equal(isPublicContent(store.get('posts', 'future').data), true);
    assert.ok((await styleSource()).includes('STYLE_future'));
    await write('posts', 'future', { ...data, visibility: 'private' });
    for (const listener of watcher.listeners('change')) await listener(path);
    assert.equal(store.get('posts', 'future').body, undefined);
    assert.equal(isPublicContent(store.get('posts', 'future').data), false);
    assert.equal((await styleSource()).includes('STYLE_future'), false);
    const modulesPath = join(directory, 'dev-module-imports.mjs');
    await store.writeModuleImports(modulesPath);
    assert.equal(
        (await readFile(modulesPath, 'utf8')).includes('future.md'),
        false,
    );
    await write('posts', 'future', data);
    for (const listener of watcher.listeners('change')) await listener(path);
    assert.ok((await styleSource()).includes('STYLE_future'));
    await rm(path);
    for (const listener of watcher.listeners('unlink')) await listener(path);
    assert.equal((await styleSource()).includes('STYLE_future'), false);
});

test('collection schemas reject blank and unknown authors while defaulting omitted IDs', async (t) => {
    const { collections } = await fixture(t);
    const metadata = {
        title: 'Author validation',
        slug: 'author-validation',
        publishedAt: '2026-09-20T00:00:00Z',
    };
    for (const collection of collectionNames) {
        const schema = collections[collection].schema;
        assert.equal(schema.parse(metadata).author, 'sky');
        assert.equal(
            schema.parse({ ...metadata, author: 'sky' }).author,
            'sky',
        );
        for (const author of ['', '   ', '\t\n', 'unknown', ' sky '])
            assert.equal(
                schema.safeParse({ ...metadata, author }).success,
                false,
                `${collection} must reject ${JSON.stringify(author)}`,
            );
    }
});
