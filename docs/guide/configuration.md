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

### 3.1 字体与背景

`font` 选择全站默认字体：`serif` 为衬线字体，`sans` 为系统无衬线字体。封面标题字体单独设置。

`background` 选择页面底色：`grid` 显示淡网格，`none` 使用普通底色。首页封面内部背景单独设置。

影响范围：

- 导航、正文和卡片等文字。
- 全站页面背景与首页封面过渡区域。

### 3.2 首页（`theme.home`）

#### 3.2.1 封面（`theme.home.hero`）

`title` 和 `subtitle` 设置封面大标题与副标题。`size` 选择 `full`（一屏高度）或 `compact`（较矮封面），同时影响标题字号和后续卡片区的间距。

`titleFont` 选择 `condensed`（Impact / Arial Black）或 `titan-one`（Titan One）。`titleEffect` 使用已定义的 CSS 特效类，具体样式见 [标题特效样式](../../src/styles/original/index-title-effects.css)；留空只取消附加类，内置粒子装饰仍保留。

`background` 可选 `reference`（深色渐变）、`starry-sky`（动态星空）或 `image`（图片）。图片模式下，`image` 支持单个路径或路径数组，图片按封面区域覆盖裁切。空路径会被忽略，没有有效路径时不插入背景图片。

```ts
background: 'image',
image: [
    '/images/hero-1.webp',
    '/images/hero-2.webp',
    'https://example.com/hero-3.webp',
],
```

填写多个路径时，每次打开、刷新或返回首页（包括浏览器前进、后退恢复页面），都会随机选择一张，本次停留期间保持不变；随机结果可能与上一次相同。未启用 JavaScript 时显示第一张。原有的 `image: '/images/hero.webp'` 单图配置仍可使用。

影响范围：

- 首页封面文字、字体和特效。
- 封面高度、背景及卡片区顶部间距。

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
