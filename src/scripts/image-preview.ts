const interactiveAncestor = [
    'a',
    'button',
    'input',
    'select',
    'textarea',
    'label',
    'summary',
    '[role="button"]',
    '[role="link"]',
    '[tabindex]',
    '[contenteditable]:not([contenteditable="false"])',
    '[data-lightbox]',
].join(',');

export function setupImagePreviews(signal: AbortSignal) {
    if (signal.aborted) return;
    const dialog = document.querySelector<HTMLDialogElement>('#image-lightbox');
    const viewer = dialog?.querySelector<HTMLImageElement>('img');
    if (!dialog || !viewer) return;
    document
        .querySelectorAll<HTMLImageElement>('#article-content img')
        .forEach((image) => {
            if (image.closest(interactiveAncestor)) return;
            const content = image.closest('picture') ?? image;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'article-image-preview';
            button.dataset.lightbox = image.currentSrc || image.src;
            button.dataset.caption = image.alt;
            button.setAttribute(
                'aria-label',
                image.alt.trim() ? `查看图片：${image.alt}` : '查看图片',
            );
            button.setAttribute('aria-haspopup', 'dialog');
            button.setAttribute('aria-controls', dialog.id);
            content.before(button);
            button.append(content);
            // A viewBox-only SVG has no definite width inside a shrink-to-fit
            // button. Use the loaded image's intrinsic width as a sizing hint.
            if (!image.hasAttribute('width')) {
                const sizeImage = () => {
                    if (image.naturalWidth) image.width = image.naturalWidth;
                };
                image.addEventListener('load', sizeImage, { signal });
                if (image.complete) sizeImage();
            }
        });

    let opener: HTMLElement | undefined;
    document.addEventListener(
        'click',
        (event) => {
            const target =
                event.target instanceof Element ? event.target : null;
            const control = target?.closest<HTMLElement>('[data-lightbox]');
            if (!control) return;
            const image = control.querySelector<HTMLImageElement>('img');
            const source = control.classList.contains('article-image-preview')
                ? image?.currentSrc || image?.src
                : control.dataset.lightbox;
            if (!source) return;
            viewer.src = source;
            viewer.alt = control.dataset.caption || image?.alt || '';
            const caption = dialog.querySelector('p');
            if (caption) caption.textContent = viewer.alt;
            opener = control;
            if (!dialog.open) dialog.showModal();
        },
        { signal },
    );
    dialog.addEventListener(
        'close',
        () => {
            if (!signal.aborted && opener?.isConnected)
                opener.focus({ preventScroll: true });
            opener = undefined;
        },
        { signal },
    );
    signal.addEventListener('abort', () => (opener = undefined), {
        once: true,
    });
}
