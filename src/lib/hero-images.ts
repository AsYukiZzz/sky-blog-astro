export function heroImageSources(image: string | string[]): string[] {
    return (typeof image === 'string' ? [image] : image)
        .map((source) => source.trim())
        .filter(Boolean);
}

export function randomHeroImage(
    images: readonly string[],
    random = Math.random,
): string | undefined {
    return images.length
        ? images[Math.floor(random() * images.length)]
        : undefined;
}
