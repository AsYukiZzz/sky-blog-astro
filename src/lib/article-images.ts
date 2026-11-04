import { open } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageMetadata } from 'astro/assets/utils';
import {
    parseFragment,
    serializeOuter,
    type DefaultTreeAdapterMap,
} from 'parse5';

type Dimensions = { width: number; height: number };
type ImageOptions = { publicDir: URL; pageUrl: URL };
type ProcessorOptions = {
    fetch?: typeof globalThis.fetch;
    timeoutMs?: number;
    maxBytes?: number;
    onWarning?: (source: string) => void;
};
type Element = DefaultTreeAdapterMap['element'];

export function createArticleImageProcessor(options: ProcessorOptions = {}) {
    const request = options.fetch ?? globalThis.fetch;
    const maxBytes = options.maxBytes ?? 256 * 1024;
    const warn =
        options.onWarning ??
        ((source: string) =>
            console.warn(
                `[article-images] 无法读取图片尺寸，请为图片填写 width 和 height：${source}`,
            ));
    const remote = new Map<string, Promise<Dimensions | undefined>>();
    let active = 0;
    const waiting: (() => void)[] = [];
    async function limited<T>(action: () => Promise<T>): Promise<T> {
        if (active >= 4)
            await new Promise<void>((resolve) => waiting.push(resolve));
        else active++;
        try {
            return await action();
        } finally {
            const next = waiting.shift();
            if (next) next();
            else active--;
        }
    }
    async function probeRemote(
        source: string,
    ): Promise<Dimensions | undefined> {
        const response = await request(source, {
            signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
            headers: { Range: `bytes=0-${maxBytes - 1}` },
        });
        if (!response.ok || !response.body) {
            await response.body?.cancel();
            return undefined;
        }
        const reader = response.body.getReader();
        let bytes = new Uint8Array();
        try {
            while (bytes.length < maxBytes) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = value.subarray(0, maxBytes - bytes.length);
                const joined = new Uint8Array(bytes.length + chunk.length);
                joined.set(bytes);
                joined.set(chunk, bytes.length);
                bytes = joined;
                try {
                    return await imageMetadata(bytes, source);
                } catch {
                    /* More header bytes may be needed. */
                }
            }
        } finally {
            await reader.cancel().catch(() => {});
        }
        return undefined;
    }
    async function dimensions(
        source: string,
        context: ImageOptions,
    ): Promise<Dimensions | undefined> {
        try {
            if (source.startsWith('data:image/')) {
                const comma = source.indexOf(',');
                const data = source.slice(comma + 1);
                if (comma < 0 || data.length > maxBytes * 2)
                    throw new Error('oversized data image');
                return await imageMetadata(
                    source.slice(0, comma).endsWith(';base64')
                        ? Buffer.from(data, 'base64')
                        : Buffer.from(decodeURIComponent(data)),
                    source,
                );
            }
            const url = new URL(source, context.pageUrl);
            if (url.origin === context.pageUrl.origin) {
                const root = fileURLToPath(context.publicDir);
                const path = resolve(
                    root,
                    `.${decodeURIComponent(url.pathname)}`,
                );
                const within = relative(root, path);
                if (within.startsWith('..') || isAbsolute(within))
                    throw new Error('outside public directory');
                return await limited(async () => {
                    const file = await open(path, 'r');
                    try {
                        const bytes = Buffer.alloc(maxBytes);
                        const { bytesRead } = await file.read(
                            bytes,
                            0,
                            maxBytes,
                            0,
                        );
                        return await imageMetadata(
                            bytes.subarray(0, bytesRead),
                            source,
                        );
                    } finally {
                        await file.close();
                    }
                });
            }
            if (url.protocol !== 'https:' && url.protocol !== 'http:')
                throw new Error('unsupported source');
            url.hash = '';
            let pending = remote.get(url.href);
            if (!pending) {
                pending = limited(() => probeRemote(url.href))
                    .catch(() => undefined)
                    .then((result) => {
                        if (!result) warn(source);
                        return result;
                    });
                remote.set(url.href, pending);
                if (remote.size > 512)
                    remote.delete(remote.keys().next().value!);
            }
            return await pending;
        } catch {
            warn(source);
            return undefined;
        }
    }

    return async function prepare(
        html: string,
        context: ImageOptions,
    ): Promise<string> {
        const tree = parseFragment(html, { sourceCodeLocationInfo: true });
        const images: Element[] = [];
        function collect(node: DefaultTreeAdapterMap['node']) {
            if (
                'tagName' in node &&
                node.tagName === 'img' &&
                node.namespaceURI === 'http://www.w3.org/1999/xhtml'
            )
                images.push(node);
            if ('childNodes' in node) node.childNodes.forEach(collect);
        }
        collect(tree);
        const replacements = await Promise.all(
            images.map(async (image) => {
                const location = image.sourceCodeLocation?.startTag;
                if (!location) return undefined;
                const get = (name: string) =>
                    image.attrs.find((attr) => attr.name === name)?.value;
                const set = (name: string, value: string) => {
                    const attribute = image.attrs.find(
                        (attr) => attr.name === name,
                    );
                    if (attribute) attribute.value = value;
                    else image.attrs.push({ name, value });
                };
                if (get('loading') === undefined) {
                    set('loading', 'lazy');
                    set('data-article-image-auto', '');
                }
                if (get('decoding') === undefined) set('decoding', 'async');
                const width = Number(get('width'));
                const height = Number(get('height'));
                const valid = (size: number) =>
                    Number.isFinite(size) && size > 0;
                if ((!valid(width) || !valid(height)) && get('src')) {
                    const size = await dimensions(get('src')!, context);
                    if (size && valid(size.width) && valid(size.height)) {
                        set(
                            'width',
                            String(
                                valid(width)
                                    ? width
                                    : valid(height)
                                      ? Math.max(
                                            1,
                                            Math.round(
                                                (height * size.width) /
                                                    size.height,
                                            ),
                                        )
                                      : size.width,
                            ),
                        );
                        set(
                            'height',
                            String(
                                valid(height)
                                    ? height
                                    : valid(width)
                                      ? Math.max(
                                            1,
                                            Math.round(
                                                (width * size.height) /
                                                    size.width,
                                            ),
                                        )
                                      : size.height,
                            ),
                        );
                    }
                }
                return {
                    start: location.startOffset,
                    end: location.endOffset,
                    html: serializeOuter(image),
                };
            }),
        );
        for (const replacement of replacements
            .filter((value) => value !== undefined)
            .sort((a, b) => b.start - a.start)) {
            html =
                html.slice(0, replacement.start) +
                replacement.html +
                html.slice(replacement.end);
        }
        return html;
    };
}

export const prepareArticleImages = createArticleImageProcessor();
