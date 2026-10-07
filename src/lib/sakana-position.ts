/** Raise the widget only when its controls would enter the footer's clearance. */
export function sakanaFooterLift(
    viewportHeight: number,
    footerTop: number,
    bottomInset: number,
) {
    return Math.max(0, viewportHeight - bottomInset + 16 - footerTop);
}
