import type { HomeCardId } from '../components/home/card-specs.ts';
import type { HomeLayout, HomeLayoutName, HomePresetName } from './home.ts';

export interface NavigationLink {
    label: string;
    href: string;
}

export interface NavigationItem extends NavigationLink {
    icon: string;
    children?: NavigationLink[];
}

export interface AuthorSocialLink {
    label: string;
    href: string;
    icon: string;
}

export interface AuthorConfig {
    id: string;
    name: string;
    bio: string;
    avatar: string;
    location?: string;
    description?: string;
    role?: string;
    interests?: string[];
    social?: AuthorSocialLink[];
}

export interface SiteConfig {
    title: string;
    subtitle: string;
    description: string;
    url: string;
    language: string;
    timezone: string;
    pageSize: number;
    copyrightYear: number;
    startedAt: string;
    navigation: NavigationItem[];
}

export interface FooterProvider {
    name: string;
    description: string;
    url: string;
}

export interface FooterConfig {
    copyrightOwner: string;
    icp: string;
    publicSecurity: { text: string; url: string };
    providers: FooterProvider[];
    theme: { name: string; url: string };
    privacyUrl: string;
    termsUrl: string;
    sitemapUrl: string;
    rssUrl: string;
    showLoadTime: boolean;
}

export interface HomeCardConfig<Id extends string = HomeCardId> {
    preset: HomePresetName;
    disabled?: readonly Id[];
    layouts?: Partial<Record<HomeLayoutName, Partial<HomeLayout>>>;
}

export interface WallpaperConfig {
    id: string;
    image: string;
}

export type HeroPosition =
    | 'top-left'
    | 'bottom-left'
    | 'top-right'
    | 'bottom-right'
    | 'top-center'
    | 'bottom-center'
    | 'center';

export interface HeroEntry {
    title: string;
    subtitle: string;
    position: HeroPosition;
}

export interface HomeHeroConfig {
    size: 'compact' | 'full';
    default: HeroEntry;
    byWallpaper: Record<string, HeroEntry>;
}

export interface HomeConfig {
    hero: HomeHeroConfig;
    card: HomeCardConfig;
}

export interface PostConfig {
    header: {
        appearance: 'transparent' | 'glass';
    };
    recommendations: {
        enabled: boolean;
        maxItems: number;
    };
    comment: {
        enabled: boolean;
        repo: string;
        repoId: string;
        category: string;
        categoryId: string;
    };
}

export interface ExtraConfig {
    sakana: {
        enabled: boolean;
        character: 'chisato' | 'takina';
        size: number;
        position: 'left' | 'right';
        offset: { side: number; bottom: number };
        showOnMobile: boolean;
        autoMode: boolean;
    };
    dock: boolean;
}

export interface GlassAppearanceConfig {
    blur: number;
    saturation: number;
    opacity: { light: number; dark: number };
}

export interface PageLoadingConfig {
    strategy: 'wallpaper' | 'content';
    maxWait: number;
}

export interface GlobalThemeConfig {
    font: 'serif' | 'sans';
    loading: PageLoadingConfig;
    background: {
        type: 'image' | 'solid';
        wallpapers: WallpaperConfig[];
        position: string;
    };
    appearance: { glass: GlassAppearanceConfig };
}

export interface ThemeConfig {
    global: GlobalThemeConfig;
    home: HomeConfig;
    footer: FooterConfig;
    post: PostConfig;
    extra: ExtraConfig;
}
