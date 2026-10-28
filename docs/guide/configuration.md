# 配置项说明

配置入口是 [src/config.ts](../../src/config.ts)，分为 `site`、`author`、`theme` 三组。下文的字段名相对于所在分组；类型见 [src/types/config.ts](../../src/types/config.ts)。修改后需重新构建和部署，步骤见 [部署指南](deployment.md)。

内容与列表数据的维护方式见 [内容发布](content.md)。

站内地址以 `/` 开头，外部地址使用完整 URL。本地图片路径相对于 `public/`，例如 `/images/profile.webp`；图标名见 [Icon.astro](../../src/components/Icon.astro)。

## 1 站点（`site`）

### 1.1 名称与介绍

`title` 是站点名称，`subtitle` 是没有独立页面标题时使用的标签页副标题。首页封面文字在 `theme.home.hero` 中单独设置。

`description` 提供通用页面简介；页面填写自己的描述时，会覆盖它。页脚的版权名称未填写时，使用 `title`。

影响范围：

- 顶部导航、移动菜单和浏览器标签页。
- 页面描述、分享信息、结构化数据及 RSS。
- 版权名称留空时的页脚文字。

### 1.2 地址与语言

`url` 填写带协议的正式站点根地址。构建时，如果环境变量 `SITE_URL` 非空，会优先使用环境变量。

`language` 设置文档语言和日期、数字的格式，使用有效语言标签，如 `en-US`。按钮文案和评论语言另行维护。

影响范围：

- 页面地址声明、分享图片地址、RSS、机器网站地图和 robots。
- HTML 语言声明、通用日期显示、字数格式及 RSS 语言。

### 1.3 日期、分页与统计

`timezone` 设置日期显示和统计的时区，使用 IANA 时区名，如 `UTC`、`Europe/London`。

`pageSize` 设置分页列表每页条数，必须为正整数。首页卡片的预览数量按卡片规格确定。

`copyrightYear` 是版权起始年，使用整数年份；跨年后显示起始年到当年的区间。

`startedAt` 是建站日期，使用有效的 `YYYY-MM-DD`，年份不能为 `0000`。当天计第 1 天，留空或无效时显示 `—`，未来日期显示 `0`。

影响范围：

- 日期、月份归档和写作热力图。
- 分类、标签、作者归档及 `/page/` 文章列表的分页。
- 首页统计卡片的运营天数和全站页脚版权年份。

### 1.4 导航（`site.navigation`）

导航按数组顺序排列，设为 `[]` 可移除自定义入口。每项用 `label` 设置名称、`href` 设置目标地址、`icon` 设置图标。

`children` 是可选的子导航数组。子项用 `children[].label` 和 `children[].href` 设置名称与地址。无需子菜单时省略 `children`，空数组仍会生成桌面下拉结构。

有子菜单时，桌面主项用于展开，移动端主项仍可跳转。站内高亮按路径精确匹配，地址末尾的 `/` 应与目标页面一致。

影响范围：

- 桌面导航和下拉菜单。
- 移动菜单和子导航。
- 供读者浏览的网站地图链接。

## 2 站主（`author`）

本站使用唯一作者资料。文章、随笔和独立页面省略内容中的 `author` 时，使用这里的 `id`。

### 2.1 个人资料

`id` 是作者的地址与内容引用标识。各路径段仅含字母、数字和 `_~.-`，可用 `/` 分级，路径段不能为空、`.` 或 `..`。修改后须同步内容中的显式作者引用，作者页地址也会改变。

`name` 是显示姓名，`bio` 是个人简介，`avatar` 是头像。这三项和 `id` 必填，其余资料可省略。

`location` 显示所在地，留空或全为空白时隐藏。`description` 是简介上方的补充介绍，`role` 是姓名下方的身份说明，留空时隐藏。`interests` 是按数组顺序显示的兴趣标签，空数组时隐藏。

影响范围：

- 首页作者卡片的资料、头像和兴趣标签。
- 文章及随笔署名、头像和作者链接。
- 作者归档地址、标题、描述及文章结构化数据中的作者姓名。

### 2.2 联系方式（`author.social`）

联系方式可省略或设为 `[]`。每项用 `label` 设置入口名称、`href` 设置联系地址、`icon` 设置图标。

邮箱地址使用 `mailto:`；也可填写个人主页、联系页面或二维码图片地址，图片会作为链接打开。HTTP/HTTPS 地址在新标签页打开。

`href` 留空或全为空白时隐藏该项，完全相同的地址只保留首项。没有有效地址时，整个联系方式区域隐藏。

