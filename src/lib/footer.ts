import type { FooterProvider } from '../types/config';

export function visibleFooterProviders(
    providers: readonly FooterProvider[],
): FooterProvider[] {
    return providers.filter((provider) => provider.name.trim());
}
