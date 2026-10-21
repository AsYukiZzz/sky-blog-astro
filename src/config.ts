import type { AuthorConfig, SiteConfig, ThemeConfig } from './types/config';

export const site: SiteConfig = {
    title: 'Sky Blog',
    subtitle: '记录生活，分享热爱。',
    description:
        '关于代码、设计和生活的个人博客。把日常的灵感，写成值得留下的故事。',
    url: 'https://example.com',
    language: 'zh-CN',
    timezone: 'Asia/Shanghai',
    pageSize: 6,
    copyrightYear: 2026,
    startedAt: '',
    navigation: [
        { label: '首页', href: '/', icon: 'home' },
        {
            label: '文章',
            href: '/archives/',
            icon: 'document',
            children: [
                { label: '文章归档', href: '/archives/' },
                { label: '文章分类', href: '/categories/' },
                { label: '文章标签', href: '/tags/' },
            ],
        },
        { label: '专栏', href: '/columns/', icon: 'book' },
        { label: '随笔', href: '/moments/', icon: 'sparkles' },
        { label: '朋友', href: '/links/', icon: 'users' },
    ],
};

export const author: AuthorConfig = {
    id: 'sky',
    name: 'Sky',
    bio: '一名开发者，也是一名生活观察者。',
    avatar: '/images/avatar.svg',
    location: '地球',
    description: '你好，我是 Sky。',
    role: '开发者 · 生活观察者',
    interests: ['代码', '设计', '生活'],
    social: [
        { label: '电子邮箱', href: '', icon: 'mail' },
        { label: 'Bilibili', href: '', icon: 'bilibili' },
        {
            label: 'GitHub',
            href: 'https://github.com/AsYukiZzz',
            icon: 'github',
        },
        { label: '微信', href: '', icon: 'wechat' },
        { label: 'QQ', href: '', icon: 'message' },
        { label: 'Telegram', href: '', icon: 'telegram' },
        { label: '知乎', href: '', icon: 'zhihu' },
        { label: 'X', href: '', icon: 'x' },
    ],
};

export const theme: ThemeConfig = {
    font: 'serif',
    background: 'grid',
    home: {
        hero: {
            title: 'sky blog',
            subtitle: '记录生活，分享思考，探索无限可能',
            size: 'full',
            titleFont: 'condensed',
            titleEffect: 'effect-marker-pop',
            background: 'reference',
            // 图片模式可填写单个路径或路径数组，每次进入首页随机显示一张。
            image: '',
        },
        card: {
            preset: 'default',
        },
    },
    footer: {
        copyrightOwner: '',
        icp: '',
        publicSecurity: { text: '', url: '' },
        providers: [
            {
                name: 'Cloudflare Pages',
                description: '提供托管与 CDN 服务',
                url: 'https://pages.cloudflare.com/',
            },
        ],
        theme: {
            name: 'Sky Theme',
            url: 'https://github.com/AsYukiZzz/sky-blog-astro',
        },
        privacyUrl: '/pages/privacy/',
        termsUrl: '/pages/terms/',
        sitemapUrl: '/sitemap/',
        rssUrl: '/feed.xml',
        showLoadTime: true,
    },
    post: {
        comment: {
            enabled: false,
            repo: '',
            repoId: '',
            category: 'Announcements',
            categoryId: '',
        },
    },
    extra: {
        sakana: {
            enabled: true,
            character: 'chisato',
            size: 200,
            position: 'right',
            offset: { side: 24, bottom: 24 },
            showOnMobile: false,
            autoMode: false,
        },
        dock: true,
    },
};
