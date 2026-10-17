# Sky Blog Theme · Astro

以响应式卡片首页为核心的静态个人博客主题，基于 [Astro](https://astro.build) 和 Tailwind CSS，参考 [Sky Blog](https://github.com/sky121666/halo-theme-sky-blog-1) 的设计。

[配置说明](docs/guide/configuration.md) · [内容发布](docs/guide/content.md) · [部署指南](docs/guide/deployment.md)

## ✨ 功能特性

- **卡片式首页**：作者资料、统计、热力图、文章、随笔、项目与友链组合展示。
- **响应式网格**：卡片按屏幕空间重排，支持不同占格规格和显示组合。
- **阅读体验**：文章目录、阅读进度、图片预览、明暗切换与页面过渡。
- **内容组织**：Markdown / MDX、独立页面、分类、标签及随笔。
- **静态搜索**：Pagefind 中英文站内搜索、RSS 和网站地图。
- **可选功能**：Giscus 评论、Sakana 挂件与悬浮快捷 Dock。

## 🧩 首页卡片布局

首页由封面和卡片区组成。封面展示博客标题与介绍，卡片区将个人资料、写作动态和作品放在同一页，让读者从多个入口浏览博客。

宽屏下，卡片以不同大小并排组合；窗口变窄时逐步重排，手机上依次叠放。卡片宽度随容器变化，占格规格控制高度与内部展示：文章卡片可展示更多摘要，友链与项目卡片可适配不同列数。

可以选择显示哪些卡片、调整排列与受支持的尺寸，并分别设置不同宽度下的布局。详细参数和约束见 [首页卡片配置](docs/guide/configuration.md#322-卡片themehomecard)。

## 🚀 快速开始

使用 Node.js **24.14.0** 和 pnpm **11.22.0**。

1. Fork 或克隆本仓库，进入项目目录。
2. 安装依赖并启动开发服务：

    ```sh
    pnpm install
    pnpm dev
    ```

3. 编辑 `src/config.ts` 自定义博客，字段说明见 [配置说明](docs/guide/configuration.md)。
4. 执行 `pnpm new-post first-post` 创建文章，或执行 `pnpm new-moment first-moment` 创建随笔。独立页面放在 `src/content/pages/` 中，在 `src/data/` 中维护友链、项目和精选文章，具体说明见 [内容发布](docs/guide/content.md)。
5. 构建并预览网站：

    ```sh
    pnpm build
    pnpm preview
    ```

搜索索引随构建生成，请在预览服务中验证搜索功能。

## ☁️ 部署

将构建产物 `dist/` 部署到 Cloudflare Pages 或其他静态托管平台。运行版本、站点域名和部署参数见 [部署指南](docs/guide/deployment.md)。

## ⚡ 常用命令

在项目根目录执行：

- `pnpm install`：安装依赖。
- `pnpm hooks:install`：手动启用提交消息检查钩子（默认不安装）。
- `pnpm dev`：启动本地开发服务。
- `pnpm new-post <文件名>`：创建文章，自动生成元信息，支持 `.md`、`.mdx` 和子目录。
- `pnpm new-moment <文件名>`：创建随笔，自动生成元信息，支持 `.md`、`.mdx` 和子目录。
- `pnpm build`：检查类型、构建网站、生成搜索索引并校验产物。
- `pnpm preview`：预览构建产物。
- `pnpm check`：运行 Astro 类型检查。
- `pnpm test`：运行单元测试。
- `pnpm format`：统一代码格式。
- `pnpm format:check`：检查代码格式。

每次提交前依次执行 `pnpm format`、`pnpm format:check`；检查通过后又修改文件时，需要重新执行。

浏览器回归检查及浏览器通道设置见 [部署指南](docs/guide/deployment.md#3-浏览器检查)。

## 📄 致谢与许可

本项目保留原主题的 [GPL-3.0 许可证](LICENSE)，原作者为 sky。

Sakana 使用 [dsrkafuu/sakana-widget](https://github.com/dsrkafuu/sakana-widget)，接入参考 [Lentinel 的 Halo 插件](https://github.com/Lentinel/plugin-Sakana-widget-Halo)。代码采用 MIT 许可证，角色插画由大伏アオ（[@blue00f4](https://twitter.com/blue00f4)）创作，仅允许非商业使用。详见 [署名及许可说明](public/licenses/sakana-widget.txt)。
