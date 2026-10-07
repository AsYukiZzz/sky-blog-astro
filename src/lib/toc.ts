export interface TocHeading {
    depth: number;
    slug: string;
    text: string;
}

export interface TocNode extends TocHeading {
    children: TocNode[];
}

export function buildToc(headings: readonly TocHeading[]): TocNode[] {
    const roots: TocNode[] = [];
    const parents: TocNode[] = [];
    for (const heading of headings) {
        while (
            parents.length &&
            parents[parents.length - 1].depth >= heading.depth
        )
            parents.pop();
        const node: TocNode = { ...heading, children: [] };
        (parents[parents.length - 1]?.children ?? roots).push(node);
        parents.push(node);
    }
    return roots;
}
