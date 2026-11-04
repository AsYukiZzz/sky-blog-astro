import type { CommentConfig } from '../types/config.ts';

export interface ResolvedComments {
    provider: 'twikoo';
    envId: string;
    region?: string;
    lang: string;
    assetBaseUrl: string;
}

const defaultAssetBaseUrl = 'https://cdn.jsdelivr.net/npm/twikoo@2.0.17/dist/';

function optionalString(value: unknown, path: string, fallback = '') {
    if (value === undefined) return fallback;
    if (typeof value !== 'string') throw new TypeError(`${path} 必须是字符串`);
    return value.trim() || fallback;
}

function resourceBase(value: unknown) {
    const path = 'comment.twikoo.assetBaseUrl';
    const base = optionalString(value, path, defaultAssetBaseUrl);
    try {
        const local = base.startsWith('/') && !base.startsWith('//');
        if (
            (!local && !/^https?:\/\//i.test(base)) ||
            /[\u0000-\u0020\u007f?#\\]/.test(base)
        )
            throw new Error('invalid URL');
        const url = new URL(base, local ? 'https://example.com' : undefined);
        if (
            !['http:', 'https:'].includes(url.protocol) ||
            url.username ||
            url.password ||
            (local &&
                (url.origin !== 'https://example.com' ||
                    url.pathname.startsWith('//')))
        )
            throw new Error('invalid URL');
        return `${(local ? url.pathname : url.href).replace(/\/+$/, '')}/`;
    } catch {
        throw new TypeError(
            `${path} 必须是无查询参数和锚点的 HTTP/HTTPS 地址或站内路径`,
        );
    }
}

export function resolveComments(
    config: CommentConfig,
    enabled = true,
): ResolvedComments | null {
    if (typeof config.enabled !== 'boolean')
        throw new TypeError('comment.enabled 必须是布尔值');
    if (!config.enabled || !enabled) return null;
    if (config.provider !== 'twikoo')
        throw new TypeError('comment.provider 仅支持 twikoo');
    if (!config.twikoo || typeof config.twikoo.envId !== 'string')
        throw new TypeError('comment.twikoo.envId 必须是字符串');
    const envId = config.twikoo.envId.trim();
    if (!envId) return null;
    const region = optionalString(
        config.twikoo.region,
        'comment.twikoo.region',
    );
    return {
        provider: 'twikoo',
        envId,
        ...(region ? { region } : {}),
        lang: optionalString(
            config.twikoo.lang,
            'comment.twikoo.lang',
            'zh-CN',
        ),
        assetBaseUrl: resourceBase(config.twikoo.assetBaseUrl),
    };
}

export function commentPath(pathname: string): string {
    return pathname.replace(/\/+$/, '') || '/';
}