影响范围：

- 首页作者卡片底部的联系入口、悬浮提示和跳转目标。

## 3 主题（`theme`）

完整默认配置如下；各字段的含义与修改方法见后续小节。

<details>
<summary>展开完整 theme 配置</summary>

```json
{
    "global": {
        "font": "serif",
        "loading": {
            "strategy": "wallpaper",
            "maxWait": 3000
        },
        "background": {
            "type": "solid",
            "wallpapers": [],
            "position": "center"
        },
        "appearance": {
            "glass": {
                "blur": 32,
                "saturation": 1.3,
                "opacity": {
                    "light": 0.72,
                    "dark": 0.65
                }
            }
        }
    },
    "home": {
        "hero": {
            "size": "full",
            "default": {
                "title": "sky blog",
                "subtitle": "记录生活，分享思考，探索无限可能",
                "position": "bottom-left"
            },
            "byWallpaper": {}
        },
        "card": {
            "preset": "default"
        }
    },
    "footer": {
        "copyrightOwner": "",
        "icp": "",
        "publicSecurity": {
            "text": "",
            "url": ""
        },
        "providers": [
            {
                "name": "Cloudflare Pages",
                "description": "提供托管与 CDN 服务",
                "url": "https://pages.cloudflare.com/"
            }
        ],
        "theme": {
            "name": "Sky Theme",
            "url": "https://github.com/AsYukiZzz/sky-blog-astro"
        },
        "privacyUrl": "/pages/privacy/",
        "termsUrl": "/pages/terms/",
        "sitemapUrl": "/sitemap/",
        "rssUrl": "/feed.xml",
        "showLoadTime": true
    },
    "post": {
        "header": {
            "appearance": "transparent"
        },
        "recommendations": {
            "enabled": false,
            "maxItems": 5
        },
        "comment": {
            "enabled": false,
            "repo": "",
            "repoId": "",
            "category": "Announcements",
            "categoryId": ""
        }
    },
    "extra": {
        "sakana": {
            "enabled": true,
            "character": "chisato",
            "size": 200,
            "position": "right",
            "offset": {
                "side": 24,
                "bottom": 24
            },
            "showOnMobile": false,
            "autoMode": false
        },
        "dock": true
    }
}
```

</details>

### 3.1 全局（`theme.global`）

`font` 选择全站默认字体：`serif` 为衬线字体，`sans` 为系统无衬线字体。Hero 标题字体单独设置。

#### 3.1.1 背景（`theme.global.background`）

`type` 仅支持 `solid`（跟随明暗主题的普通底色）和 `image`（图片壁纸）。`wallpapers` 为壁纸数组，每项只有 `id` 和 `image`：`id` 用于关联首页 Hero，`image` 填写本地路径或完整 URL。两个字段都必须是非空白字符串，首尾空白会移除，ID 不可重复。数组为空或图片加载失败时显示普通底色；普通底色模式不加载候选图片。

每次首次进入、刷新或完整文档导航时，浏览器从候选中等概率选一张，可能连续选中同一张。站内跳转、返回首页、前进后退和 BFCache 恢复保留本次选中的壁纸。禁用 JavaScript 时显示列表中的第一张。图片加载失败后保留所选 ID，不反复尝试其他候选。

`position` 控制图片铺满视口后的对齐与裁切，默认为 `center`，也可使用 `top`、`bottom` 或 `center 30%` 等 CSS 位置值。图片保持原比例铺满视口，随屏幕比例裁切；背景固定不滚动，内容正常滚动。

```ts
global: {
    font: 'serif',
    loading: { strategy: 'wallpaper', maxWait: 3000 },
    background: {
        type: 'image',
        wallpapers: [
            { id: 'forest', image: '/images/forest.webp' },
            { id: 'sea', image: '/images/sea.webp' },
        ],
        position: 'center',
    },
    appearance: {
        glass: {
            blur: 32,
            saturation: 1.3,
            opacity: { light: 0.72, dark: 0.65 },
        },
    },
},
```

首页 Hero、Card 区域及归档、分类、标签、专栏、随笔、朋友、文章阅读和其他页面共用此背景，无页面专属覆盖配置。文章与卡片自身的封面仍属于内容图片。

#### 3.1.2 玻璃材质（`theme.global.appearance.glass`）

`blur` 是卡片背后画面的模糊程度，单位为 px；`saturation` 是背景饱和度倍率，`1` 保持原样，`0` 为灰度。两者必须为有限非负数，允许为 `0`。

