# 部署指南

适用于 Cloudflare Pages、Workers Static Assets 和其他静态托管平台。站点与主题设置见 [配置说明](configuration.md)，内容维护见 [内容发布](content.md)。

## 1 运行环境

Node.js 版本与 [.node-version](../../.node-version) 保持一致，pnpm 版本与 [package.json](../../package.json) 的 `packageManager` 保持一致。Cloudflare Pages 使用 `NODE_VERSION`、`PNPM_VERSION` 设置对应版本。

影响范围：

- 依赖安装和构建时使用的运行环境。

## 2 构建与部署

在项目根目录执行：

```sh
pnpm install
pnpm build
pnpm preview
```

构建会检查类型、生成静态页面和搜索索引，并校验产物。预览服务可用于检查页面与搜索功能。

托管平台填写构建命令 `pnpm build`，输出目录为 `dist`；手动部署时上传 `dist/` 中的文件。使用文章的 `legacyPath` 时，平台需要支持生成的 `_redirects` 跳转规则。

`SITE_URL` 填写带协议的正式站点根地址；留空时使用 `site.url`。更换域名或更新内容后需重新构建和部署。

影响范围：

- 发布的页面、资源和搜索索引。
- 页面地址、RSS、网站地图及 robots 中的绝对地址。
- 旧文章地址的跳转。

## 3 页面缓存与预取

构建会在 `dist/_headers` 中为本次实际发布的公开页面生成精确路径规则：`public, max-age=60, s-maxage=60`。浏览器可在一分钟新鲜期内复用 Astro 的悬停预取和已访问页面；过期后仍按 HTTP 验证更新，发布内容可能最多保留这一分钟的旧副本。查询参数保留为不同缓存键，锚点仍由原生导航处理。

默认 `no-cache` 和现有资源策略继续保留：哈希资源长期缓存，未版本化的搜索入口需验证。404 和未发布路径不会生成页面缓存规则。不要用 `/posts/*` 等宽泛规则替代生成列表，以免给不存在页面附加成功页面的新鲜度。自定义的路径缓存规则会优先保留，可在 `public/_headers` 中为特定页面或目录设置 `no-cache` / `no-store`。

自动规则适用于所有域名，因此手写的预览域等绝对地址限制也会保护相同路径；这些路径不会再自动生成缓存规则。自定义全局 `no-store` 等策略也会保留。

Cloudflare 的 `_headers` 最多允许 100 条规则。构建会保留手写规则，再按地址顺序生成页面规则；超出容量时输出提示，剩余页面继续使用默认验证策略。大站点可在实际托管平台配置仅针对公开成功 HTML 的缓存规则。[Cloudflare 静态资源响应头说明](https://developers.cloudflare.com/workers/static-assets/headers/)

上述文件由支持 `_headers` 的静态托管平台执行，`astro preview` 本身不会模拟这些头。若请求由自定义 Worker 或 SSR 代码生成，需要在对应响应中设置缓存策略；已有外层 CDN 也需遵循相同新鲜度，部署后检查实际响应和更新行为。[Workers 响应头适用范围](https://developers.cloudflare.com/workers/static-assets/headers/#custom-headers)

## 4 浏览器检查

运行浏览器回归检查前，先安装 Playwright 的 Chromium 并构建网站：

```sh
pnpm exec playwright install chromium
pnpm build
pnpm test:browser
```

`PLAYWRIGHT_BROWSER_CHANNEL` 可指定已安装的浏览器，未设置时使用 Playwright 的 Chromium。Windows 使用 Edge 时，在 PowerShell 中先设置：

```powershell
$env:PLAYWRIGHT_BROWSER_CHANNEL = 'msedge'
```

影响范围：

- 浏览器回归检查使用的浏览器。
