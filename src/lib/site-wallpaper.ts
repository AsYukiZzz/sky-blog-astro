import type { HomeHeroConfig, WallpaperConfig } from '../types/config.ts';
import { selectWallpaper } from './wallpapers.ts';
import { selectHeroEntry } from './home-hero.ts';

interface SiteBackgroundElement extends HTMLElement {
    syncHero?: (root: ParentNode) => void;
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
    const selected = choose(candidates, Math.random());
    const image = background.querySelector<HTMLImageElement>(
        '[data-site-wallpaper]',
    );
    if (selected && image) {
        background.dataset.wallpaperId = selected.id;
        image.setAttribute('src', selected.image);
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
        const title = hero.querySelector<HTMLElement>('.home-hero-title');
        const subtitle = hero.querySelector<HTMLElement>('.home-hero-subtitle');
        if (title) title.textContent = entry.title;
        if (subtitle) {
            subtitle.textContent = entry.subtitle;
            subtitle.hidden = !entry.subtitle;
        }
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
export function siteWallpaperScript(): string {
    return `(${startSiteWallpaper.toString()})(${selectWallpaper.toString()}, ${selectHeroEntry.toString()});`;
}

export function homeHeroScript(): string {
    return `(${syncInitialHomeHero.toString()})();`;
}
