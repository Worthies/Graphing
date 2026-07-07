import * as assert from 'assert';
import { computeMoveUpdates, isPhase1Shape } from '../../src/node/moveDelta';
import { XmlElement, ElementPositionsOnText } from '../../src/isomorphism/xmlParser';

function elem(tag: string, attrs: Record<string, string>): XmlElement {
    const positions: ElementPositionsOnText = {
        interval: { start: 0, end: 0 },
        openElement: { start: 0, end: 0 },
        closeElement: null,
        startTag: { start: 0, end: 0 },
        endTag: null,
        attrs: {}
    };
    for (const k of Object.keys(attrs)) {
        positions.attrs[k] = { name: { start: 0, end: 0 }, value: { start: 0, end: 0 } };
    }
    return { type: 'element', tag, attrs: { ...attrs }, children: [], positions };
}

describe('computeMoveUpdates', () => {
    it('rect: shifts x and y', () => {
        const r = elem('rect', { x: '10', y: '20', width: '5', height: '5' });
        assert.deepStrictEqual(computeMoveUpdates(r, 3, -4, 1), [
            { name: 'x', newValue: '13' },
            { name: 'y', newValue: '16' }
        ]);
    });

    it('rect: missing x defaults to 0', () => {
        const r = elem('rect', { width: '5', height: '5' });
        assert.deepStrictEqual(computeMoveUpdates(r, 3, 4, 1), [
            { name: 'x', newValue: '3' },
            { name: 'y', newValue: '4' }
        ]);
    });

    it('rect: fractional respects decimalPlaces', () => {
        const r = elem('rect', { x: '10', y: '20' });
        assert.deepStrictEqual(computeMoveUpdates(r, 0.333, 0.666, 1), [
            { name: 'x', newValue: '10.3' },
            { name: 'y', newValue: '20.7' }
        ]);
    });

    it('circle: shifts cx and cy', () => {
        const c = elem('circle', { cx: '50', cy: '60', r: '10' });
        assert.deepStrictEqual(computeMoveUpdates(c, -5, 2, 1), [
            { name: 'cx', newValue: '45' },
            { name: 'cy', newValue: '62' }
        ]);
    });

    it('ellipse: shifts cx and cy', () => {
        const e = elem('ellipse', { cx: '50', cy: '60', rx: '10', ry: '5' });
        assert.deepStrictEqual(computeMoveUpdates(e, 1, 1, 1), [
            { name: 'cx', newValue: '51' },
            { name: 'cy', newValue: '61' }
        ]);
    });

    it('line: shifts all four endpoints', () => {
        const l = elem('line', { x1: '10', y1: '20', x2: '30', y2: '40' });
        assert.deepStrictEqual(computeMoveUpdates(l, 5, -5, 1), [
            { name: 'x1', newValue: '15' },
            { name: 'y1', newValue: '15' },
            { name: 'x2', newValue: '35' },
            { name: 'y2', newValue: '35' }
        ]);
    });

    it('text: shifts x and y', () => {
        const t = elem('text', { x: '100', y: '200' });
        assert.deepStrictEqual(computeMoveUpdates(t, 10, 10, 1), [
            { name: 'x', newValue: '110' },
            { name: 'y', newValue: '210' }
        ]);
    });

    it('polyline: shifts each point pair, preserves separator style', () => {
        const p = elem('polyline', { points: '10,20 30,40 50,60' });
        assert.deepStrictEqual(computeMoveUpdates(p, 1, 2, 1), [
            { name: 'points', newValue: '11,22 31,42 51,62' }
        ]);
    });

    it('polygon: same as polyline', () => {
        const p = elem('polygon', { points: '0,0 10,0 10,10 0,10' });
        assert.deepStrictEqual(computeMoveUpdates(p, 5, 5, 1), [
            { name: 'points', newValue: '5,5 15,5 15,15 5,15' }
        ]);
    });

    it('polyline: whitespace-separated pairs work', () => {
        const p = elem('polyline', { points: '10 20 30 40 50 60' });
        assert.deepStrictEqual(computeMoveUpdates(p, 1, 1, 1), [
            { name: 'points', newValue: '11 21 31 41 51 61' }
        ]);
    });

    it('polyline: odd number of coords returns []', () => {
        const p = elem('polyline', { points: '10,20 30,40 50' });
        assert.deepStrictEqual(computeMoveUpdates(p, 1, 1, 1), []);
    });

    it('path is unsupported (Phase 2) → returns []', () => {
        const p = elem('path', { d: 'M0,0 L10,10' });
        assert.deepStrictEqual(computeMoveUpdates(p, 1, 1, 1), []);
    });

    it('g is unsupported (Phase 2) → returns []', () => {
        const g = elem('g', {});
        assert.deepStrictEqual(computeMoveUpdates(g, 1, 1, 1), []);
    });

    it('element with existing transform → returns [] (Phase 2)', () => {
        const r = elem('rect', { x: '10', y: '20', transform: 'rotate(45)' });
        assert.deepStrictEqual(computeMoveUpdates(r, 1, 1, 1), []);
    });

    it('unknown tag → returns []', () => {
        const u = elem('foo', { x: '10', y: '20' });
        assert.deepStrictEqual(computeMoveUpdates(u, 1, 1, 1), []);
    });

    it('trims trailing zeros within decimalPlaces', () => {
        const r = elem('rect', { x: '10', y: '20' });
        assert.deepStrictEqual(computeMoveUpdates(r, 0, 0, 3), [
            { name: 'x', newValue: '10' },
            { name: 'y', newValue: '20' }
        ]);
    });
});

describe('isPhase1Shape', () => {
    it('returns true for supported tags', () => {
        for (const t of ['rect', 'circle', 'ellipse', 'line', 'text', 'tspan',
                         'image', 'use', 'svg', 'foreignObject', 'polyline', 'polygon']) {
            assert.strictEqual(isPhase1Shape(t), true, t);
        }
    });
    it('returns false for path, g, unknown', () => {
        for (const t of ['path', 'g', 'defs', 'marker', 'symbol', 'foo']) {
            assert.strictEqual(isPhase1Shape(t), false, t);
        }
    });
});
