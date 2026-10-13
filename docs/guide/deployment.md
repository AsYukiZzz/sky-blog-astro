# 部署指南

适用于 Cloudflare Pages 和其他静态托管平台。站点与主题设置见 [配置说明](configuration.md)，内容维护见 [内容发布](content.md)。

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

## 3 浏览器检查

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
