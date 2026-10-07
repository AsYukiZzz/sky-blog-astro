import { defineCollection } from 'astro:content';
import { publicContentLoader } from './lib/public-content-loader';
import { z } from 'astro/zod';
import authors from './data/authors.json';

// Every collection in this build uses this cutoff. Development watcher reloads
// deliberately refresh their entry snapshots inside the loader.
const publicationCutoff = new Date();

const slug = z
    .string()
    .min(1)
    .refine(
        (value) =>
            value
                .split('/')
                .every(
                    (part) =>
                        /^[\p{L}\p{N}_~.-]+$/u.test(part) &&
                        part !== '.' &&
                        part !== '..',
                ),
        'slug must contain valid path segments',
    );
const common = z.object({
    title: z.string().min(1),
    slug,
    description: z.string().default(''),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    draft: z.boolean().default(false),
    visibility: z.enum(['public', 'private', 'restricted']).default('public'),
    cover: z.string().optional(),
    author: z
        .string()
        .refine(
            (value) =>
                value.trim().length > 0 &&
                authors.some((author) => author.id === value),
            'author must reference a configured author',
        )
        .default('sky'),
});
const posts = defineCollection({
    loader: publicContentLoader('./src/content/posts', publicationCutoff),
    schema: common.extend({
        categories: z.array(z.string()).default([]),
        tags: z.array(z.string()).default([]),
        pinned: z.boolean().default(false),
        legacyPath: z.string().optional(),
        copyright: z
            .object({
                type: z
                    .enum(['original', 'repost', 'ai', 'derivative', 'custom'])
                    .default('original'),
                license: z.string().default('CC BY-NC-SA 4.0'),
                source: z.url({ protocol: /^https?$/ }).optional(),
                note: z.string().optional(),
            })
            .optional(),
    }),
});
const pages = defineCollection({
    loader: publicContentLoader('./src/content/pages', publicationCutoff),
    schema: common,
});
const moments = defineCollection({
    loader: publicContentLoader('./src/content/moments', publicationCutoff),
    schema: common.extend({
        tags: z.array(z.string()).default([]),
        images: z.array(z.string()).default([]),
    }),
});
export const collections = { posts, pages, moments };
