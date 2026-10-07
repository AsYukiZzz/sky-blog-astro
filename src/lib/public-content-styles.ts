import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Tailwind scans these bodies through its normal pipeline. Keeping one compiler
// preserves utility ordering, variants and theme variables across all sources.
export function writePublicContentStyles(
    root: URL,
    collection: string,
    bodies: string[],
) {
    const content = bodies.join('\n');
    const path = join(
        fileURLToPath(root),
        '.astro',
        'public-content',
        `${collection}.mdx`,
    );
    mkdirSync(dirname(path), { recursive: true });
    // Avoid unnecessary Vite reloads when published content is unchanged.
    let previous: string | undefined;
    try {
        previous = readFileSync(path, 'utf8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (previous !== content) writeFileSync(path, content);
}
