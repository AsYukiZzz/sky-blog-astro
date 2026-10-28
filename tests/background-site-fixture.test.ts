import assert from 'node:assert/strict';
import test from 'node:test';
import {
    appendFileSync,
    cpSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    symlinkSync,
    unlinkSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveHeroConfig } from '../src/lib/home-hero.ts';
import type { HomeHeroConfig } from '../src/types/config.ts';

test(
    'the background fixture isolates wallpaper mappings from the source theme',
    { timeout: 120_000 },
    async () => {
        const project = fileURLToPath(new URL('../', import.meta.url));
        const scratch = join(project, '.cache');
        mkdirSync(scratch, { recursive: true });
        const directory = mkdtempSync(
            join(scratch, 'background-fixture-source-'),
        );
        const modules = join(directory, 'node_modules');
        let linked = false;
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
            mkdirSync(join(directory, 'tests/fixtures'), { recursive: true });
            cpSync(
                join(project, 'tests/fixtures/site-background.ts'),
                join(directory, 'tests/fixtures/site-background.ts'),
            );
            symlinkSync(join(project, 'node_modules'), modules, 'junction');
            linked = true;

            const candidates = [
                { id: 'production-wallpaper', image: '/images/mist.svg' },
            ];
            const hero: HomeHeroConfig = {
                size: 'full',
                default: {
                    title: 'Fixture default',
                    subtitle: '',
                    position: 'bottom-left',
                },
                byWallpaper: {
                    'production-wallpaper': {
                        title: 'Production title',
                        subtitle: '',
                        position: 'top-right',
                    },
                },
            };
            assert.doesNotThrow(() => resolveHeroConfig(hero, candidates));
            appendFileSync(
                join(directory, 'src/config.ts'),
                `\nObject.assign(theme.global.background, { type: 'image', wallpapers: ${JSON.stringify(candidates)} });\ntheme.home.hero = ${JSON.stringify(hero)};\n`,
            );
            const { createBackgroundSite } = await import(
                pathToFileURL(
                    join(directory, 'tests/fixtures/site-background.ts'),
                ).href
            );
            const site = await createBackgroundSite();
            try {
                const response = await fetch(site.origin);
                assert.equal(response.status, 200);
                const html = await response.text();
                assert.match(html, /data-wallpaper-id="forest"/);
                assert.match(html, /<h1\b[^>]*>Fixture default<\/h1>/);
            } finally {
                await site.close();
            }
        } finally {
            assert.equal(dirname(resolve(directory)), resolve(scratch));
            assert.ok(
                basename(directory).startsWith('background-fixture-source-'),
            );
            if (linked) unlinkSync(modules);
            rmSync(directory, { recursive: true, force: true });
        }
    },
);
