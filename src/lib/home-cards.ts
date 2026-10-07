import type { HomeCardId } from '../components/home/card-specs.ts';
import type {
    GridSize,
    HomeGridPlacement,
    ParsedHomeGrid,
} from './home-grid-template.ts';

export type HomeLayoutName = 'compact' | 'medium' | 'wide';
export type HomePresetName = 'default';
export type HomeCssVars = Readonly<Record<string, string | number>>;

export interface HomeCardSizeSpec {
    profile: string;
    minInlineSize: number;
    minBlockSize: number;
    previewLimit?: number;
    cssVars: HomeCssVars;
}

export interface HomeCardSpec {
    headingId: string;
    anchor?: string;
    ignoreSearch?: boolean;
    baseCssVars: HomeCssVars;
    sizes: Readonly<Partial<Record<GridSize, HomeCardSizeSpec>>>;
}

export interface HomeCardContentProps {
    headingId: string;
    maxPreviewItems?: number;
}

export interface HomeLayout {
    minWidth: number;
    rowHeight: number;
    gap: number;
    areas: readonly string[];
}

export type HomePreset = Readonly<Record<HomeLayoutName, HomeLayout>>;
export interface HomeConfig<Id extends string = HomeCardId> {
    preset: HomePresetName;
    disabled?: readonly Id[];
    layouts?: Partial<Record<HomeLayoutName, Partial<HomeLayout>>>;
}

export interface CompiledHomePlacement<
    Id extends string = string,
> extends HomeGridPlacement<Id> {
    profile: string;
    previewLimit?: number;
    cssVars: HomeCssVars;
}

export interface CompiledHomeLayout<Id extends string = string> extends Omit<
    ParsedHomeGrid<Id>,
    'placements'
> {
    minWidth: number;
    rowHeight: number;
    gap: number;
    placements: CompiledHomePlacement<Id>[];
}

export interface HomeLayoutPlan<Id extends string = string> {
    layouts: Record<HomeLayoutName, CompiledHomeLayout<Id>>;
    cards: { id: Id; spec: HomeCardSpec; maxPreviewItems?: number }[];
}
