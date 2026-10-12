export const site = {
    title: 'Sky Blog',
    subtitle: '记录生活，分享热爱。',
    description:
        '关于代码、设计和生活的个人博客。把日常的灵感，写成值得留下的故事。',
    url: 'https://example.com',
    language: 'zh-CN',
    timezone: 'Asia/Shanghai',
    pageSize: 6,
    author: 'sky',
    copyrightYear: 2026,
    startedAt: '', // 建站日期 YYYY-MM-DD；留空时运营天数显示 —，当天计为第 1 天。
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
        { label: '随笔', href: '/moments/', icon: 'sparkles' },
        { label: '朋友', href: '/links/', icon: 'users' },
    ],
    footer: {
        copyrightOwner: '', // 留空时使用站点名称。
        icp: '',
        publicSecurity: { text: '', url: '' }, // 公安备案号与官方查询链接；留空则隐藏。
        provider: {
            name: 'Cloudflare Pages',
            description: '提供托管与 CDN 服务',
            url: 'https://pages.cloudflare.com/',
        }, // 按实际部署服务商修改；name 留空则隐藏。
        theme: {
            name: 'Sky Theme',
            url: 'https://github.com/sky121666/halo-theme-sky-blog-1',
        },
        privacyUrl: '/pages/privacy/',
        termsUrl: '/pages/terms/',
        sitemapUrl: '/sitemap/', // 供读者浏览的地图页；构建时另生成 sitemap-index.xml。
        rssUrl: '/feed.xml',
        showLoadTime: true,
    },
};
