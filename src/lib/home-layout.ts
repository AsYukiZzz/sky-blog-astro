import type {
    HomeCardSpec,
    HomeConfig,
    HomeLayout,
    HomeLayoutName,
    HomeLayoutPlan,
    HomePreset,
    HomePresetName,
    CompiledHomeLayout,
} from './home-cards.ts';
import {
    homeLayoutError,
    parseHomeGridTemplate,
    type ParsedHomeGrid,
} from './home-grid-template.ts';

export const homeLayoutNames = ['compact', 'medium', 'wide'] as const;
const presetNames = ['default'];
const layoutFields = ['minWidth', 'rowHeight', 'gap', 'areas'];
const minContentWidth = 288;

export function defineHome<T extends HomeConfig>(config: T): T {
    return config;
}

function record(
    value: unknown,
    context: string,
    allowed?: readonly string[],
): asserts value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        homeLayoutError('HOME_CONFIG_INVALID', context, '需要对象');
    }
    if (allowed)
        for (const key of Object.keys(value)) {
            if (!allowed.includes(key))
                homeLayoutError('HOME_FIELD_UNKNOWN', context, key);
        }
}

function integer(
    value: unknown,
    minimum: number,
    context: string,
    field: string,
) {
    if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value < minimum
    ) {
        homeLayoutError(
            'HOME_NUMBER_INVALID',
            context,
            `${field} 必须是至少 ${minimum} 的有限整数`,
        );
    }
}

function validateVars(vars: HomeCardSpec['baseCssVars'], id: string) {
    record(vars, id);
    for (const [key, value] of Object.entries(vars)) {
        if (
            !/^--home-card-[a-z0-9-]+$/.test(key) ||
            !(
                typeof value === 'string' ||
                (typeof value === 'number' && Number.isFinite(value))
            ) ||
            /[;{}<>\r\n]/.test(String(value))
        ) {
            homeLayoutError('HOME_SPEC_INVALID', id, `非法展示变量 ${key}`);
        }
    }
}

function validateSpecs<Id extends string>(
    specs: Readonly<Record<Id, HomeCardSpec>>,
) {
    record(specs, 'registry');
    const headings = new Set<string>();
    const anchors = new Set<string>();
    for (const [id, spec] of Object.entries<HomeCardSpec>(specs)) {
        record(spec, id);
        if (
            !/^[a-z][a-z0-9-]*$/.test(id) ||
            typeof spec.headingId !== 'string' ||
            !spec.headingId ||
            headings.has(spec.headingId)
        ) {
            homeLayoutError(
                'HOME_SPEC_INVALID',
                id,
                '卡片 ID 或 headingId 无效/重复',
            );
        }
        headings.add(spec.headingId);
        if (spec.anchor !== undefined) {
            if (
                typeof spec.anchor !== 'string' ||
                !spec.anchor ||
                anchors.has(spec.anchor)
            )
                homeLayoutError('HOME_SPEC_INVALID', id, 'anchor 无效/重复');
            anchors.add(spec.anchor);
        }
        validateVars(spec.baseCssVars, id);
        record(spec.sizes, id);
        if (!Object.keys(spec.sizes).length)
            homeLayoutError('HOME_SPEC_INVALID', id, '至少注册一个尺寸');
        for (const [key, size] of Object.entries(spec.sizes)) {
            if (!/^[1-9]\d*x[1-9]\d*$/.test(key) || !size)
                homeLayoutError('HOME_SPEC_INVALID', id, `非法规格 ${key}`);
            record(size, id);
            if (typeof size.profile !== 'string' || !size.profile)
                homeLayoutError(
                    'HOME_SPEC_INVALID',
                    id,
                    `规格 ${key} 需要 profile`,
                );
            integer(size.minInlineSize, 1, id, 'minInlineSize');
            integer(size.minBlockSize, 1, id, 'minBlockSize');
            if (size.previewLimit !== undefined)
                integer(size.previewLimit, 1, id, 'previewLimit');
            validateVars(size.cssVars, id);
        }
        const limits = Object.values(spec.sizes).map(
            (size) => size?.previewLimit,
        );
        if (
            limits.some((limit) => limit !== undefined) &&
            limits.some((limit) => limit === undefined)
        ) {
            homeLayoutError(
                'HOME_PREVIEW_LIMIT_MISMATCH',
                id,
                '列表卡片的所有规格都必须声明 previewLimit；非列表卡片的所有规格都省略',
            );
        }
    }
}

