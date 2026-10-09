# Sky Blog Theme · Astro

基于 Astro 的静态博客主题，移植自 [Sky Blog](https://github.com/sky121666/halo-theme-sky-blog-1)。使用 Markdown/MDX、Tailwind CSS、DaisyUI 和 Pagefind，可部署到 Cloudflare Pages。

- 响应式首页卡片、35 种配色、明暗切换与悬浮 Dock。
- 文章、随笔、独立页面、分类、标签、友链和项目展示。
- 文章目录、阅读进度、图片预览和中英文站内搜索。
- RSS、网站地图，可选 Giscus 评论和 Sakana 挂件。

## 快速开始

使用 Node.js 24.14.0 和 pnpm 11.22.0：

```sh
pnpm install
pnpm dev
```

构建并预览：

```sh
pnpm build
pnpm preview
```

搜索索引随构建生成，请在 `pnpm preview` 下验证搜索功能。

## 配置

| 文件                                                         | 用途                                                                         |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| [src/config/site.ts](src/config/site.ts)                     | 站点名称、域名、导航、联系方式、页脚和时区                                   |
| [src/config/theme.ts](src/config/theme.ts)                   | 配色、首屏、侧栏、Sakana 挂件和 Giscus 评论                                  |
| [src/config/home.ts](src/config/home.ts)                     | 首页布局与禁用卡片；完整模板见 [home-presets.ts](src/config/home-presets.ts) |
| [src/data/authors.jsonc](src/data/authors.jsonc)             | 作者资料                                                                     |
| [src/data/links.jsonc](src/data/links.jsonc)                 | 友链                                                                         |
| [src/data/projects.jsonc](src/data/projects.jsonc)           | 首页项目展示，名称、简介和仓库或网站链接                                     |
| [src/data/popular-posts.jsonc](src/data/popular-posts.jsonc) | 精选文章的 slug 列表                                                         |

数据文件使用 JSONC，支持 `//` 行注释、`/* */` 块注释和末尾逗号。友链的 `logo` 可省略或设为空串，会显示默认占位图标。

项目通过 `src/data/projects.jsonc` 配置 `name`、`description`、`url` 和可选的 `logo`，链接支持 HTTP/HTTPS 仓库或网站地址，点击项目会在新标签页打开。`logo` 支持本地路径或远程图片链接，省略、设为空串或 `null` 时使用项目专用默认图标 `/images/project-default.svg`；图片加载失败也会回退到这张默认图。全部项目按数组顺序展示，内容较多时在卡片内滚动；空数组显示空状态。wide 的项目卡片以 2×3 位于左下角，友链卡片以 4×3 位于右下角；medium 的两张卡片均为 4×3，compact 均为 2×3。

上线前替换示例内容、作者资料和图片，并修改站点域名。Giscus 默认关闭；启用时填写 `theme.comments` 中的仓库及分类信息。

## 写作

文章放在 `src/content/posts/`，独立页面放在 `src/content/pages/`，随笔放在 `src/content/moments/`。支持 Markdown 和 MDX，文章示例：

```markdown
---
title: 我的文章
slug: notes/my-post
publishedAt: 2026-10-01T09:00:00+08:00
author: sky
categories: [development]
tags: [astro]
draft: false
visibility: public
---

正文从这里开始。
```

分类和标签会从公开文章的 `categories` 和 `tags` 自动收集、去重，并生成归档页。显示名称直接使用文章中填写的值，按文章中的首次出现顺序排列，无需额外配置。分类、标签和 slug 均支持中文和嵌套路径，作者 ID 仍需在 `src/data/authors.jsonc` 中登记。

省略 `author` 时使用 `src/config/site.ts` 中的 `site.author`，该 ID 也必须在作者表中登记。分类、标签分页通常使用 `/page/2/`；如果该地址已被嵌套名称占用，对应归档的分页改用 `/@page/2/`，嵌套名称的地址保持不变。

草稿、非公开内容和未来发布内容不会进入页面、分类标签汇总、RSS、搜索、统计或正文样式产物，未来内容到期后需重新构建。

`public/` 中的文件始终公开。需要随文章控制发布的图片放在 `src/assets/`，在正文中使用相对路径引用。内容的发布设置不会阻止 Git 提交，请勿向公开仓库提交真实私密内容。

## 部署

Cloudflare Pages 使用以下设置：

| 设置           | 值                                               |
| -------------- | ------------------------------------------------ |
| 构建命令       | `pnpm build`                                     |
| 输出目录       | `dist`                                           |
| `NODE_VERSION` | `24.14.0`                                        |
| `PNPM_VERSION` | `11.22.0`                                        |
| `SITE_URL`     | 正式 HTTPS 域名，例如 `https://blog.example.com` |

未设置 `SITE_URL` 时使用 `src/config/site.ts` 的 `url`。项目为纯静态输出，不需要 SSR 适配器；也可将 `dist/` 部署到其他静态托管服务。评论使用独立的 Giscus 服务。

## 检查

```sh
pnpm check
pnpm test
pnpm format:check
```

每次提交前必须先执行 `pnpm format`，再执行 `pnpm format:check`，两条命令均成功且格式检查无误后才能提交。检查通过后若又修改了待提交文件，需重新执行这两条命令。

浏览器回归需先构建并安装测试浏览器：

```sh
pnpm exec playwright install chromium
pnpm build
pnpm test:browser
```

Windows 可设置 `$env:PLAYWRIGHT_BROWSER_CHANNEL = 'msedge'` 使用已安装的 Edge。

## 许可证

本项目保留原主题的 [GPL-3.0 许可证](LICENSE)，原作者为 sky。

Sakana 使用 [dsrkafuu/sakana-widget](https://github.com/dsrkafuu/sakana-widget)，接入参考 [Lentinel 的 Halo 插件](https://github.com/Lentinel/plugin-Sakana-widget-Halo)。其代码采用 MIT 许可证，内置角色插画由大伏アオ（[@blue00f4](https://twitter.com/blue00f4)）创作，仅允许非商业使用。详见 [署名及许可说明](public/licenses/sakana-widget.txt)。
