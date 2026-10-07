import { site } from '../config/site';
export function formatDate(value: Date, short = false): string {
    return new Intl.DateTimeFormat(site.language, {
        timeZone: site.timezone,
        year: short ? undefined : 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(value);
}
export function readingTime(body: string | undefined): number {
    const text = (body ?? '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/<[^>]*>/g, '');
    const chinese = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
    const words = (
        text.replace(/[\u3400-\u9fff]/g, ' ').match(/\b\w+\b/g) ?? []
    ).length;
    return Math.max(1, Math.ceil((chinese + words) / 300));
}
