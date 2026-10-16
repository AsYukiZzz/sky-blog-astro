import { z } from 'astro/zod';
import {
    isPublicContent,
    routeFor,
    type ContentEntry,
} from './content-model.ts';

export interface ColumnConfig {
    slug: string;
    name: string;
    description: string;
    cover: string;
    posts: string[];
}

export type PublicColumn<T extends ContentEntry> = Omit<
    ColumnConfig,
    'posts'
> & {
    posts: T[];
};

const postSlug = z
    .string()
    .min(1)
    .transform((value) => value.normalize('NFC'))
    .refine((value) => {
        try {
            routeFor('posts', value);
            return true;
        } catch {
            return false;
        }
    }, '文章 slug 必须是有效的路径标识');

const cover = z
    .string()
    .trim()
    .refine((value) => {
        if (!value) return true;
        if (value.startsWith('/'))
            return (
                !value.startsWith('//') &&
                !/[\\\u0000-\u001f\u007f]/u.test(value)
            );
        try {
            return ['http:', 'https:'].includes(new URL(value).protocol);
        } catch {
            return false;
        }
    }, '专栏封面必须使用站内绝对路径或 HTTP/HTTPS 图片地址');

export const columnsSchema: z.ZodType<ColumnConfig[]> = z.array(
    z
        .object({
            slug: postSlug.refine(
                (value) => !value.includes('/'),
                '专栏 slug 必须是单个路径段',
            ),
            name: z.string().trim().min(1),
            description: z.string().default(''),
            cover: cover.default(''),
            posts: z.array(postSlug),
        })
        .strict(),
);

export function resolveColumns<T extends ContentEntry>(
    configs: readonly ColumnConfig[],
    allPosts: readonly T[],
    now = new Date(),
): PublicColumn<T>[] {
    const posts = new Map(
        allPosts.map((entry) => [routeFor('posts', entry.data.slug), entry]),
    );
    const columnPaths = new Set<string>();
    const membership = new Map<string, string>();
    return configs.map((config) => {
        const slug = config.slug.normalize('NFC');
        const path = routeFor('columns', slug);
        if (columnPaths.has(path))
            throw new Error(`src/data/columns.jsonc: 专栏 ${slug} 的标识重复`);
        columnPaths.add(path);
        const entries = config.posts.map((reference) => {
            const target = routeFor('posts', reference);
            const owner = membership.get(target);
            if (owner !== undefined)
                throw new Error(
                    `src/data/columns.jsonc: 专栏 ${slug} 的文章 ${reference.normalize('NFC')} 已在专栏 ${owner} 中配置`,
                );
            const post = posts.get(target);
            if (!post)
                throw new Error(
                    `src/data/columns.jsonc: 专栏 ${slug} 引用了不存在的文章 ${reference}`,
                );
            membership.set(target, slug);
            return post;
        });
        return {
            slug,
            name: config.name,
            description: config.description,
            cover: config.cover || '/images/mist.svg',
            posts: entries.filter((entry) => isPublicContent(entry.data, now)),
        };
    });
}
