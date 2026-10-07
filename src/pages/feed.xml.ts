import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts } from '../lib/content';
import { routeFor } from '../lib/content-model';
import { site } from '../config/site';
export async function GET(context: APIContext) {
    const posts = await getPosts();
    return rss({
        title: site.title,
        description: site.description,
        site: context.site ?? site.url,
        items: [...posts]
            .sort(
                (a, b) =>
                    b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
            )
            .map((post) => ({
                title: post.data.title,
                pubDate: post.data.publishedAt,
                description: post.data.description,
                link: routeFor('posts', post.data.slug),
            })),
        customData: `<language>${site.language}</language>`,
    });
}