function matchSizes<Id extends string>(
    grid: ParsedHomeGrid<Id>,
    layout: HomeLayout,
    name: HomeLayoutName,
    specs: Readonly<Record<Id, HomeCardSpec>>,
): CompiledHomeLayout<Id> {
    const availableWidth = Math.max(minContentWidth, layout.minWidth);
    const cellWidth =
        (availableWidth - (grid.columns - 1) * layout.gap) / grid.columns;
    if (cellWidth < 0) {
        homeLayoutError(
            'HOME_GRID_TOO_NARROW',
            name,
            `最小容器 ${availableWidth}px 无法容纳 ${grid.columns} 列和 ${layout.gap}px 间距`,
        );
    }
    const placements = grid.placements.map((placement) => {
        const spec = specs[placement.id];
        // Min-width queries accumulate. Clear variables belonging only to other sizes.
        const resetVars = Object.fromEntries(
            Object.values(spec.sizes).flatMap((variant) =>
                Object.keys(variant?.cssVars ?? {}).map((key) => [
                    key,
                    'initial',
                ]),
            ),
        );
        const size = spec.sizes[placement.size];
        if (!size)
            homeLayoutError(
                'HOME_SIZE_UNSUPPORTED',
                name,
                `${placement.id} 第 ${placement.row} 行第 ${placement.column} 列占位 ${placement.size}，支持：${Object.keys(spec.sizes).join('、')}`,
            );
        const width =
            placement.columnSpan * cellWidth +
            (placement.columnSpan - 1) * layout.gap;
        const height =
            placement.rowSpan * layout.rowHeight +
            (placement.rowSpan - 1) * layout.gap;
        if (width + 1e-8 < size.minInlineSize)
            homeLayoutError(
                'HOME_CARD_TOO_NARROW',
                name,
                `${placement.id} ${placement.size} 最窄 ${width.toFixed(1)}px，需要 ${size.minInlineSize}px`,
            );
        if (height < size.minBlockSize)
            homeLayoutError(
                'HOME_CARD_TOO_SHORT',
                name,
                `${placement.id} ${placement.size} 高 ${height}px，需要 ${size.minBlockSize}px`,
            );
        return {
            ...placement,
            profile: size.profile,
            previewLimit: size.previewLimit,
            cssVars: { ...resetVars, ...spec.baseCssVars, ...size.cssVars },
        };
    });
    return {
        ...grid,
        minWidth: layout.minWidth,
        rowHeight: layout.rowHeight,
        gap: layout.gap,
        placements,
    };
}

function filterDisabled<Id extends string>(
    grid: ParsedHomeGrid<Id>,
    disabled: Set<Id>,
    ids: readonly Id[],
    name: HomeLayoutName,
): ParsedHomeGrid<Id> {
    if (grid.order.every((id) => disabled.has(id)))
        return {
            columns: grid.columns,
            rows: 0,
            areas: [],
            order: [],
            placements: [],
        };
    const areas = grid.areas.flatMap((line) => {
        const original = line.split(' ');
        const tokens = original.map((token) =>
            disabled.has(token as Id) ? '.' : token,
        );
        const becameEmpty =
            original.some((token) => token !== '.') &&
            tokens.every((token) => token === '.');
        return becameEmpty ? [] : [tokens.join(' ')];
    });
    return parseHomeGridTemplate(areas, ids, name);
}

/** Validate raw layouts before disabling so disabled cards cannot mask mistakes. */
export function compileHomeLayout<Id extends string>(
    config: HomeConfig<Id>,
    specs: Readonly<Record<Id, HomeCardSpec>>,
    presets: Readonly<Record<HomePresetName, HomePreset>>,
): HomeLayoutPlan<Id> {
    record(config, 'config', ['preset', 'disabled', 'layouts']);
    if (
        !presetNames.includes(config.preset) ||
        !Object.hasOwn(presets, config.preset)
    )
        homeLayoutError('HOME_PRESET_UNKNOWN', 'config', String(config.preset));
    validateSpecs(specs);
    const ids = Object.keys(specs) as Id[];
    if (config.disabled !== undefined && !Array.isArray(config.disabled))
        homeLayoutError(
            'HOME_DISABLED_INVALID',
            'config',
            'disabled 需要卡片 ID 数组',
        );
    const disabled = new Set(config.disabled ?? []);
    for (const id of disabled)
        if (!ids.includes(id))
            homeLayoutError('HOME_CARD_UNKNOWN', 'disabled', String(id));
    if (config.layouts !== undefined)
        record(config.layouts, 'layouts', homeLayoutNames);
    const preset = presets[config.preset];
    record(preset, config.preset, homeLayoutNames);
    const merged = {} as Record<HomeLayoutName, HomeLayout>;
    for (const name of homeLayoutNames) {
        record(preset[name], name, layoutFields);
        const override = config.layouts?.[name];
        if (override !== undefined) record(override, name, layoutFields);
        const layout = { ...preset[name], ...override };
        integer(layout.minWidth, 0, name, 'minWidth');
        integer(layout.rowHeight, 1, name, 'rowHeight');
        integer(layout.gap, 0, name, 'gap');
        merged[name] = layout;
    }
    if (
        merged.compact.minWidth !== 0 ||
        merged.medium.minWidth <= merged.compact.minWidth ||
        merged.wide.minWidth <= merged.medium.minWidth
    )
        homeLayoutError(
            'HOME_BREAKPOINTS_INVALID',
            'layouts',
            'compact 必须从 0 开始，medium、wide 必须严格递增',
        );
    const raw = {} as Record<HomeLayoutName, CompiledHomeLayout<Id>>;
    for (const name of homeLayoutNames)
        raw[name] = matchSizes(
            parseHomeGridTemplate(merged[name].areas, ids, name),
            merged[name],
            name,
            specs,
        );
    const order = raw.compact.order;
    for (const name of ['medium', 'wide'] as const) {
        if (
            raw[name].order.length !== order.length ||
            raw[name].order.some((id) => !order.includes(id))
        )
            homeLayoutError(
                'HOME_CARD_SET_MISMATCH',
                name,
                `需要与 compact 相同的卡片：${order.join('、')}`,
            );
    }
    const layouts = {} as Record<HomeLayoutName, CompiledHomeLayout<Id>>;
    for (const name of homeLayoutNames)
        layouts[name] = matchSizes(
            filterDisabled(raw[name], disabled, ids, name),
            merged[name],
            name,
            specs,
        );
    const cards = layouts.compact.order.map((id) => {
        const limits = homeLayoutNames.map(
            (name) =>
                layouts[name].placements.find((item) => item.id === id)
                    ?.previewLimit ?? 0,
        );
        return {
            id,
            spec: specs[id],
            maxPreviewItems: Math.max(...limits) || undefined,
        };
    });
    return { layouts, cards };
}
