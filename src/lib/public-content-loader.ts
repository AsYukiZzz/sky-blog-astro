import { glob, type Loader, type DataStore } from 'astro/loaders';
import { isPublicContent, type ContentMeta } from './content-model.ts';
import { writePublicContentStyles } from './public-content-styles.ts';

// Keep metadata for validation, but never register private content as a Vite module.
export function publicContentLoader(base: string, cutoff = new Date()): Loader {
    const source = glob({ pattern: '**/*.{md,mdx}', base, deferRender: true });
    return {
        name: 'sky-public-content',
        async load(context) {
            context.store.clear();
            let loading = true;
            const updateStyles = () => {
                const bodies = context.store
                    .values()
                    .filter((entry) =>
                        isPublicContent(entry.data as unknown as ContentMeta),
                    )
                    .map((entry) => entry.body ?? '');
                writePublicContentStyles(
                    context.config.root,
                    context.collection,
                    bodies,
                );
            };
            const refreshStyles = () => {
                if (!loading) updateStyles();
            };
            const store: DataStore = {
                ...context.store,
                get<TData extends Record<string, unknown>>(id: string) {
                    const entry = context.store.get<TData>(id);
                    // Reparse excluded entries on a development reload, including
                    // unchanged files that have crossed their publication date.
                    if (
                        context.watcher &&
                        entry &&
                        !isPublicContent(entry.data as unknown as ContentMeta)
                    )
                        return { ...entry, digest: undefined };
                    return entry;
                },
                set(entry) {
                    const data = entry.data as unknown as ContentMeta;
                    const snapshotCutoff = context.watcher
                        ? new Date()
                        : cutoff;
                    const publication = {
                        cutoff: snapshotCutoff.toISOString(),
                        isPublic: isPublicContent(
                            {
                                publishedAt: data.publishedAt,
                                draft: data.draft,
                                visibility: data.visibility,
                            },
                            snapshotCutoff,
                        ),
                    };
                    const snapshot = {
                        ...entry,
                        data: { ...entry.data, __publication: publication },
                    };
                    // Replace the decision even when the content digest is unchanged.
                    context.store.delete(entry.id);
                    const result = context.store.set(
                        publication.isPublic
                            ? snapshot
                            : {
                                  ...snapshot,
                                  body: undefined,
                                  rendered: undefined,
                                  assetImports: [],
                                  deferredRender: false,
                              },
                    );
                    refreshStyles();
                    return result;
                },
                delete(id) {
                    context.store.delete(id);
                    refreshStyles();
                },
                clear() {
                    context.store.clear();
                    refreshStyles();
                },
            };
            await source.load({ ...context, store });
            loading = false;
            updateStyles();
        },
    };
}
