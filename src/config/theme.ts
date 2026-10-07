import { themeCatalog } from './theme-catalog.ts';
import type { ThemeConfig } from './theme-types.ts';

export type { ThemeConfig } from './theme-types.ts';

export const theme: ThemeConfig = {
    light: 'light',
    dark: 'dark',
    themes: themeCatalog.map((palette) => palette.name),
    fonts: { body: 'serif' },
    hero: {
        title: 'sky blog',
        subtitle: '记录生活，分享思考，探索无限可能',
        size: 'full',
        titleFont: 'condensed',
        titleEffect: 'effect-marker-pop',
        // 与原项目保存的首页预览一致；也可以使用原主题的星空特效或自定义图片。
        background: 'reference',
        image: '',
    },
    sidebar: ['author', 'stats', 'categories', 'tags', 'recent'],
    articlePopular: true,
    articlePostsLimit: 5, // 侧栏上限为 5，实际条数按可用高度计算；展开后查看完整列表。
    listStyle: 'magazine',
    background: 'grid',
    dock: true,
    sakana: {
        enabled: true, // 仅在首页展示石蒜挂件。
        character: 'chisato',
        size: 200, // 桌面尺寸，单位 px；限制在 120–320 之间。
        position: 'right',
        offset: { side: 24, bottom: 24 }, // 距离屏幕侧边与底部，单位 px。
        showOnMobile: false, // 开启时缩小显示，并避开底部 Dock。
        autoMode: false, // 默认托管模式；访客也可使用挂件上的按钮切换。
    },
    comments: {
        enabled: false,
        repo: '',
        repoId: '',
        category: 'Announcements',
        categoryId: '',
    },
} satisfies ThemeConfig;
