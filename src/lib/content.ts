import { getCollection } from 'astro:content';
import {
    isPublicContent,
    sortPosts,
    validateContent,
    validateCollection,
} from './content-model';
import authors from '../data/authors.json';
import taxonomy from '../data/taxonomy.json';
import popularSlugs from '../data/popular-posts.json';

export async function getPosts() {
    const entries = await getCollection('posts');
    validateContent(entries, {
        authors: authors.map((author) => author.id),
        categories: taxonomy.categories.map((category) => category.id),
        tags: taxonomy.tags.map((tag) => tag.id),
    });
    return sortPosts(entries.filter((entry) => isPublicContent(entry.data)));
}
export async function getMoments() {
    const entries = await getCollection('moments');
    validateCollection(
        entries,
        'moments',
        authors.map((author) => author.id),
    );
    return sortPosts(entries.filter((entry) => isPublicContent(entry.data)));
}
// Use the configured order until a live readership ranking is available.
export async function getPopularPosts(limit = 5) {
    const posts = new Map(
        (await getPosts()).map((post) => [post.data.slug, post]),
    );
    return [...new Set(popularSlugs)]
        .flatMap((slug) => {
            const post = posts.get(slug);
            return post ? [post] : [];
        })
        .slice(0, limit);
}
export async function getPages() {
    const entries = await getCollection('pages');
    validateCollection(
        entries,
        'pages',
        authors.map((author) => author.id),
    );
    return sortPosts(entries.filter((entry) => isPublicContent(entry.data)));
}
export { authors, taxonomy };
