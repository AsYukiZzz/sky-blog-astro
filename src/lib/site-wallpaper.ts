import type {
    HomeHeroConfig,
    WallpaperConfig,
    WallpaperPlatform,
} from '../types/config.ts';
import { selectWallpaper } from './wallpapers.ts';
import { selectHeroEntry } from './home-hero.ts';

interface SiteBackgroundElement extends HTMLElement {
    syncHero?: (root: ParentNode) => void;
}

function preloadSiteWallpaper(choose: typeof selectWallpaper) {
    const preload = document.querySelector<HTMLLinkElement>(
        '[data-site-wallpaper-preload]',
    );
    if (!preload || preload.dataset.wallpaperId) return;
    const candidates = JSON.parse(
        preload.dataset.wallpapers ?? '[]',
    ) as WallpaperConfig[];
    const selected = choose(candidates, Math.random());
    if (!selected) return;

    const preconnect = document.querySelector<HTMLLinkElement>(
        '[data-site-wallpaper-preconnect]',
    );
    try {
        const source = new URL(selected.image, document.baseURI);
        if (
            preconnect &&
            ['http:', 'https:'].includes(source.protocol) &&
            source.origin !== location.origin
        ) {
            preconnect.href = source.origin;
            preconnect.rel = 'preconnect';
        }
    } catch {
        // Invalid image URLs still use the normal image failure fallback.
    }
    preload.dataset.wallpaperId = selected.id;
    preload.as = 'image';
    preload.fetchPriority = 'high';
    preload.href = selected.image;
    preload.rel = 'preload';
    delete preload.dataset.wallpapers;
}

function startSiteWallpaper(
    choose: typeof selectWallpaper,
    heroEntry: typeof selectHeroEntry,
) {
    const background = document.querySelector<SiteBackgroundElement>(
        '[data-site-background]',
    );
    if (!background || background.syncHero) return;
    const candidates = JSON.parse(
        background.dataset.wallpapers ?? '[]',
    ) as WallpaperConfig[];
    const selectedId = document.querySelector<HTMLLinkElement>(
        '[data-site-wallpaper-preload]',
    )?.dataset.wallpaperId;
    const selected =
        candidates.find((candidate) => candidate.id === selectedId) ??
        choose(candidates, Math.random());
    const image = background.querySelector<HTMLImageElement>(
        '[data-site-wallpaper], [data-wallpaper-placeholder]',
    );
    if (selected && image) {
        background.dataset.wallpaperId = selected.id;
        image.dataset.siteWallpaper = '';
        delete image.dataset.wallpaperPlaceholder;
        image.setAttribute('src', selected.image);
        image.hidden = false;
    } else {
        delete background.dataset.wallpaperId;
    }

    const syncHero = (root: ParentNode) => {
        const hero = root.querySelector<HTMLElement>(
            '.home-hero[data-hero-config]',
        );
        if (!hero?.dataset.heroConfig) return;
        const config = JSON.parse(hero.dataset.heroConfig) as HomeHeroConfig;
        const entry = heroEntry(config, background.dataset.wallpaperId ?? null);
        hero.dataset.heroPosition = entry.position;
        const content = hero.querySelector<HTMLElement>('.home-hero-content');
        if (content) content.hidden = entry.showTitle === false;
        const title = hero.querySelector<HTMLElement>('.home-hero-title');
        const subtitle = hero.querySelector<HTMLElement>('.home-hero-subtitle');
        if (title) title.textContent = entry.title;
        if (subtitle) {
            subtitle.textContent = entry.subtitle;
            subtitle.hidden = !entry.subtitle;
        }
        const wallpaper = candidates.find(
            (candidate) => candidate.id === background.dataset.wallpaperId,
        );
        const author = wallpaper?.author;
        hero.dataset.heroAuthorPosition = entry.authorPosition ?? 'bottom-left';
        const attribution = hero.querySelector<HTMLElement>(
            '[data-wallpaper-author]',
        );
        const panel = hero.querySelector<HTMLElement>('[data-wallpaper-info]');
        const visible = entry.showAuthor !== false && Boolean(author);
        if (!visible && panel?.isConnected && panel.matches(':popover-open'))
            panel.hidePopover();
        if (attribution) attribution.hidden = !visible;
        hero.querySelectorAll<HTMLElement>(
            '[data-wallpaper-author-name]',
        ).forEach((name) => {
            name.textContent = author?.name ?? '';
        });
        const preview = hero.querySelector<HTMLImageElement>(
            '[data-wallpaper-info-image]',
        );
        if (preview) {
            if (wallpaper) {
                if (preview.getAttribute('src') !== wallpaper.image)
                    preview.setAttribute('src', wallpaper.image);
            } else preview.removeAttribute('src');
            preview.hidden = !wallpaper;
        }
        const publication = hero.querySelector<HTMLAnchorElement>(
            '[data-wallpaper-url]',
        );
        if (publication) {
            if (author?.url) publication.setAttribute('href', author.url);
            else publication.removeAttribute('href');
            publication.hidden = !author?.url;
        }
        let hasSources = false;
        hero.querySelectorAll<HTMLElement>('[data-wallpaper-platform]').forEach(
            (item) => {
                const href =
                    author?.links?.[
                        item.dataset.wallpaperPlatform as WallpaperPlatform
                    ];
                const link = item.querySelector('a');
                if (href) link?.setAttribute('href', href);
                else link?.removeAttribute('href');
                item.hidden = !href;
                hasSources ||= Boolean(href);
            },
        );
        const sources = hero.querySelector<HTMLElement>(
            '[data-wallpaper-sources]',
        );
        if (sources) sources.hidden = !hasSources;
    };
    background.syncHero = syncHero;
    document.addEventListener('astro:before-swap', (event) => {
        syncHero((event as Event & { newDocument: Document }).newDocument);
    });
}

function syncInitialHomeHero() {
    document
        .querySelector<SiteBackgroundElement>('[data-site-background]')
        ?.syncHero?.(document);
}

// Only constant function source is executable; configuration stays in escaped HTML attributes.
export function siteWallpaperPreloadScript(): string {
    return `(${preloadSiteWallpaper.toString()})(${selectWallpaper.toString()});`;
}

export function siteWallpaperScript(): string {
    return `(${startSiteWallpaper.toString()})(${selectWallpaper.toString()}, ${selectHeroEntry.toString()});`;
}

export function homeHeroScript(): string {
    return `(${syncInitialHomeHero.toString()})();`;
}
