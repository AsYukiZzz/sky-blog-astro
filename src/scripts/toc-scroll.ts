export function tocScrollTarget(
    link: HTMLElement,
    scrollArea: HTMLElement,
): number | undefined {
    const height = scrollArea.clientHeight;
    if (!height) return undefined;
    const linkRect = link.getBoundingClientRect();
    const areaRect = scrollArea.getBoundingClientRect();
    if (linkRect.top < areaRect.top || linkRect.bottom > areaRect.bottom) {
        return (
            scrollArea.scrollTop +
            linkRect.top -
            areaRect.top -
            (height - linkRect.height) / 2
        );
    }
}

export function revealTocLink(link: HTMLElement, scrollArea: HTMLElement) {
    const top = tocScrollTarget(link, scrollArea);
    if (top !== undefined) scrollArea.scrollTo({ top, behavior: 'instant' });
}
