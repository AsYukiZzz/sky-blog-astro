import { defineCollection } from 'astro:content';
import { publicContentLoader } from './lib/public-content-loader';
import { z } from 'astro/zod';
import { getAuthor } from './lib/author';
import { COPYRIGHT_TYPES } from './lib/copyright';

const author = getAuthor();

// Every collection in this build uses this cutoff. Development watcher reloads
// deliberately refresh their entry snapshots inside the loader.
const publicationCutoff = new Date();

const validSlug = (value: string) =>
    value
        .split('/')
        .every(
            (part) =>
                /^[\p{L}\p{N}_~.-]+$/u.test(part) &&
                part !== '.' &&
                part !== '..',
        );
const slug = z
    .string()
    .min(1)
    .refine(validSlug, 'slug must contain valid path segments');
// The generator leaves slug blank so the author can fill it; the build rejects
// the blank value instead of deriving an address from the file name.
const contentSlug = z
    .string()
    .nullish()
    .transform((value) => value ?? '')
    .superRefine((value, context) => {
        if (!value.trim()) {
            context.addIssue({
                code: 'custom',
                message: 'slug 不能为空，请在文章元信息中填写',
            });
            return;
        }
        if (!validSlug(value)) {
            context.addIssue({
                code: 'custom',
                message: 'slug must contain valid path segments',
            });
        }
    });
const common = z.object({
    title: z.string().min(1),
    slug: contentSlug,
    description: z
        .string()
        .nullish()
        .transform((value) => value ?? ''),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    draft: z.boolean().default(false),
    visibility: z.enum(['public', 'private', 'restricted']).default('public'),
    cover: z
        .string()
        .nullish()
        .transform((value) => value ?? undefined),
    author: z
        .string()
        .refine(
            (value) => value.trim().length > 0 && value === author.id,
            'author must reference the configured personal author',
        )
        .prefault(author.id),
});
const copyright = z
    .object({
        type: z.enum(COPYRIGHT_TYPES),
        license: z.string().trim().min(1, 'license 不能为空'),
        source: z.preprocess(
            (value) => {
                if (value === null || value === undefined) return undefined;
                if (typeof value !== 'string') return value;
                return value.trim() || undefined;
            },
            z.url({ protocol: /^https?$/ }).optional(),
        ),
        note: z
            .string()
            .nullish()
            .transform((value) => value?.trim() || undefined),
    })
    .superRefine((value, context) => {
        if (
            (value.type === 'repost' || value.type === 'derivative') &&
            !value.source
        ) {
            context.addIssue({
                code: 'custom',
                path: ['source'],
                message: '转载或二次创作必须填写 source 来源链接',
            });
        }
        if (value.type === 'custom' && !value.note) {
            context.addIssue({
                code: 'custom',
                path: ['note'],
                message: 'custom 类型必须填写 note 创作声明',
            });
        }
    });
const posts = defineCollection({
    loader: publicContentLoader('./src/content/posts', publicationCutoff),
    schema: common
        .extend({
            categories: z.array(slug).default([]),
            tags: z.array(slug).default([]),
            pinned: z.boolean().default(false),
            legacyPath: z.string().optional(),
            copyright: copyright
                .nullish()
                .transform((value) => value ?? undefined),
        })
        .superRefine((data, context) => {
            if (!data.copyright) {
                context.addIssue({
                    code: 'custom',
                    path: ['copyright'],
                    message: '每篇博文必须填写 copyright 版权信息',
                });
            }
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
        copyright: copyright.nullish().transform((value) => value ?? undefined),
    }),
});
export const collections = { posts, pages, moments };
