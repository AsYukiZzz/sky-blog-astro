import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { site } from './src/config/site.ts';

export default defineConfig({
    site: process.env.SITE_URL || site.url,
    output: 'static',
    prerenderConflictBehavior: 'error',
    // 接受带或不带末尾 / 的地址，让缺失页面进入自定义 404；静态输出仍采用目录格式。
    trailingSlash: 'ignore',
    devToolbar: { enabled: false },
    integrations: [mdx(), sitemap()],
    vite: { plugins: [tailwindcss()] },
    markdown: {
        shikiConfig: {
            themes: { light: 'github-light', dark: 'github-dark' },
            wrap: true,
        },
    },
});
