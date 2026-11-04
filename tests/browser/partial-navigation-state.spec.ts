import { expect, test, type Page } from '@playwright/test';
import { Buffer } from 'node:buffer';

const firstArticle = '/posts/format-example/';
const nextArticle = '/posts/standalone-example/';
const shellSelectors = [
    'body',
    'main',
    '.site-nav',
    '#search-dialog',
    '[data-site-background]',
    '[data-page-loading]',
];

async function renderArticles(page: Page, render: (next: boolean) => string) {
    await page.route(
        /\/posts\/(?:format-example|standalone-example)\/$/,
        async (route) => {
            const response = await route.fetch();
            const next = route.request().url().includes('standalone-example');
            const content = `<section id="navigation-state-fixture" data-page="${next ? 'next' : 'first'}">${render(next)}</section>`;
            await route.fulfill({
                response,
                body: (await response.text()).replace(
                    /(<div\b[^>]*id="article-content"[^>]*>)/,
                    (_, opening: string) => opening + content,
                ),
            });
        },
    );
}

async function openFirst(page: Page) {
    await page.goto(firstArticle);
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    await page.evaluate((selectors) => {
        const scope = window as Window & {
            nativeStateShell?: (Element | null)[];
        };
        scope.nativeStateShell = selectors.map((selector) =>
            document.querySelector(selector),
        );
    }, shellSelectors);
}

async function openNext(page: Page) {
    await page.evaluate((path) => {
        const link = document.createElement('a');
        link.href = path;
        document.body.append(link);
        link.click();
        link.remove();
    }, nextArticle);
    await expect(page).toHaveURL(
        new URL(nextArticle, 'http://127.0.0.1:4399').href,
    );
    await expect(page.locator('#navigation-state-fixture')).toHaveAttribute(
        'data-page',
        'next',
    );
    await expect(page.locator('[data-page-loading]')).toBeHidden();
    expect(
        await page.evaluate((selectors) => {
            const scope = window as Window & {
                nativeStateShell?: (Element | null)[];
            };
            return selectors.every(
                (selector, index) =>
                    document.querySelector(selector) ===
                    scope.nativeStateShell![index],
            );
        }, shellSelectors),
    ).toBe(true);
}

