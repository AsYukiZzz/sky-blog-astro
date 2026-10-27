import assert from 'node:assert/strict';
import test from 'node:test';
import { createPageLoadingLifecycle } from '../src/lib/page-loading.ts';

test('fast navigation completes without showing a loading layer', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const calls: string[] = [];
    const loading = createPageLoadingLifecycle(
        () => calls.push('show'),
        () => calls.push('hide'),
    );
    const navigation = new AbortController();
    loading.begin(navigation.signal);
    t.mock.timers.tick(179);
    loading.finish(navigation.signal);
    t.mock.timers.tick(1000);
    assert.deepEqual(calls, []);
});

test('slow navigation shows once and finishes without waiting for unrelated work', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const calls: string[] = [];
    const loading = createPageLoadingLifecycle(
        () => calls.push('show'),
        () => calls.push('hide'),
    );
    const navigation = new AbortController();
    loading.begin(navigation.signal);
    loading.begin(navigation.signal);
    t.mock.timers.tick(180);
    assert.deepEqual(calls, ['show']);
    loading.finish(navigation.signal);
    loading.finish(navigation.signal);
    navigation.abort();
    assert.deepEqual(calls, ['show', 'hide']);
});

for (const shown of [false, true]) {
    test(`aborting a ${shown ? 'visible' : 'pending'} navigation clears its loading state`, (t) => {
        t.mock.timers.enable({ apis: ['setTimeout'] });
        const calls: string[] = [];
        const loading = createPageLoadingLifecycle(
            () => calls.push('show'),
            () => calls.push('hide'),
        );
        const navigation = new AbortController();
        loading.begin(navigation.signal);
        if (shown) t.mock.timers.tick(180);
        navigation.abort();
        t.mock.timers.tick(1000);
        assert.deepEqual(calls, shown ? ['show', 'hide'] : []);
    });
}

test('an old completion or abort cannot finish the newer navigation', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const calls: string[] = [];
    const loading = createPageLoadingLifecycle(
        () => calls.push('show'),
        () => calls.push('hide'),
    );
    const old = new AbortController();
    const current = new AbortController();
    loading.begin(old.signal);
    t.mock.timers.tick(100);
    loading.begin(current.signal);
    old.abort();
    loading.finish(old.signal);
    t.mock.timers.tick(179);
    assert.deepEqual(calls, []);
    t.mock.timers.tick(1);
    assert.deepEqual(calls, ['show']);
    loading.finish(old.signal);
    assert.deepEqual(calls, ['show']);
    loading.finish(current.signal);
    assert.deepEqual(calls, ['show', 'hide']);
});

test('reset removes both pending work and an already visible loading layer', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const calls: string[] = [];
    const loading = createPageLoadingLifecycle(
        () => calls.push('show'),
        () => calls.push('hide'),
    );
    loading.begin(new AbortController().signal);
    loading.reset();
    t.mock.timers.tick(1000);
    assert.deepEqual(calls, []);
    loading.begin(new AbortController().signal);
    t.mock.timers.tick(180);
    loading.reset();
    loading.reset();
    assert.deepEqual(calls, ['show', 'hide']);
});

test('an already aborted request never replaces the live navigation', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const calls: string[] = [];
    const loading = createPageLoadingLifecycle(
        () => calls.push('show'),
        () => calls.push('hide'),
    );
    const current = new AbortController();
    const cancelled = new AbortController();
    cancelled.abort();
    loading.begin(current.signal);
    loading.begin(cancelled.signal);
    t.mock.timers.tick(180);
    assert.deepEqual(calls, ['show']);
    loading.finish(current.signal);
    assert.deepEqual(calls, ['show', 'hide']);
});
