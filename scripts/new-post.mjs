import {
    readConfiguredAuthor,
    runNewContent,
    yamlScalar,
} from './create-content.mjs';

const usage = `用法：pnpm new-post <文件名>

示例：
  pnpm new-post hello-world
  pnpm new-post notes/hello-world.mdx
  pnpm new-post "我的第一篇文章"

省略扩展名时使用 .md，支持 .md、.mdx 和子目录。
生成的 slug 留空，请在构建前手动填写；构建时会校验必填、格式和唯一性。`;

async function frontmatter({ title, publishedAt }) {
    const author = await readConfiguredAuthor();
    return [
        `title: ${yamlScalar(title)}`,
        'slug:',
        'description:',
        `publishedAt: ${publishedAt}`,
        `updatedAt: ${publishedAt}`,
        'cover:',
        `author: ${yamlScalar(author)}`,
        'categories: []',
        'tags: []',
        'pinned: false',
        'draft: false',
        'visibility: public',
    ].join('\n');
}

await runNewContent({
    collection: 'posts',
    label: '文章',
    usage,
    // Leave `slug` empty for the author to fill; the build rejects the blank
    // value instead of deriving an address from the filename.
    checkSlug: false,
    frontmatter,
});
