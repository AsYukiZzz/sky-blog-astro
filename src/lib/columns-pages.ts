import { paginateItems, routeFor, type ContentEntry } from './content-model.ts';
import type { PublicColumn } from './columns-model.ts';

export interface ColumnPage<T extends ContentEntry> {
    params: { slug: string };
    props: {
        columns: PublicColumn<T>[];
        column: PublicColumn<T>;
        posts: T[];
        current: number;
        total: number;
    };
    path: string;
}

export function columnPages<T extends ContentEntry>(
    columns: PublicColumn<T>[],
    pageSize: number,
): ColumnPage<T>[] {
    return columns.flatMap((column) => {
        const pages = paginateItems(column.posts, pageSize);
        const first = routeFor('columns', column.slug);
        return pages.map((posts, index) => ({
            params: {
                slug: index ? `${column.slug}/page/${index + 1}` : column.slug,
            },
            props: {
                columns,
                column,
                posts,
                current: index + 1,
                total: pages.length,
            },
            path: index ? `${first}page/${index + 1}/` : first,
        }));
    });
}
