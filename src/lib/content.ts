import { getCollection } from 'astro:content';
import {
    isPublicContent,
    sortPosts,
    validateContent,
    validateCollection,
} from './content-model';
import { popularSlugs } from '../data/index';
import { getAuthor } from './author';

export async function getPosts() {
    const entries = await getCollection('posts');
    validateContent(entries, getAuthor().id);
    return sortPosts(entries.filter((entry) => isPublicContent(entry.data)));
}
export async function getMoments() {
    const entries = await getCollection('moments');
    validateCollection(entries, 'moments', getAuthor().id);
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
    validateCollection(entries, 'pages', getAuthor().id);
    return sortPosts(entries.filter((entry) => isPublicContent(entry.data)));
}
