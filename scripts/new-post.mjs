import { runNewContent } from './create-content.mjs';

const usage = `用法：pnpm new-post <文件名>

示例：
  pnpm new-post hello-world
  pnpm new-post notes/hello-world.mdx
  pnpm new-post "我的第一篇文章"

省略扩展名时使用 .md，支持 .md、.mdx 和子目录。`;

runNewContent({
    collection: 'posts',
    label: '文章',
    usage,
    fields: { categories: [], tags: [], pinned: false },
});
