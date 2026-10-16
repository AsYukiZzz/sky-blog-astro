# 内容发布

文章、独立页面和随笔使用 Markdown（`.md`）或 MDX（`.mdx`）。两个 `---` 包裹的 YAML 是元信息（Frontmatter），用来设置标题、地址、日期等；

以下示例可作为新内容的起点。元信息字段以 [内容模型](../../src/content.config.ts) 为准，站主资料和主题设置见 [配置说明](configuration.md)。

## 1 文章

### 1.1 创建文章

在项目根目录执行以下命令，自动在 `src/content/posts/` 中创建文章：

```sh
pnpm new-post first-post
pnpm new-post notes/first-post.mdx
pnpm new-post "我的第一篇文章"
```

省略扩展名时使用 `.md`；指定 `.md` 或 `.mdx` 时使用对应格式，并自动创建子目录。命令不会覆盖已有文章，同名的 `.md` 和 `.mdx` 文件也会视为重复。创建前还会检查当前文章目录中已有内容的实际 `slug`，即使文件名不同，也不会创建地址相同的文章。运行 `pnpm new-post --help` 查看用法。

生成的元信息包含标题、`slug`、当前发布时间、空摘要和封面、空分类和标签，以及 `pinned: false`、`draft: false`、`visibility: public`。标题取输入中不带扩展名的文件名；文件路径和 `slug` 保留中文和子目录，将空格等不适合地址的字符替换为连字符。例如 `pnpm new-post "hello world"` 创建 `hello-world.md`，标题为 `hello world`，`slug` 为 `hello-world`。写作期间可将 `draft` 改为 `true`，完成后再改回 `false`。

也可以手动新建 `.md` 或 `.mdx` 文件。文件名用于组织内容，访问地址由 `slug` 决定。下面的示例地址是 `/posts/notes/first-post/`。

```markdown
---
title: 我的第一篇文章
slug: notes/first-post
publishedAt: '2024-01-01T09:00:00+08:00'
updatedAt: '2024-01-02T09:00:00+08:00'
description: 这篇文章的摘要。
cover: /images/dusk.svg
categories: [开发]
tags: [Astro, 博客]
pinned: false
draft: false
visibility: public
copyright:
    type: original
    license: CC BY-NC-SA 4.0
---

## 正文标题

从这里开始写文章正文。
```

`title`、`slug`、`publishedAt` 必填，其他字段可按需省略。正文通常从二级标题开始，文章标题由 `title` 生成。

### 1.2 元信息字段

| 字段                | 解释                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| `title`             | 文章标题，必填。                                                                                   |
| `slug`              | 访问地址标识，决定 `/posts/{slug}/`，必填。                                                        |
| `publishedAt`       | 发布时间，必填。                                                                                   |
| `updatedAt`         | 更新日期，用于文章详情显示和页面元信息。                                                           |
| `description`       | 文章摘要和页面描述，也用于 RSS 简介。                                                              |
| `cover`             | 封面图片地址，用于文章头图、列表和分享。                                                           |
| `author`            | 作者 ID，须与站主 `author.id` 一致；省略时使用站主。                                               |
| `categories`        | 分类数组，自动生成分类归档。                                                                       |
| `tags`              | 标签数组，自动生成标签归档。                                                                       |
| `pinned`            | 是否在分类、标签、作者和分页文章列表中置顶。                                                       |
| `draft`             | 是否为草稿，`true` 时不发布。                                                                      |
| `visibility`        | 可见性：`public` 公开，`private`、`restricted` 不发布。                                            |
| `legacyPath`        | 旧文章地址，构建时生成到本篇文章的 301 跳转。                                                      |
| `copyright`         | 版权声明配置对象。                                                                                 |
| `copyright.type`    | 声明类型：`original` 原创、`repost` 转载、`ai` AI 辅助、`derivative` 二次创作、`custom` 创作声明。 |
| `copyright.license` | 许可协议文字。                                                                                     |
| `copyright.source`  | 来源链接，使用 HTTP/HTTPS 地址。                                                                   |
| `copyright.note`    | 自定义声明，填写后替代许可说明。                                                                   |

## 2 随笔

### 2.1 创建随笔

在项目根目录执行以下命令，自动在 `src/content/moments/` 中创建随笔：

```sh
pnpm new-moment first-moment
pnpm new-moment daily/first-moment.mdx
pnpm new-moment "今天的一点记录"
```

