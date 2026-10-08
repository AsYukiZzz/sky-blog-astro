import { z } from 'astro/zod';
import { parseJsonc } from '../lib/jsonc';
import authorsSource from './authors.jsonc?raw';
import linksSource from './links.jsonc?raw';
import projectsSource from './projects.jsonc?raw';
import popularPostsSource from './popular-posts.jsonc?raw';

const authorSchema = z.object({
    id: z.string(),
    name: z.string(),
    bio: z.string(),
    avatar: z.string(),
    location: z.string().optional(),
    description: z.string().optional(),
    role: z.string().optional(),
    interests: z.array(z.string()).optional(),
});
const friendSchema = z.object({
    name: z.string(),
    description: z.string(),
    url: z.string(),
    logo: z.string().nullable().optional(),
});
const projectSchema = z.object({
    name: z.string().trim().min(1),
    description: z.string(),
    logo: z.string().nullable().optional(),
    url: z
        .string()
        .trim()
        .pipe(
            z.url({
                protocol: /^https?$/u,
                error: '项目链接必须使用 http 或 https',
            }),
        ),
});

function readData<T>(
    source: string,
    filename: string,
    schema: z.ZodType<T>,
): T {
    const result = schema.safeParse(parseJsonc(source, filename));
    if (!result.success) {
        throw new Error(`Invalid data in ${filename}: ${result.error.message}`);
    }
    return result.data;
}

export const authors = readData(
    authorsSource,
    'src/data/authors.jsonc',
    z.array(authorSchema),
);
export const links = readData(
    linksSource,
    'src/data/links.jsonc',
    z.array(friendSchema),
);
export const projects = readData(
    projectsSource,
    'src/data/projects.jsonc',
    z.array(projectSchema),
);
export const popularSlugs = readData(
    popularPostsSource,
    'src/data/popular-posts.jsonc',
    z.array(z.string()),
);
