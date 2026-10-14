import { runNewContent } from './create-content.mjs';

const usage = `用法：pnpm new-moment <文件名>

示例：
  pnpm new-moment first-moment
  pnpm new-moment daily/first-moment.mdx
  pnpm new-moment "今天的一点记录"

省略扩展名时使用 .md，支持 .md、.mdx 和子目录。`;

runNewContent({
    collection: 'moments',
    label: '随笔',
    usage,
    fields: { tags: [], images: [] },
});
