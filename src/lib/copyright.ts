export const COPYRIGHT_TYPES = [
    'original',
    'repost',
    'ai',
    'derivative',
    'custom',
] as const;

export type CopyrightType = (typeof COPYRIGHT_TYPES)[number];

export const COPYRIGHT_LABELS: Record<CopyrightType, string> = {
    original: '原创',
    repost: '转载',
    ai: 'AI 辅助',
    derivative: '二次创作',
    custom: '创作声明',
};

export const DEFAULT_COPYRIGHT: Readonly<{
    type: CopyrightType;
    license: string;
}> = Object.freeze({
    type: 'original',
    license: 'CC BY-NC-SA 4.0',
});

export function copyrightNote(copyright?: {
    type: CopyrightType;
    license: string;
    note?: string;
}): string {
    if (copyright?.note) return copyright.note;
    const license = copyright?.license ?? DEFAULT_COPYRIGHT.license;
    switch (copyright?.type ?? DEFAULT_COPYRIGHT.type) {
        case 'repost':
            return '本文转载自原始作品，版权归原作者所有。';
        case 'ai':
            return `本文在 AI 辅助下完成，经作者审核修改；采用 ${license} 协议。`;
        case 'derivative':
            return `本文基于原始作品二次创作，采用 ${license} 协议；转载请注明作者和出处。`;
        case 'custom':
            return '';
        default:
            return `本文采用 ${license} 协议，转载时请注明作者和出处。`;
    }
}

export function copyrightSummary(copyright?: {
    type: CopyrightType;
    license: string;
    note?: string;
}): string {
    const type = copyright?.type ?? DEFAULT_COPYRIGHT.type;
    const label = COPYRIGHT_LABELS[type];
    if (copyright?.note) return `${label} · ${copyright.note}`;
    const license = copyright?.license ?? DEFAULT_COPYRIGHT.license;
    switch (type) {
        case 'repost':
            return `${label} · 版权归原作者所有`;
        case 'custom':
            return label;
        default:
            return `${label} · ${license}`;
    }
}
