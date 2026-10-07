interface SearchResult {
    url: string;
    meta: { title: string };
    excerpt: string;
}

interface Pagefind {
    destroy(): Promise<void>;
    search(query: string): Promise<{
        results: { data: () => Promise<SearchResult> }[];
    }>;
}

const emptyStatus = '输入关键词，找到你感兴趣的内容。';
const resultLimit = 15;
let modulePromise: Promise<Pagefind> | undefined;
let loadAttempt = 0;

function loadPagefind() {
    const path = `/pagefind/pagefind.js${loadAttempt ? `?retry=${loadAttempt}` : ''}`;
    modulePromise ??= import(/* @vite-ignore */ path).catch((error) => {
        modulePromise = undefined;
        // A fresh URL allows the next query to retry a failed module download.
        loadAttempt++;
        throw error;
    });
    return modulePromise;
}

function resetPagefind(failed: Promise<Pagefind>) {
    if (modulePromise !== failed) return;
    // Pagefind caches failed fragments. New queries wait for the failed instance to be released.
    const resetting = failed.then(async (pagefind) => {
        await pagefind.destroy();
        return pagefind;
    });
    modulePromise = resetting;
    void resetting.catch(() => {
        if (modulePromise === resetting) {
            modulePromise = undefined;
            loadAttempt++;
        }
    });
}

function highlightedExcerpt(html: string) {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const fragment = document.createDocumentFragment();
    const terms = [...parsed.body.querySelectorAll('mark')].map(
        (mark) => mark.textContent?.trim() ?? '',
    );
    const walker = parsed.createTreeWalker(parsed.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        // Rebuild text and marks only; never copy elements or attributes from the result.
        if (node.parentElement?.closest('mark')) {
            const mark = document.createElement('mark');
            mark.textContent = node.textContent;
            fragment.append(mark);
        } else fragment.append(document.createTextNode(node.textContent ?? ''));
    }
    return { fragment, terms };
}

function highlightedTitle(
    title: string,
    query: string,
    matchedTerms: string[],
) {
    const fragment = document.createDocumentFragment();
    const terms = [
        ...new Set([
            ...matchedTerms,
            ...(query.match(/[\p{L}\p{N}_]+/gu) ?? []),
        ]),
    ]
        .filter(Boolean)
        .sort((a, b) => b.length - a.length);
    if (!terms.length) {
        fragment.append(title);
        return fragment;
    }
    const pattern = new RegExp(
        terms
            .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('|'),
        'giu',
    );
    let offset = 0;
    for (const match of title.matchAll(pattern)) {
        fragment.append(title.slice(offset, match.index));
        const mark = document.createElement('mark');
        mark.textContent = match[0];
        fragment.append(mark);
        offset = match.index + match[0].length;
    }
    fragment.append(title.slice(offset));
    return fragment;
}

function resultLink(item: SearchResult, query: string) {
    const url = new URL(item.url, location.origin);
    if (url.origin !== location.origin) return null;
    const link = document.createElement('a');
    link.className = 'search-result';
    link.href = url.pathname + url.search + url.hash;
    const type = document.createElement('span');
    type.className = 'search-result-type';
    type.textContent = url.pathname.startsWith('/posts/')
        ? '文章'
        : url.pathname.startsWith('/moments/')
          ? '随笔'
          : '页面';
    const heading = document.createElement('h3');
    const { fragment, terms } = highlightedExcerpt(item.excerpt);
    heading.append(highlightedTitle(item.meta.title, query, terms));
    const excerpt = document.createElement('p');
    excerpt.append(fragment);
    link.append(type, heading, excerpt);
    return link;
}

