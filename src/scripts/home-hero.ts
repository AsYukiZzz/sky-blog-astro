import { randomHeroImage } from '../lib/hero-images';

export function setupHeroImage() {
    const image = document.querySelector<HTMLImageElement>(
        'img[data-hero-images]',
    );
    if (!image) return;
    const images = JSON.parse(image.dataset.heroImages ?? '[]') as string[];
    const source = randomHeroImage(images);
    if (source) image.src = source;
}