`opacity.light` 和 `opacity.dark` 分别控制浅色、深色模式下玻璃底色的不透明度，必须为 `0` 到 `1` 的有限数。数值越大，底色越实，壁纸透出越少。这些参数只影响表面底色和背后画面，文字、图标及卡片内图片保持清晰。边缘高光、边框和阴影由共用样式提供。

升级时，将旧单图路径迁入 `wallpapers` 的一个条目并为其指定 ID；Hero 的顶层标题、副标题移入必填的 `default`，补充 `position`，没有专属文案时将 `byWallpaper` 设为 `{}`。`home`、`footer`、`post`、`extra` 继续直接位于 `theme` 下，与 `global` 同级。

#### 3.1.3 页面加载（`theme.global.loading`）

```ts
loading: {
    strategy: 'wallpaper',
    maxWait: 3000,
},
```

这两个字段控制首次进入和刷新时的首屏加载策略：

| 字段       | 可选值                              | 含义                                                                                                                             |
| ---------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `strategy` | `wallpaper`、`content`              | `wallpaper` 等待 Hero 使用的全站壁纸下载并解码完成，再显示正式页面；`content` 在首屏内容和基础交互就绪后进入，壁纸继续后台加载。 |
| `maxWait`  | `0` 到 `2147483647` 的整数，单位 ms | 首屏资源和交互的最长等待时间，默认 `3000`；`0` 表示不额外等待资源。超过上限即结束等待，即使后续脚本仍未就绪。                    |

两种策略都会准备首屏内容图片和字体；屏幕外图片、懒加载图片和评论不阻塞首屏。Hero 背景与其他页面共用 `theme.global.background`，没有独立图片配置。普通底色或未配置图片时，`wallpaper` 不增加图片等待。

首次进入或刷新时，使用全屏主题底色加载画面，中央显示站点名称、波浪和“正在加载”。默认使用 `wallpaper` 策略，最长等待约 3 秒，再淡出加载层。壁纸失败或超时先显示底色页面，晚到的壁纸解码完成后柔和淡入。浏览器禁用 JavaScript 时直接展示页面。

站内页面切换超过约 180ms 时，顶部导航栏下方显示高斯模糊遮罩，遮罩中央显示七根竖条组成的波浪加载动画和“正在加载”文字。导航栏保持清晰可用，遮罩下方内容暂时不能点击；目标页面和必要交互就绪后淡出。遮罩沿用 `theme.global.appearance.glass` 的模糊、饱和度和明暗底色透明度，波浪颜色跟随主题主色。系统偏好减少动态效果时显示静态波形。

导航、文章链接、分页及前进后退使用同一加载层；页内锚点和局部按钮操作不触发。系统减少动态效果时静态显示波形并直接收起。站内跳转沿用现有加载规则，不受首屏 `strategy` 和 `maxWait` 影响。

本地页面加载过快、难以观察动画时，可停止当前开发服务，改用以下命令：

```bash
pnpm dev:loading
```

这个预览模式通常会让首次进入、刷新及每次站内跳转至少等待 1.5 秒；首屏仍以 `maxWait` 为上限，设置较短时会提前结束预览等待。首屏显示完整的底色加载画面；站内跳转在准备目标页面的同时保留原页面的模糊画面，随后切换内容。取消或再次跳转会结束旧的等待。切回 `pnpm dev` 即恢复正常速度；生产构建及 `pnpm preview` 不增加这段预览延迟。

### 3.2 首页（`theme.home`）

#### 3.2.1 封面（`theme.home.hero`）

`size` 选择 `full`（一屏高度）或 `compact`（较矮封面），同时影响后续卡片区的间距。`default` 必须配置，包含非空白的 `title`、字符串 `subtitle` 和预设 `position`，副标题用空字符串隐藏。

`byWallpaper` 按全站壁纸 ID 配置完整的标题、副标题和位置。选中 ID 没有对应项时，整个 Hero 使用 `default`，不逐字段混合；纯色模式、空壁纸列表也使用 `default`。关联键必须对应已定义的壁纸 ID。图片加载失败时保留所选组的文案和位置。

```ts
hero: {
    size: 'full',
    default: {
        title: 'sky blog',
        subtitle: '记录生活，分享思考',
        position: 'bottom-left',
    },
    byWallpaper: {
        sea: {
            title: '向海而行',
            subtitle: '记录沿途的风景',
            position: 'top-right',
        },
    },
},
```

上例需先在 `global.background.wallpapers` 定义 `sea`。支持七种位置：`top-left`（左上）、`bottom-left`（左下）、`top-right`（右上）、`bottom-right`（右下）、`top-center`（上中）、`bottom-center`（下中）、`center`（居中）。标题与副标题整体定位，文字跟随左、右或居中对齐，不配置自由坐标。

