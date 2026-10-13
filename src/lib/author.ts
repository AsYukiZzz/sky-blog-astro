import { z } from 'astro/zod';
import { author as authorConfig } from '../config.ts';
import { routeFor } from './content-model.ts';

const authorSchema = z.object({
    id: z.string().refine((value) => {
        try {
            routeFor('authors', value);
            return true;
        } catch {
            return false;
        }
    }, 'id must form a valid author route'),
    name: z.string(),
    bio: z.string(),
    avatar: z.string(),
    location: z.string().optional(),
    description: z.string().optional(),
    role: z.string().optional(),
    interests: z.array(z.string()).optional(),
    social: z
        .array(
            z.object({
                label: z.string(),
                href: z.string(),
                icon: z.string(),
            }),
        )
        .default([]),
});

export function getAuthor() {
    const result = authorSchema.safeParse(authorConfig);
    if (!result.success) {
        throw new Error(
            `Invalid author configuration in src/config.ts: ${result.error.message}`,
        );
    }
    return result.data;
}
