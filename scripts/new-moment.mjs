import { runNewContent } from './create-content.mjs';

const usage = `用法：pnpm new-moment <文件名>

示例：
  pnpm new-moment first-moment
  pnpm new-moment daily/first-moment.mdx
  pnpm new-moment "今天的一点记录"

省略扩展名时使用 .md，支持 .md、.mdx 和子目录。`;

const frontmatter = ({ title, slug, publishedAt }) =>
    [
        `title: ${JSON.stringify(title)}`,
        `slug: ${JSON.stringify(slug)}`,
        `publishedAt: ${JSON.stringify(publishedAt)}`,
        `description: ''`,
        `cover: ''`,
        `tags: []`,
        `images: []`,
        `draft: false`,
        `visibility: public`,
    ].join('\n');

await runNewContent({
    collection: 'moments',
    label: '随笔',
    usage,
    frontmatter,
});
