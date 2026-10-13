import assert from 'node:assert/strict';
import test from 'node:test';
import * as config from '../src/config.ts';

async function configuredAuthor() {
    const { getAuthor } = await import('../src/lib/author.ts');
    return getAuthor();
}

async function withProfile(
    profile: Record<string, unknown>,
    verify: () => Promise<void>,
) {
    assert.ok(
        config.author,
        'The personal author must be configured in src/config.ts',
    );
    const target = config.author as unknown as Record<string, unknown>;
    const original = { ...target };
    for (const key of Object.keys(target)) delete target[key];
    Object.assign(target, profile);
    try {
        await verify();
    } finally {
        for (const key of Object.keys(target)) delete target[key];
        Object.assign(target, original);
    }
}

const profile = {
    id: 'alice',
    name: 'Author',
    bio: 'A writer',
    avatar: '/avatar.svg',
};

test('the personal author config supplies the profile and contact links', async () => {
    const expected = {
        ...profile,
        location: 'Earth',
        description: 'Hello from Alice',
        role: 'Writer',
        interests: ['Writing'],
        social: [
            { label: 'Email', href: 'mailto:alice@example.com', icon: 'mail' },
            { label: 'WeChat', href: '', icon: 'wechat' },
        ],
    };
    await withProfile(expected, async () => {
        assert.deepEqual(await configuredAuthor(), expected);
    });
});

test('a personal author without configured contacts receives an empty list', async () => {
    for (const value of [profile, { ...profile, social: [] }]) {
        await withProfile(value, async () => {
            assert.deepEqual((await configuredAuthor()).social, []);
        });
    }
});

test('invalid author contacts report the configuration file and social field', async () => {
    for (const social of [
        null,
        'https://example.com',
        [{ href: '/contact/', icon: 'mail' }],
        [{ label: 'Email', href: 42, icon: 'mail' }],
        [{ label: 'Email', href: '/contact/', icon: false }],
    ]) {
        await withProfile({ ...profile, social }, async () => {
            await assert.rejects(
                configuredAuthor(),
                /Invalid author configuration in src\/config\.ts:.*social/s,
            );
        });
    }
});