省略扩展名时使用 `.md`，支持 `.md`、`.mdx` 和子目录。命令自动生成标题、`slug`、当前发布时间、空摘要和封面、空标签和图片数组（`images: []`），以及 `draft: false`、`visibility: public`。命名、草稿和重复文件保护规则与文章命令一致；运行 `pnpm new-moment --help` 查看用法。

也可以手动新建 `.md` 或 `.mdx` 文件。下面的示例地址是 `/moments/daily/first-moment/`。随笔也需要标题，正文可以直接写简短文字。

```markdown
---
title: 今天的一点记录
slug: daily/first-moment
publishedAt: '2024-01-01T18:00:00+08:00'
description: 傍晚散步时拍了两张照片。
cover: /images/forest.svg
tags: [日常, 摄影]
images:
    - /images/forest.svg
    - /images/mist.svg
draft: false
visibility: public
---

傍晚出去走了走，留下今天的一点记录。
```

`title`、`slug`、`publishedAt` 必填，其他字段可按需省略。

### 2.2 元信息字段

| 字段          | 解释                                                    |
| ------------- | ------------------------------------------------------- |
| `title`       | 随笔标题，用于列表、浏览器标签页和搜索，必填。          |
| `slug`        | 访问地址标识，决定 `/moments/{slug}/`，必填。           |
| `publishedAt` | 发布时间，必填。                                        |
| `updatedAt`   | 可记录更新时间，随笔详情页只展示发布时间。              |
| `description` | 随笔摘要和页面描述，首页随笔卡片优先展示此内容。        |
| `cover`       | 随笔列表封面，省略时取 `images` 中的图片。              |
| `author`      | 作者 ID，须与站主 `author.id` 一致；省略时使用站主。    |
| `tags`        | 文字标签数组，只展示标签，不生成文章标签归档。          |
| `images`      | 图片地址数组，按顺序生成画廊，第一张用于分享。          |
| `draft`       | 是否为草稿，`true` 时不发布。                           |
| `visibility`  | 可见性：`public` 公开，`private`、`restricted` 不发布。 |

## 3 独立页面

### 3.1 创建独立页面

在 `src/content/pages/` 中创建 `.md` 或 `.mdx` 文件，适合关于、隐私政策、使用条款等内容。例如：

```markdown
---
title: 关于本站
slug: about
publishedAt: '2024-01-01T09:00:00+08:00'
description: 本站的介绍。
---

在这里介绍博客与站主。
```

地址为 `/pages/about/`。需要菜单或页脚入口时，在 `src/config.ts` 中配置对应页面地址。

### 3.2 元信息字段

| 字段          | 解释                                                    |
| ------------- | ------------------------------------------------------- |
| `title`       | 页面标题，必填。                                        |
| `slug`        | 访问地址标识，决定 `/pages/{slug}/`，必填。             |
| `publishedAt` | 发布时间，决定发布时机，必填。                          |
| `updatedAt`   | 可记录更新时间，页面布局不展示日期。                    |
| `description` | 页面描述，用于分享信息和搜索引擎。                      |
| `cover`       | 页面分享图片地址。                                      |
| `author`      | 作者 ID，须与站主 `author.id` 一致；省略时使用站主。    |
| `draft`       | 是否为草稿，`true` 时不发布。                           |
| `visibility`  | 可见性：`public` 公开，`private`、`restricted` 不发布。 |

## 4 友链、项目与精选文章

列表文件位于 `src/data/`，使用 JSONC 数组，支持注释；`pnpm format` 会移除 JSONC 的尾随逗号。

### 4.1 友链

文件：[links.jsonc](../../src/data/links.jsonc)。按数组顺序展示，首页显示部分友链，`/links/` 朋友页展示全部。

```jsonc
[
    {
        "name": "示例博客",
        "description": "分享日常与技术。",
        "url": "https://example.com",
        "logo": "/images/friend-default.webp",
    },
]
```

| 字段          | 解释                                              |
| ------------- | ------------------------------------------------- |
| `name`        | 网站名称，必填。                                  |
| `description` | 网站简介，必填，可留空。                          |
| `url`         | 网站链接，使用完整的 HTTP/HTTPS 地址。            |
| `logo`        | 网站图标地址；省略、`null` 或留空时使用默认图标。 |

### 4.2 项目

文件：[projects.jsonc](../../src/data/projects.jsonc)。按数组顺序展示在首页项目卡片中，点击后在新标签页打开。

