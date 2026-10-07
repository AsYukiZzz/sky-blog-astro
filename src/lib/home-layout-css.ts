import type { CompiledHomeLayout, HomeLayoutPlan } from './home-cards.ts';
import { homeLayoutNames } from './home-layout.ts';

function layoutCss(layout: CompiledHomeLayout): string {
    const grid = `.home-card-grid{grid-template-columns:repeat(${layout.columns},minmax(0,1fr));grid-template-rows:repeat(${layout.rows},${layout.rowHeight}px);grid-template-areas:${layout.areas.map((line) => `"${line}"`).join(' ')};gap:${layout.gap}px}`;
    const cards = layout.placements
        .map((card) => {
            const selector = `.home-card-grid > [data-home-card="${card.id}"]`;
            const vars = Object.entries(card.cssVars)
                .map(([key, value]) => `${key}:${value}`)
                .join(';');
            let css = `${selector}{grid-column:${card.column}/span ${card.columnSpan};grid-row:${card.row}/span ${card.rowSpan};${vars}}`;
            if (card.previewLimit !== undefined) {
                const items = `${selector} [data-home-items] > [data-home-item]`;
                css += `${items}:nth-child(n){display:none}${items}:nth-child(-n + ${card.previewLimit}){display:var(--home-card-item-display)}`;
            }
            return css;
        })
        .join('');
    return grid + cards;
}

export function homeLayoutCss(plan: HomeLayoutPlan): string {
    if (!plan.cards.length) return '';
    return homeLayoutNames
        .map((name) => {
            const layout = plan.layouts[name];
            const css = layoutCss(layout);
            return name === 'compact'
                ? css
                : `@container home-cards (width >= ${layout.minWidth}px){${css}}`;
        })
        .join('\n');
}
