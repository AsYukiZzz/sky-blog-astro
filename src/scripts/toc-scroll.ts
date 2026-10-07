export function revealTocLink(link: HTMLElement, scrollArea: HTMLElement) {
    if (!scrollArea.clientHeight) return;
    const linkRect = link.getBoundingClientRect();
    const areaRect = scrollArea.getBoundingClientRect();
    if (linkRect.top < areaRect.top || linkRect.bottom > areaRect.bottom) {
        scrollArea.scrollTo({
            top:
                scrollArea.scrollTop +
                linkRect.top -
                areaRect.top -
                (scrollArea.clientHeight - linkRect.height) / 2,
            behavior: 'instant',
        });
    }
}
