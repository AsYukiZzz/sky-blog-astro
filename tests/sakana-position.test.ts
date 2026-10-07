import assert from 'node:assert/strict';
import test from 'node:test';
import { sakanaFooterLift } from '../src/lib/sakana-position.ts';

test('footer clearance starts continuously instead of hiding or jumping the widget', () => {
    assert.equal(sakanaFooterLift(800, 900, 24), 0);
    assert.equal(sakanaFooterLift(800, 792, 24), 0);
    assert.equal(sakanaFooterLift(800, 791.75, 24), 0.25);
    assert.equal(sakanaFooterLift(800, 791.5, 24), 0.5);
});

test('the widget keeps its configured bottom inset or leaves a 16px gap above the footer', () => {
    for (const { viewport, bottom, footerTop } of [
        { viewport: 720, bottom: 24, footerTop: 580 },
        { viewport: 800, bottom: 48, footerTop: 630 },
        { viewport: 844, bottom: 96, footerTop: 700 },
        { viewport: 844, bottom: 96, footerTop: 810 },
    ]) {
        const lift = sakanaFooterLift(viewport, footerTop, bottom);
        const widgetBottom = viewport - bottom - lift;
        assert.ok(lift >= 0);
        assert.ok(
            widgetBottom <= footerTop - 16,
            'footer links must remain clear',
        );
        assert.ok(
            lift === 0 || widgetBottom === footerTop - 16,
            'only lift as far as needed',
        );
    }
});
