export type GridSize = `${number}x${number}`;

export interface HomeGridPlacement<Id extends string = string> {
    id: Id;
    row: number;
    column: number;
    rowSpan: number;
    columnSpan: number;
    size: GridSize;
}

export interface ParsedHomeGrid<Id extends string = string> {
    columns: number;
    rows: number;
    areas: string[];
    order: Id[];
    placements: HomeGridPlacement<Id>[];
}

export function homeLayoutError(
    code: string,
    layout: string,
    detail: string,
): never {
    throw new Error(`${code} [${layout}] ${detail}`);
}

/** Parse a matrix without knowing any card-specific sizes or placement rules. */
export function parseHomeGridTemplate<Id extends string>(
    areas: readonly string[],
    knownIds: readonly Id[],
    layoutName: string,
): ParsedHomeGrid<Id> {
    if (!Array.isArray(areas) || areas.length === 0) {
        homeLayoutError(
            'HOME_TEMPLATE_EMPTY',
            layoutName,
            'areas 至少需要一行',
        );
    }
    const known = new Set<string>(knownIds);
    const bounds = new Map<
        Id,
        { top: number; left: number; bottom: number; right: number }
    >();
    const matrix = areas.map((line, row) => {
        if (typeof line !== 'string' || /[\r\n]/.test(line) || !line.trim()) {
            homeLayoutError(
                'HOME_ROW_INVALID',
                layoutName,
                `第 ${row + 1} 行需要不含换行的非空字符串`,
            );
        }
        const tokens = line.trim().split(/\s+/);
        for (const [column, token] of tokens.entries()) {
            if (token === '.') continue;
            const location = `第 ${row + 1} 行第 ${column + 1} 列`;
            if (!/^[a-z][a-z0-9-]*$/.test(token)) {
                homeLayoutError(
                    'HOME_TOKEN_INVALID',
                    layoutName,
                    `${token}：${location}`,
                );
            }
            if (!known.has(token)) {
                homeLayoutError(
                    'HOME_CARD_UNKNOWN',
                    layoutName,
                    `${token}：${location}`,
                );
            }
            const id = token as Id;
            const current = bounds.get(id);
            if (current) {
                current.left = Math.min(current.left, column);
                current.right = Math.max(current.right, column);
                current.bottom = row;
            } else {
                bounds.set(id, {
                    top: row,
                    left: column,
                    bottom: row,
                    right: column,
                });
            }
        }
        return tokens;
    });
    const columns = matrix[0].length;
    for (const [row, tokens] of matrix.entries()) {
        if (tokens.length !== columns) {
            homeLayoutError(
                'HOME_COLUMNS_MISMATCH',
                layoutName,
                `第 ${row + 1} 行有 ${tokens.length} 列，应为 ${columns} 列`,
            );
        }
    }
    if (bounds.size === 0) {
        homeLayoutError(
            'HOME_TEMPLATE_EMPTY',
            layoutName,
            '模板至少需要一张卡片',
        );
    }
    const placements = [...bounds].map(([id, { top, left, bottom, right }]) => {
        for (let row = top; row <= bottom; row++) {
            for (let column = left; column <= right; column++) {
                if (matrix[row][column] !== id) {
                    homeLayoutError(
                        'HOME_AREA_NON_RECTANGULAR',
                        layoutName,
                        `${id}：第 ${row + 1} 行第 ${column + 1} 列应为 ${id}，实际为 ${matrix[row][column]}`,
                    );
                }
            }
        }
        const columnSpan = right - left + 1;
        const rowSpan = bottom - top + 1;
        return {
            id,
            row: top + 1,
            column: left + 1,
            rowSpan,
            columnSpan,
            size: `${columnSpan}x${rowSpan}` as GridSize,
        };
    });
    return {
        columns,
        rows: matrix.length,
        areas: matrix.map((row) => row.join(' ')),
        order: [...bounds.keys()],
        placements,
    };
}
