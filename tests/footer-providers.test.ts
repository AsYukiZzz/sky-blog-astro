import assert from 'node:assert/strict';
import test from 'node:test';
import { visibleFooterProviders } from '../src/lib/footer.ts';

function provider(name: string) {
    return {
        name,
        description: `${name} 服务说明`,
        url: 'https://example.com/',
    };
}

test('footer providers keep the configured order', () => {
    const providers = [provider('Cloudflare Pages'), provider('Vercel')];
    assert.deepEqual(visibleFooterProviders(providers), providers);
});

test('footer providers with blank names are skipped', () => {
    const providers = [
        provider('Cloudflare Pages'),
        provider('   '),
        provider('Vercel'),
    ];
    assert.deepEqual(visibleFooterProviders(providers), [
        providers[0],
        providers[2],
    ]);
});

test('an empty footer provider list stays empty', () => {
    assert.deepEqual(visibleFooterProviders([]), []);
});
