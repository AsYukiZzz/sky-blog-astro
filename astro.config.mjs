import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { site } from './src/config.ts';

// Astro hoists CSS imported by lazy scripts into every page using the runtime.
// The widget's stylesheet is instead owned by src/scripts/sakana-styles.ts.
const sakanaStylesOnDemand = {
    name: 'sakana-styles-on-demand',
    enforce: 'pre',
    resolveId(source, importer) {
        if (
            source === './index.css' &&
            importer
                ?.replaceAll('\\', '/')
                .endsWith('/sakana-widget/lib/index.js')
        )
            return '\0sakana-styles-on-demand';
    },
    load(id) {
        if (id === '\0sakana-styles-on-demand') return 'export {};';
    },
};

export default defineConfig({
    site: process.env.SITE_URL || site.url,
    output: 'static',
    prerenderConflictBehavior: 'error',
    // 接受带或不带末尾 / 的地址，让缺失页面进入自定义 404；静态输出仍采用目录格式。
    trailingSlash: 'ignore',
    devToolbar: { enabled: false },
    integrations: [mdx(), sitemap()],
    vite: { plugins: [tailwindcss(), sakanaStylesOnDemand] },
    markdown: {
        shikiConfig: {
            themes: { light: 'github-light', dark: 'github-dark' },
            wrap: true,
        },
    },
});
