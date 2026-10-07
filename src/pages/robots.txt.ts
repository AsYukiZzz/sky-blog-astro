import type { APIContext } from 'astro';
import { site } from '../config/site';
export function GET(context: APIContext) {
    return new Response(
        `User-agent: *\nAllow: /\nSitemap: ${new URL('/sitemap-index.xml', context.site ?? site.url).href}\n`,
        { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
}