export function setupSearch(signal: AbortSignal) {
    if (signal.aborted) return;
    const dialog = document.querySelector<HTMLDialogElement>('#search-dialog');
    const input = dialog?.querySelector<HTMLInputElement>(
        '[data-search-input]',
    );
    const results = dialog?.querySelector<HTMLElement>('[data-search-results]');
    const status = dialog?.querySelector<HTMLElement>('[data-search-status]');
    const form = dialog?.querySelector<HTMLFormElement>('form');
    if (!dialog || !input || !results || !status || !form) return;

    let generation = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let returnFocus: HTMLElement | null = null;
    const cancelSearch = () => {
        generation++;
        clearTimeout(timer);
        results.setAttribute('aria-busy', 'false');
    };
    const search = async () => {
        cancelSearch();
        if (signal.aborted || !dialog.open) return;
        const current = generation;
        const query = input.value.trim();
        results.replaceChildren();
        if (!query) {
            status.textContent = emptyStatus;
            return;
        }
        status.textContent = '正在寻找…';
        results.setAttribute('aria-busy', 'true');
        const enginePromise = loadPagefind();
        try {
            const pagefind = await enginePromise;
            const response = await pagefind.search(query);
            const data = await Promise.all(
                response.results
                    .slice(0, resultLimit)
                    .map((result) => result.data()),
            );
            if (signal.aborted || !dialog.open || current !== generation)
                return;
            const list = document.createDocumentFragment();
            for (const item of data) {
                const link = resultLink(item, query);
                if (!link) continue;
                const row = document.createElement('li');
                row.append(link);
                list.append(row);
            }
            results.replaceChildren(list);
            status.textContent = response.results.length
                ? `找到 ${response.results.length} 个结果${response.results.length > resultLimit ? `，显示前 ${resultLimit} 个，请细化关键词` : ''}`
                : '没有找到相关内容，换个关键词试试。';
        } catch {
            if (signal.aborted || !dialog.open || current !== generation)
                return;
            resetPagefind(enginePromise);
            status.textContent = '搜索暂时不可用，请稍后再试。';
        } finally {
            if (!signal.aborted && current === generation)
                results.setAttribute('aria-busy', 'false');
        }
    };

    const openSearch = (trigger?: HTMLElement) => {
        if (!dialog.open) {
            returnFocus =
                trigger ??
                (document.activeElement instanceof HTMLElement
                    ? document.activeElement
                    : null);
            dialog.showModal();
            if (input.value.trim()) void search();
        }
        input.focus({ preventScroll: true });
    };
    // Close the dialog before ClientRouter follows a result link.
    document.addEventListener(
        'click',
        (event) => {
            if (event.defaultPrevented || event.button !== 0) return;
            const target =
                event.target instanceof Element ? event.target : null;
            const trigger = target?.closest<HTMLElement>('[data-open-search]');
            if (trigger) {
                event.preventDefault();
                openSearch(trigger);
            } else if (
                !event.ctrlKey &&
                !event.metaKey &&
                !event.altKey &&
                !event.shiftKey &&
                target?.closest('#search-dialog .search-result')
            ) {
                dialog.close();
            }
        },
        { signal, capture: true },
    );
    document.addEventListener(
        'keydown',
        (event) => {
            if (
                (event.ctrlKey || event.metaKey) &&
                !event.altKey &&
                !event.isComposing &&
                event.key.toLowerCase() === 'k'
            ) {
                event.preventDefault();
                openSearch();
            }
        },
        { signal },
    );
    dialog.addEventListener(
        'keydown',
        (event) => {
            if (event.isComposing) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                dialog.close();
                return;
            }
            if (event.key === 'Tab') {
                const controls = [
                    ...dialog.querySelectorAll<HTMLElement>(
                        'button, input, a[href]',
                    ),
                ].filter(
                    (element) =>
                        element.tabIndex >= 0 &&
                        !element.matches(':disabled') &&
                        element.getClientRects().length,
                );
                const first = controls[0];
                const last = controls.at(-1);
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first?.focus();
                }
                return;
            }
            if (
                event.ctrlKey ||
                event.metaKey ||
                event.altKey ||
                !['ArrowDown', 'ArrowUp'].includes(event.key)
            )
                return;
            const links = [...results.querySelectorAll<HTMLAnchorElement>('a')];
            const index = links.indexOf(
                document.activeElement as HTMLAnchorElement,
            );
            if (document.activeElement !== input && index < 0) return;
            event.preventDefault();
            if (event.key === 'ArrowUp' && index <= 0)
                input.focus({ preventScroll: true });
            else
                links[
                    Math.min(
                        Math.max(
                            index + (event.key === 'ArrowDown' ? 1 : -1),
                            0,
                        ),
                        links.length - 1,
                    )
                ]?.focus();
        },
        { signal },
    );
    const queueSearch = (event: Event) => {
        cancelSearch();
        results.replaceChildren();
        if (!input.value.trim()) {
            status.textContent = emptyStatus;
            return;
        }
        if (event instanceof InputEvent && event.isComposing) return;
        status.textContent = '正在寻找…';
        results.setAttribute('aria-busy', 'true');
        timer = setTimeout(search, 180);
    };
    input.addEventListener('input', queueSearch, { signal });
    input.addEventListener('compositionend', queueSearch, { signal });
    form.addEventListener(
        'submit',
        (event) => {
            event.preventDefault();
            void search();
        },
        { signal },
    );
    dialog.addEventListener(
        'close',
        () => {
            cancelSearch();
            if (returnFocus?.isConnected)
                returnFocus.focus({ preventScroll: true });
            returnFocus = null;
        },
        { signal },
    );
    signal.addEventListener(
        'abort',
        () => {
            cancelSearch();
            if (dialog.open) dialog.close();
            returnFocus = null;
        },
        { once: true },
    );
}
