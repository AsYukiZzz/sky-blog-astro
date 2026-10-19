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

export interface HomeConfig {
    hero: {
        title: string;
        subtitle: string;
        size: 'compact' | 'full';
        titleFont: 'condensed' | 'titan-one';
        titleEffect: string;
        background: 'reference' | 'starry-sky' | 'image';
        image: string | string[];
    };
    card: HomeCardConfig;
}

export interface PostConfig {
    comment: {
        enabled: boolean;
        repo: string;
        repoId: string;
        category: string;
        categoryId: string;
    };
    sidecar: {
        popular: boolean;
        postsLimit: number;
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

export interface ThemeConfig {
    font: 'serif' | 'sans';
    background: 'grid' | 'none';
    home: HomeConfig;
    footer: FooterConfig;
    post: PostConfig;
    extra: ExtraConfig;
}
