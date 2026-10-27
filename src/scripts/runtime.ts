import { setupThemeControls } from './theme-controls';
import { setupNavigation } from './navigation';
import { setupDialogs } from './dialogs';
import { setupImagePreviews } from './image-preview';
import { setupSearch } from './search';
import { setupClipboard } from './clipboard';
import { setupComments } from './comments';
import { setupArticleReading } from './article-reading';
import { setupMotion } from './motion';
import { setupArticleTabs } from './article-tabs';
import { setupSiteStatus } from './site-status';
import { setupSakana } from './sakana';
import { setupPageLoading } from './page-loading';

const finishPageLoading = setupPageLoading();
let pageController: AbortController | undefined;
let routeStartedAt: number | undefined;
let mountedMain: HTMLElement | null | undefined;

function mountPage() {
    pageController?.abort();
    pageController = new AbortController();
    const { signal } = pageController;
    setupThemeControls(signal);
    setupSiteStatus(signal, routeStartedAt);
    routeStartedAt = undefined;
    setupArticleTabs(signal);
    setupSakana(signal);
    setupMotion(signal);
    setupNavigation(signal);
    setupDialogs(signal);
    setupImagePreviews(signal);
    setupSearch(signal);
    setupClipboard(signal);
    setupComments(signal);
    setupArticleReading(signal);
}

document.addEventListener('astro:before-swap', (event) => {
    pageController?.abort();
    const documentAfterSwap = (event as Event & { newDocument: Document })
        .newDocument;
    documentAfterSwap.documentElement.dataset.theme =
        document.documentElement.dataset.theme;
    documentAfterSwap.documentElement.dataset.colorScheme =
        document.documentElement.dataset.colorScheme;
});
document.addEventListener('astro:before-preparation', (event) => {
    const start = performance.now();
    routeStartedAt = start;
    (event as Event & { signal: AbortSignal }).signal.addEventListener(
        'abort',
        () => {
            if (routeStartedAt === start) routeStartedAt = undefined;
        },
        { once: true },
    );
});
function mountReadyPage() {
    try {
        const main = document.querySelector('main');
        if (
            main !== mountedMain ||
            !pageController ||
            pageController.signal.aborted
        ) {
            mountPage();
            mountedMain = main;
        }
    } finally {
        finishPageLoading();
    }
}

// Astro's initial page-load follows window.load, which includes offscreen images.
// Initialize earlier; repeated events for the same live DOM keep its interactions.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountReadyPage, {
        once: true,
    });
} else {
    mountReadyPage();
}
document.addEventListener('astro:page-load', mountReadyPage);