Hero 使用 `theme.global.background` 定义的全站背景，直接与后续卡片区域衔接。

标题使用主题本地提供的 Caveat 400 手写字体，最大 104px、最小 64px。Hero 与下方卡片共用最大 1280px 的居中容器及响应式左右留白，两侧文字与卡片外边缘对齐；底部安全留白为 24px，顶部预留导航栏空间。中文使用 Noto Serif SC 回退字体。标题与副标题直接显示在全站背景上；窄屏、长标题和中英文混排会正常换行，必要时撑高封面。字体加载失败时仍显示备用字体，无 JavaScript 时显示第一张壁纸对应组或 `default`。

影响范围：

- 首页封面的文字。
- 封面高度及卡片区顶部间距。

#### 3.2.2 卡片（`theme.home.card`）

`preset` 选择布局预设，支持 `default`；模板见 [src/presets/home-card.ts](../../src/presets/home-card.ts)。`disabled` 填写要隐藏的卡片 ID 数组，可省略。因禁用变空的整行会移除，局部空位可能保留；全部禁用时不留卡片区高度。

`layouts` 可分别覆盖 `compact`、`medium`、`wide` 三个断点，未填写的参数继承预设。断点按卡片容器宽度触发，数值参数单位为 px，使用安全整数。

每个断点的 `minWidth` 是启用布局的最小容器宽度，必须为非负整数；`compact` 从 `0` 开始，`medium`、`wide` 严格递增。

`rowHeight` 是单行高度，必须为正整数；`gap` 是横向与纵向间距，必须为非负整数。两者共同决定卡片高度与可用宽度，并须满足卡片的最小宽高。

`areas` 是网格占位的非空字符串数组，覆盖时整体替换。每项一行，空格分隔卡片 ID，`.` 表示留白；每行列数相同，同一卡片组成连续矩形，模板至少包含一张卡片。

三个断点的卡片集合须一致，占格规格与最小宽高须符合 [card-specs.ts](../../src/components/home/card-specs.ts)。先校验原始模板，再应用禁用列表。卡片宽度随容器伸缩，占格规格同时决定内部布局与预览数量。

卡片 ID：`author`（站主）、`heatmap`（热力图）、`stats`（统计）、`categories`（分类）、`tags`（标签）、`recent`（最新文章）、`popular`（精选文章）、`moments`（随笔）、`projects`（项目）、`links`（友链）。

精选文章、项目和友链分别维护在 [popular-posts.jsonc](../../src/data/popular-posts.jsonc)、[projects.jsonc](../../src/data/projects.jsonc)、[links.jsonc](../../src/data/links.jsonc)。

影响范围：

- 首页卡片的显示、排列、间距和尺寸。
- 卡片内部布局与列表预览数量。

### 3.3 页脚（`theme.footer`）

`copyrightOwner` 设置版权所有者名称，留空使用 `site.title`。版权起始年和计算年份的时区分别来自 `site.copyrightYear`、`site.timezone`。

`icp` 设置 ICP 备案显示文字，留空隐藏；查询链接由主题提供。`publicSecurity.text` 设置公安备案文字，留空隐藏整项；`publicSecurity.url` 设置查询链接，留空只显示文字。

服务商署名用 `providers` 数组设置，按数组顺序显示，设为 `[]` 可隐藏全部服务商。每项用 `name`、`description`、`url` 设置名称、说明和链接；名称为空时跳过该项，链接留空只显示文字。已有站点升级后，需要把原来的单个 `provider` 对象改为 `providers` 数组。主题署名用 `theme.name`、`theme.url` 设置名称和链接。名称留空隐藏整项，链接留空只显示文字。服务商配置只改变署名，实际托管平台由部署方式决定。

`privacyUrl`、`termsUrl`、`sitemapUrl`、`rssUrl` 分别设置隐私政策、使用条款、读者网站地图和 RSS 入口，留空隐藏，目标页面需另行维护。地图和 RSS 配置只改页脚链接，机器地图仍独立生成，本站订阅文件及头部入口仍使用 `/feed.xml`。

`showLoadTime` 控制加载耗时显示，包括首次打开和站内页面切换。

影响范围：

- 页脚版权、备案及署名文字。
- 页脚的政策、条款、网站地图和订阅入口。
- 页脚加载耗时。

### 3.4 文章（`theme.post`）

#### 3.4.1 评论（`theme.post.comment`）

