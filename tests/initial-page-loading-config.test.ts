import assert from 'node:assert/strict';
import test from 'node:test';
import { initialPageLoadingScript } from '../src/lib/initial-page-loading.ts';

test('loading configuration accepts both strategies and finite millisecond boundaries', () => {
    for (const strategy of ['wallpaper', 'content'] as const) {
        for (const maxWait of [0, 500, 3000, 2_147_483_647]) {
            assert.doesNotThrow(() =>
                initialPageLoadingScript(false, { strategy, maxWait }),
            );
        }
    }
});

test('an unknown loading strategy reports its configuration path', () => {
    for (const strategy of ['', 'image', false, null, undefined, '</script>']) {
        assert.throws(
            () =>
                initialPageLoadingScript(false, {
                    strategy,
                    maxWait: 3000,
                } as never),
            /theme\.global\.loading\.strategy/,
        );
    }
});

test('an invalid maximum wait reports its configuration path without timer overflow or coercion', () => {
    for (const maxWait of [
        -1,
        0.5,
        NaN,
        Infinity,
        -Infinity,
        2_147_483_648,
        '3000',
        null,
        undefined,
    ]) {
        assert.throws(
            () =>
                initialPageLoadingScript(false, {
                    strategy: 'wallpaper',
                    maxWait,
                } as never),
            /theme\.global\.loading\.maxWait/,
        );
    }
});