function audioFile(seconds: number) {
    const wav = Buffer.alloc(44 + 8000 * seconds, 128);
    wav.write('RIFF', 0);
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(8000, 24);
    wav.writeUInt32LE(8000, 28);
    wav.writeUInt16LE(1, 32);
    wav.writeUInt16LE(8, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(8000 * seconds, 40);
    return wav;
}

for (const kind of ['audio', 'video']) {
    test(`${kind} selects the next article's resource when its source child changes`, async ({
        page,
    }) => {
        await page.route('**/state-first.wav', (route) =>
            route.fulfill({ contentType: 'audio/wav', body: audioFile(1) }),
        );
        await page.route('**/state-next.wav', (route) =>
            route.fulfill({ contentType: 'audio/wav', body: audioFile(2) }),
        );
        await renderArticles(
            page,
            (next) =>
                `<${kind} id="state-media" controls preload="auto"><source src="/state-${next ? 'next' : 'first'}.wav" type="audio/wav"></${kind}>`,
        );
        await openFirst(page);
        await expect(page.locator('#state-media')).toHaveJSProperty(
            'duration',
            1,
        );
        await openNext(page);
        await expect(page.locator('#state-media source')).toHaveAttribute(
            'src',
            '/state-next.wav',
        );
        await expect(page.locator('#state-media')).toHaveJSProperty(
            'duration',
            2,
        );
        await expect
            .poll(() =>
                page
                    .locator('#state-media')
                    .evaluate(
                        (node) =>
                            new URL((node as HTMLMediaElement).currentSrc)
                                .pathname,
                    ),
            )
            .toBe('/state-next.wav');
    });
}

test('unchanged article media keeps its live player state', async ({
    page,
}) => {
    await page.route('**/state-unchanged.wav', (route) =>
        route.fulfill({ contentType: 'audio/wav', body: audioFile(1) }),
    );
    await renderArticles(
        page,
        () =>
            '<audio id="state-media" controls preload="auto"><source src="/state-unchanged.wav" type="audio/wav"></audio>',
    );
    await openFirst(page);
    await expect(page.locator('#state-media')).toHaveJSProperty('duration', 1);
    await page.evaluate(() => {
        const scope = window as Window & { unchangedPlayer?: HTMLMediaElement };
        scope.unchangedPlayer =
            document.querySelector<HTMLMediaElement>('#state-media')!;
        scope.unchangedPlayer.volume = 0.3;
    });
    await openNext(page);
    expect(
        await page.evaluate(
            () =>
                document.querySelector('#state-media') ===
                (window as Window & { unchangedPlayer?: HTMLMediaElement })
                    .unchangedPlayer,
        ),
    ).toBe(true);
    await expect(page.locator('#state-media')).toHaveJSProperty('volume', 0.3);
});

test('page-owned form controls use target defaults while explicit persistent controls keep edits', async ({
    page,
}) => {
    await renderArticles(
        page,
        (next) => `
        <form>
            <input id="state-text" value="${next ? 'Beta' : 'Alpha'}">
            <textarea id="state-textarea">${next ? 'Beta body' : 'Alpha body'}</textarea>
            <fieldset id="state-unchanged-controls">
                <input id="state-checkbox" type="checkbox">
                <input id="state-radio-a" type="radio" name="state-radio" value="a" checked>
                <input id="state-radio-b" type="radio" name="state-radio" value="b">
                <input id="state-file" type="file">
                <input id="state-submit" type="submit">
                <select id="state-select"><option value="a" selected>A</option><option value="b">B</option></select>
                <select id="state-multiple" multiple><option value="a" selected>A</option><option value="b">B</option><option value="c" selected>C</option></select>
                <select id="state-list" size="3"><option value="a">A</option><option value="b">B</option></select>
                <select id="state-disabled-first"><optgroup disabled><option value="a">A</option></optgroup><option value="b">B</option><option value="c">C</option></select>
            </fieldset>
        </form>
        <div data-astro-transition-persist="saved-draft"><input id="state-saved-draft" value="${next ? 'next default' : 'first default'}"></div>
    `,
    );
    await openFirst(page);
    await page.locator('#state-text').fill('user edit');
    await page.locator('#state-textarea').fill('user body');
    await page.locator('#state-checkbox').check();
    await page
        .locator('#state-checkbox')
        .evaluate((node) => ((node as HTMLInputElement).indeterminate = true));
    await page.locator('#state-radio-b').check();
    await page.locator('#state-file').setInputFiles({
        name: 'draft.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('draft'),
    });
    await page.locator('#state-select').selectOption('b');
    await page.locator('#state-multiple').selectOption('b');
    await page.locator('#state-list').selectOption('b');
    await page.locator('#state-disabled-first').selectOption('c');
    await page.locator('#state-saved-draft').fill('saved draft');
    await openNext(page);
    await expect(page.locator('#state-text')).toHaveValue('Beta');
    await expect(page.locator('#state-textarea')).toHaveValue('Beta body');
    await expect(page.locator('#state-checkbox')).not.toBeChecked();
    await expect(page.locator('#state-checkbox')).toHaveJSProperty(
        'indeterminate',
        false,
    );
    await expect(page.locator('#state-checkbox')).toHaveValue('on');
    await expect(page.locator('#state-checkbox')).not.toHaveAttribute('value');
    await expect(page.locator('#state-radio-a')).toBeChecked();
    await expect(page.locator('#state-radio-b')).not.toBeChecked();
    await expect(page.locator('#state-file')).toHaveValue('');
    await expect(page.locator('#state-submit')).not.toHaveAttribute('value');
    await expect(page.locator('#state-select')).toHaveValue('a');
    await expect(page.locator('#state-multiple')).toHaveValues(['a', 'c']);
    await expect(page.locator('#state-list')).toHaveJSProperty(
        'selectedIndex',
        -1,
    );
    await expect(page.locator('#state-disabled-first')).toHaveValue('b');
    await expect(page.locator('#state-saved-draft')).toHaveValue('saved draft');
});

test('a persistent radio selection wins over the next page default in its form group', async ({
    page,
}) => {
    await renderArticles(
        page,
        () =>
            '<form><input id="state-choice-a" type="radio" name="state-choice" value="a" checked><div data-astro-transition-persist="state-choice"><input id="state-choice-b" type="radio" name="state-choice" value="b"></div></form>',
    );
    await openFirst(page);
    await page.locator('#state-choice-b').check();
    await openNext(page);
    await expect(page.locator('#state-choice-b')).toBeChecked();
    await expect(page.locator('#state-choice-a')).not.toBeChecked();
});

for (const placement of ['article', 'body']) {
    test(`a ${placement}-level persistent radio keeps explicit form ownership and its selection`, async ({
        page,
    }) => {
        await page.route(
            /\/posts\/(?:format-example|standalone-example)\/$/,
            async (route) => {
                const response = await route.fetch();
                const next = route
                    .request()
                    .url()
                    .includes('standalone-example');
                const widget =
                    '<div id="state-radio-widget" data-astro-transition-persist="explicit-form-choice"><input id="state-explicit-b" type="radio" name="explicit-choice" value="b" form="explicit-form"></div>';
                const fixture = `<section id="navigation-state-fixture" data-page="${next ? 'next' : 'first'}"><form id="explicit-form"><input id="state-explicit-a" type="radio" name="explicit-choice" value="a" checked></form>${placement === 'article' ? widget : ''}</section>`;
                const body = (await response.text()).replace(
                    /(<div\b[^>]*id="article-content"[^>]*>)/,
                    (_, opening: string) => opening + fixture,
                );
                await route.fulfill({
                    response,
                    body:
                        placement === 'body'
                            ? body.replace('</body>', `${widget}</body>`)
                            : body,
                });
            },
        );
        await openFirst(page);
        await page.locator('#state-explicit-b').check();
        await openNext(page);
        await expect(page.locator('#state-explicit-b')).toBeChecked();
        await expect(page.locator('#state-explicit-a')).not.toBeChecked();
    });
}

test('a nested persistent node can leave its persistent parent without duplication', async ({
    page,
}) => {
    await renderArticles(page, (next) => {
        const inner =
            '<span id="state-leaving-inner" data-astro-transition-persist="leaving-inner">inner</span>';
        return `<div id="state-staying-outer" data-astro-transition-persist="staying-outer">${next ? '' : inner}</div>${next ? inner : ''}`;
    });
    await openFirst(page);
    await page.evaluate(() => {
        const scope = window as Window & {
            leavingInner?: Element | null;
            stayingOuter?: Element | null;
        };
        scope.leavingInner = document.querySelector('#state-leaving-inner');
        scope.stayingOuter = document.querySelector('#state-staying-outer');
    });
    await openNext(page);
    await expect(page.locator('#state-leaving-inner')).toHaveCount(1);
    expect(
        await page.evaluate(() => {
            const scope = window as Window & {
                leavingInner?: Element | null;
                stayingOuter?: Element | null;
            };
            return (
                document.querySelector('#state-leaving-inner') ===
                    scope.leavingInner &&
                document.querySelector('#state-staying-outer') ===
                    scope.stayingOuter &&
                !scope.stayingOuter!.contains(scope.leavingInner!)
            );
        }),
    ).toBe(true);
});

for (const parentChange of ['new wrapper', 'replaced parent']) {
    for (const fallback of [false, true]) {
        test(`Astro persistence survives ${parentChange}${fallback ? ' without moveBefore' : ''}`, async ({
            page,
        }) => {
            if (fallback)
                await page.addInitScript(() =>
                    Object.defineProperty(Element.prototype, 'moveBefore', {
                        configurable: true,
                        value: undefined,
                    }),
                );
            await renderArticles(page, (next) => {
                const widget = `<div id="state-widget" data-astro-transition-persist="state-widget"><input id="state-widget-input" value="${next ? 'next' : 'first'}"><span id="state-inner" data-astro-transition-persist="state-inner">nested</span><iframe id="state-frame" title="state frame" srcdoc="<p>frame</p>"></iframe></div>`;
                if (parentChange === 'replaced parent')
                    return next
                        ? `<section id="state-new-parent">${widget}</section>`
                        : `<div id="state-old-parent">${widget}</div>`;
                return `<div id="state-parent">${next ? `<section>${widget}</section>` : widget}</div>`;
            });
            await openFirst(page);
            await page.locator('#state-widget-input').fill('draft');
            await page
                .locator('#state-widget-input')
                .evaluate((node) =>
                    (node as HTMLInputElement).setSelectionRange(1, 3),
                );
            await page
                .frameLocator('#state-frame')
                .locator('body')
                .evaluate((node) => (node.dataset.savedState = 'keep'));
            await page.evaluate(() => {
                const scope = window as Window & {
                    previousWidget?: Element | null;
                    previousInner?: Element | null;
                };
                scope.previousWidget = document.querySelector('#state-widget');
                scope.previousInner = document.querySelector('#state-inner');
            });
            await openNext(page);
            expect(
                await page.evaluate(() => {
                    const scope = window as Window & {
                        previousWidget?: Element | null;
                        previousInner?: Element | null;
                    };
                    return (
                        document.querySelector('#state-widget') ===
                            scope.previousWidget &&
                        document.querySelector('#state-inner') ===
                            scope.previousInner
                    );
                }),
            ).toBe(true);
            await expect(page.locator('#state-widget')).toHaveCount(1);
            await expect(page.locator('#state-inner')).toHaveCount(1);
            await expect(page.locator('#state-widget-input')).toHaveValue(
                'draft',
            );
            await expect(page.locator('#state-widget-input')).toBeFocused();
            expect(
                await page
                    .locator('#state-widget-input')
                    .evaluate((node) => [
                        (node as HTMLInputElement).selectionStart,
                        (node as HTMLInputElement).selectionEnd,
                    ]),
            ).toEqual([1, 3]);
            // State-preserving iframe moves require the same native API Astro uses.
            if (!fallback)
                await expect(
                    page.frameLocator('#state-frame').locator('body'),
                ).toHaveAttribute('data-saved-state', 'keep');
        });
    }
}