评论使用 Giscus。`enabled` 是总开关，开启且 `repo`、`repoId`、`categoryId` 非空时显示。先在 [Giscus 配置页](https://giscus.app/zh-CN) 准备公开仓库、Discussions 和 Giscus 应用。

`repo` 使用 `用户名/仓库名` 或 `组织名/仓库名`，对应 `data-repo`；`repoId` 复制 `data-repo-id`。`category` 是分类名称，对应 `data-category`；`categoryId` 复制 `data-category-id`。这些字段应来自同一份生成结果。

评论按页面路径关联讨论，明暗样式随站点切换。更换仓库、分类或页面路径时，需要处理既有讨论的关联关系。

影响范围：

- 文章详情、随笔详情和独立页面的评论区。

#### 3.4.2 阅读目录与文章入口

文章详情右侧只显示目录卡片，并占满右侧可用高度，不随目录条数收缩。属于专栏的文章可在卡片内切换“本文目录”和“专栏目录”，默认显示本文目录；专栏目录沿用 [columns.jsonc](../../src/data/columns.jsonc) 中的文章顺序，仅显示已公开文章，并标记当前文章。专栏名称、公开文章总篇数和当前篇序固定显示在列表底部；专栏模式隐藏阅读进度，本文目录保留阅读进度。此行为按文章归属判断，与访问来源无关；普通文章和独立页面不显示专栏切换标签。手机折叠目录与大屏目录使用相同规则。

文章详情页 Dock 中的“发现文章”打开推荐弹窗。热门列表来自 [popular-posts.jsonc](../../src/data/popular-posts.jsonc)，最新列表按发布时间降序排列；弹窗显示完整的公开文章列表。首页卡片仍由首页卡片配置控制。

影响范围：

- 文章详情页的阅读目录和推荐弹窗。独立页面使用单独的页面版式。

#### 3.4.3 文末推荐（`theme.post.recommendations`）

`enabled` 控制文章底部“热门文章 / 最新文章”卡片的显示，默认 `false`，设为 `true` 后显示。卡片内通过标签切换文章列表。

`maxItems` 设置每个标签最多显示的文章条数，默认 `5`，必须为正整数；文章不足时显示实际数量。热门文章沿用 [popular-posts.jsonc](../../src/data/popular-posts.jsonc) 的配置顺序，最新文章按发布时间降序排列。

在 `theme.post` 中配置：

```ts
recommendations: {
    enabled: false,
    maxItems: 5,
},
```

此配置只作用于文末推荐卡片，Dock 的推荐弹窗仍展示完整列表。关闭文末推荐后，上下篇导航保留，右侧目录仍与左栏最后一个模块的底边对齐。

#### 3.4.4 顶部信息卡片（`theme.post.header`）

`appearance` 选择所有文章详情页顶部信息区的样式，可选 `transparent`（默认）和 `glass`。`transparent` 让标题、摘要、元信息与封面直接显示在全站背景上；`glass` 将整个顶部信息区显示为玻璃卡片，复用 `theme.global.appearance.glass` 的模糊程度、饱和度和浅深色不透明度。

```ts
header: {
    appearance: 'transparent',
},
```

两种模式使用相同排版，保留封面曲别针装饰。此设置不改变全站背景或正文、目录等其他卡片的玻璃材质，也不提供逐篇文章覆盖配置。

### 3.5 附加功能（`theme.extra`）

#### 3.5.1 石蒜挂件（`theme.extra.sakana`）

`enabled` 控制挂件开关；`character` 选择 `chisato`（千束）或 `takina`（泷奈）。`size` 是桌面尺寸，单位 px，展示时限制在 `120–320`，移动端最大 `160px`。

`position` 选择 `left`（左下角）或 `right`（右下角）。`offset.side`、`offset.bottom` 是侧边与底部距离，单位 px，展示时最小 `8px`；移动端底部至少预留 `96px` 加设备安全区域，靠近页脚时自动上移。

`showOnMobile` 控制宽度不超过 `767px` 时是否显示；`autoMode` 设置初始自动摆动。访客可切换角色、收起挂件或切换托管模式，收起状态本地保存。页面不可见时暂停，“减少动态效果”偏好下隐藏。

影响范围：

- 首页挂件、恢复入口及移动端展示。

#### 3.5.2 悬浮快捷栏

`dock` 控制悬浮 Dock 显示，提供返回首页、搜索、明暗切换和回到顶部入口。文章详情页还提供“发现文章”，关闭 Dock 后，已启用的文末推荐卡片仍可使用。

影响范围：

- 全站悬浮快捷栏。