```jsonc
[
    {
        "name": "示例项目",
        "description": "一个用于记录灵感的工具。",
        "url": "https://example.com/project",
        "logo": "/images/project-default.svg",
    },
]
```

| 字段          | 解释                                                       |
| ------------- | ---------------------------------------------------------- |
| `name`        | 项目名称，必填且不能为空。                                 |
| `description` | 项目简介，必填，可留空。                                   |
| `url`         | 项目仓库或网站链接，使用 HTTP/HTTPS 地址。                 |
| `logo`        | 项目图标地址；省略、`null`、留空或加载失败时使用默认图标。 |

### 4.3 精选文章

文件：[popular-posts.jsonc](../../src/data/popular-posts.jsonc)。维护首页精选卡片和文章推荐区的内容，显示数量由卡片规格或侧栏设置决定。

```jsonc
["format-example"]
```

| 字段   | 解释                                                                             |
| ------ | -------------------------------------------------------------------------------- |
| 数组项 | 文章 `slug` 字符串，按数组顺序展示；重复项保留首项，不存在或未公开的文章会跳过。 |

### 4.4 专栏

文件：[columns.jsonc](../../src/data/columns.jsonc)。在导航栏点击“专栏”进入 `/columns/`，选择“全部”查看专栏总览，标题右下角显示专栏总数，下方显示“共 n 个专栏”。具体专栏页的标题为“专栏：名称”，右下角显示该专栏已公开文章的总数，各分页保持相同统计。专栏介绍显示在选择按钮下方，文章列表位于介绍之后。

```jsonc
[
    {
        "slug": "theme-guide",
        "name": "主题使用指南",
        "description": "围绕主题写作与使用的示例文章。",
        "cover": "/images/mist.svg",
        "posts": ["format-example"],
    },
]
```

| 字段          | 解释                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `slug`        | 必填，唯一的专栏地址标识，例如 `theme-guide` 对应 `/columns/theme-guide/`。支持中文、字母、数字和 `_~.-`，不允许 `/`、`.` 或 `..`。 |
| `name`        | 必填，专栏名称，去除首尾空白后不能为空。                                                                                            |
| `description` | 专栏描述，省略时为空；按纯文本展示。                                                                                                |
| `cover`       | 专栏封面，使用站内绝对路径或完整 HTTP/HTTPS 地址；省略或留空时使用 `/images/mist.svg`。                                             |
| `posts`       | 必填的文章 `slug` 数组，可以为空。填写文章 Frontmatter 的 `slug`，例如 `notes/first-post`，不填写文件名或完整访问地址。             |

专栏总览按顶层数组顺序排列，目录和具体专栏中的文章严格按 `posts` 数组顺序排列。调整顺序时直接移动数组元素；文章日期和置顶状态不会影响专栏内的顺序。文章列表按 `site.pageSize` 分页，第二页起使用 `/columns/{slug}/page/{n}/`。

一篇文章最多出现在一个专栏中，文章 Frontmatter 无须增加字段。专栏标识重复、文章重复引用、跨专栏归属或引用不存在的文章时，构建会报错并指出专栏和相关引用。修改专栏名称不会改变其访问地址。

可以提前配置已经存在的草稿、非公开文章或未来发布的文章。目录、列表及文章计数只包含构建时已公开的文章，并保留它们在配置中的相对顺序；未来文章到期后需重新构建。专栏总数包含所有已配置的专栏，尚无公开文章的专栏会显示“暂无已公开文章”。使用空数组 `[]` 可以清空专栏，总览仍可访问。

## 5 预览、发布与图片

保存文件后运行 `pnpm dev` 预览。内容需同时满足 `draft: false`、`visibility: public`、`publishedAt` 不晚于构建时间，才会生成页面并进入相应列表、搜索与统计；RSS 收录公开文章。

草稿、非公开内容和未来发布内容会被排除。未来内容到期后需重新构建，正式发布步骤见 [部署指南](deployment.md)。

`cover`、`images` 和 `logo` 填写图片访问地址。本地图片放在 `public/` 下，例如 `public/images/photo.webp` 对应 `/images/photo.webp`；远程图片使用完整 HTTP/HTTPS URL。

`public/` 中的文件会始终复制到发布目录。正文图片需要随内容控制发布时，放在 `src/assets/` 中，并在正文中使用相对路径引用。

影响范围：

- 构建后可访问的页面、内容索引和资源。
