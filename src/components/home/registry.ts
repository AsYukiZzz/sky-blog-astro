import AuthorCard from './AuthorCard.astro';
import WritingHeatmapCard from './WritingHeatmapCard.astro';
import StatsCard from './StatsCard.astro';
import CategoriesCard from './CategoriesCard.astro';
import TagsCard from './TagsCard.astro';
import LatestPostsCard from './LatestPostsCard.astro';
import PopularPostsCard from './PopularPostsCard.astro';
import EssaysCard from './EssaysCard.astro';
import FriendsCard from './FriendsCard.astro';
import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
import type { HomeCardId } from './card-specs';

// 尺寸描述决定合法 ID；组件表必须覆盖每个 ID。
export const homeCardRegistry = {
    author: AuthorCard,
    heatmap: WritingHeatmapCard,
    stats: StatsCard,
    categories: CategoriesCard,
    tags: TagsCard,
    recent: LatestPostsCard,
    popular: PopularPostsCard,
    moments: EssaysCard,
    links: FriendsCard,
} satisfies Record<HomeCardId, AstroComponentFactory>;
