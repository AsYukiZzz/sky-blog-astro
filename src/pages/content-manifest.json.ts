import { getPosts, getPages, getMoments, getColumns } from '../lib/content';
import { routeFor } from '../lib/content-model';
import { columnPages } from '../lib/columns-pages';
import { site } from '../config';
export async function GET() {
    const [posts, pages, moments, columns] = await Promise.all([
        getPosts(),
        getPages(),
        getMoments(),
        getColumns(),
    ]);
    return Response.json({
        columns: [
            { path: '/columns/' },
            ...columnPages(columns, site.pageSize).map(({ path }) => ({
                path,
            })),
        ],
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
