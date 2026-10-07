export interface ThemeConfig {
    light: string;
    dark: string;
    themes: string[];
    fonts: { body: 'serif' | 'sans' };
    hero: {
        title: string;
        subtitle: string;
        size: 'compact' | 'full';
        titleFont: 'condensed' | 'titan-one';
        titleEffect: string;
        background: 'reference' | 'starry-sky' | 'image';
        image: string;
    };
    sidebar: readonly ('author' | 'stats' | 'categories' | 'tags' | 'recent')[];
    articlePopular: boolean;
    articlePostsLimit: number;
    listStyle: 'card' | 'list' | 'magazine' | 'minimal';
    background: 'grid' | 'none';
    dock: boolean;
    sakana: {
        enabled: boolean;
        character: 'chisato' | 'takina';
        size: number;
        position: 'left' | 'right';
        offset: { side: number; bottom: number };
        showOnMobile: boolean;
        autoMode: boolean;
    };
    comments: {
        enabled: boolean;
        repo: string;
        repoId: string;
        category: string;
        categoryId: string;
    };
}
