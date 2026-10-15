import assert from 'node:assert/strict';
import test from 'node:test';
import { heroImageSources, randomHeroImage } from '../src/lib/hero-images.ts';

test('a single hero image remains supported and blank paths are ignored', () => {
    assert.deepEqual(heroImageSources('/images/cover.webp'), [
        '/images/cover.webp',
    ]);
    assert.deepEqual(heroImageSources('   '), []);
    assert.deepEqual(heroImageSources([]), []);
    assert.deepEqual(
        heroImageSources([
            '',
            ' /images/first.webp ',
            '  ',
            '/images/第二张.webp',
        ]),
        ['/images/first.webp', '/images/第二张.webp'],
    );
});

test('each random selection can choose any configured hero image', () => {
    const images = ['/first.webp', '/second.webp', '/third.webp'];
    assert.equal(
        randomHeroImage(images, () => 0),
        '/first.webp',
    );
    assert.equal(
        randomHeroImage(images, () => 0.5),
        '/second.webp',
    );
    assert.equal(
        randomHeroImage(images, () => 0.999),
        '/third.webp',
    );
    assert.deepEqual(images, ['/first.webp', '/second.webp', '/third.webp']);
});

test('missing hero images do not produce a source URL', () => {
    assert.equal(randomHeroImage([]), undefined);
    assert.equal(
        randomHeroImage(['/only.webp'], () => 0.999),
        '/only.webp',
    );
});
