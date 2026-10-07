import assert from 'node:assert/strict';
import test from 'node:test';
import { createSakanaLifecycle } from '../src/lib/sakana-lifecycle.ts';

function fixture() {
    const controller = new AbortController();
    const calls: string[] = [];
    const widget = {
        mount() {
            calls.push('mount');
        },
        unmount() {
            calls.push('unmount');
        },
        dispose() {
            calls.push('dispose');
        },
    };
    let resolve!: (value: typeof widget) => void;
    const ready = new Promise<typeof widget>((done) => {
        resolve = done;
    });
    const lifecycle = createSakanaLifecycle(() => {
        calls.push('load');
        return ready;
    }, controller.signal);
    return { controller, calls, widget, resolve, lifecycle };
}

test('an inactive homepage does not download the widget; concurrent activation mounts once', async () => {
    const f = fixture();
    await f.lifecycle.setActive(false);
    assert.deepEqual(f.calls, []);
    const first = f.lifecycle.setActive(true);
    const second = f.lifecycle.setActive(true);
    f.resolve(f.widget);
    await Promise.all([first, second]);
    assert.deepEqual(f.calls, ['load', 'mount']);
    f.controller.abort();
});

test('a route change during download never mounts a widget on the next page', async () => {
    const f = fixture();
    const mounting = f.lifecycle.setActive(true);
    f.controller.abort();
    f.resolve(f.widget);
    await mounting;
    assert.deepEqual(f.calls, ['load', 'dispose']);
    await f.lifecycle.setActive(true);
    assert.deepEqual(f.calls, ['load', 'dispose']);
});

test('a mobile resize during download defers mounting until the widget is eligible again', async () => {
    const f = fixture();
    const mounting = f.lifecycle.setActive(true);
    await f.lifecycle.setActive(false);
    f.resolve(f.widget);
    await mounting;
    assert.deepEqual(f.calls, ['load']);
    await f.lifecycle.setActive(true);
    assert.deepEqual(f.calls, ['load', 'mount']);
    f.controller.abort();
});

test('temporary hiding stops the widget and resumes the same instance without duplicate cleanup', async () => {
    const f = fixture();
    f.resolve(f.widget);
    await f.lifecycle.setActive(true);
    await f.lifecycle.setActive(false);
    await f.lifecycle.setActive(false);
    await f.lifecycle.setActive(true);
    f.controller.abort();
    f.controller.abort();
    assert.deepEqual(f.calls, [
        'load',
        'mount',
        'unmount',
        'mount',
        'unmount',
        'dispose',
    ]);
});

test('a failed download can be retried on the next activation', async () => {
    const controller = new AbortController();
    let attempts = 0;
    let mounts = 0;
    const lifecycle = createSakanaLifecycle(async () => {
        if (++attempts === 1) throw new Error('offline');
        return {
            mount() {
                mounts++;
            },
            unmount() {},
            dispose() {},
        };
    }, controller.signal);
    await assert.rejects(lifecycle.setActive(true), /offline/);
    await lifecycle.setActive(true);
    assert.equal(attempts, 2);
    assert.equal(mounts, 1);
    controller.abort();
});
