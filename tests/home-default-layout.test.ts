import assert from 'node:assert/strict';
import test from 'node:test';
import { homeCardSpecs } from '../src/components/home/card-specs.ts';
import { homePresets } from '../src/config/home-presets.ts';
import { compileHomeLayout } from '../src/lib/home-layout.ts';
import type { HomeConfig } from '../src/lib/home-cards.ts';
import {
    expectedHomeOrder,
    expectedHomePlacements,
    expectedHomeSizes,
} from './fixtures/home-layout.ts';

test('the default preset places all cards in the requested fixed rectangles', () => {
    const plan = compileHomeLayout(
        { preset: 'default' },
        homeCardSpecs,
        homePresets,
    );
    assert.deepEqual(
        plan.cards.map((card) => card.id),
        expectedHomeOrder,
    );
    for (const [name, expected] of Object.entries(expectedHomePlacements)) {
        const layout =
            plan.layouts[name as keyof typeof expectedHomePlacements];
        assert.deepEqual(
            Object.fromEntries(
                layout.placements.map((card) => [
                    card.id,
                    [card.row, card.column, card.columnSpan, card.rowSpan],
                ]),
            ),
            expected,
        );
    }
});

test('removed presets cannot be selected', () => {
    for (const preset of ['balanced', 'writing', 'minimal'])
        assert.throws(
            () =>
                compileHomeLayout(
                    { preset } as unknown as HomeConfig,
                    homeCardSpecs,
                    homePresets,
                ),
            /HOME_PRESET_UNKNOWN/,
        );
});

test('card registration retains only sizes used by the requested layouts', () => {
    for (const [id, sizes] of Object.entries(expectedHomeSizes))
        assert.deepEqual(
            Object.keys(
                homeCardSpecs[id as keyof typeof homeCardSpecs].sizes,
            ).sort(),
            [...sizes].sort(),
        );
});
