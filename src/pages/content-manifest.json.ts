import { getPosts, getPages, getMoments } from '../lib/content';
import { routeFor } from '../lib/content-model';
export async function GET() {
    const [posts, pages, moments] = await Promise.all([
        getPosts(),
        getPages(),
        getMoments(),
    ]);
    return Response.json({
        posts: posts.map((entry) => ({
            path: routeFor('posts', entry.data.slug),
            title: entry.data.title,
            legacyPath: entry.data.legacyPath,
        })),
        pages: pages.map((entry) => ({
            path: routeFor('pages', entry.data.slug),
        })),
        moments: moments.map((entry) => ({
            path: routeFor('moments', entry.data.slug),
        })),
    });
}
