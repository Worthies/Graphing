/**
 * Tests for polygonToRect module
 */

import { parsePoints, computeBBox, polygonToRect } from '../../src/renderer/polygonToRect';
import * as assert from 'assert';

describe('polygonToRect', () => {
  describe('parsePoints', () => {
    it('should parse comma-separated coordinate pairs', () => {
      const result = parsePoints('10,20 30,40 50,60');
      assert.deepStrictEqual(result, [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
        { x: 50, y: 60 }
      ]);
    });

    it('should handle extra whitespace', () => {
      const result = parsePoints('  10,20   30,40  ');
      assert.deepStrictEqual(result, [
        { x: 10, y: 20 },
        { x: 30, y: 40 }
      ]);
    });

    it('should handle decimal coordinates', () => {
      const result = parsePoints('1.5,2.5 3.5,4.5');
      assert.deepStrictEqual(result, [
        { x: 1.5, y: 2.5 },
        { x: 3.5, y: 4.5 }
      ]);
    });
  });

  describe('computeBBox', () => {
    it('should compute bounding box for 4 points', () => {
      const points = [
        { x: 10, y: 20 },
        { x: 50, y: 20 },
        { x: 50, y: 60 },
        { x: 10, y: 60 }
      ];
      const result = computeBBox(points);
      assert.deepStrictEqual(result, { x: 10, y: 20, width: 40, height: 40 });
    });

    it('should compute bounding box for 5 points (closed polygon)', () => {
      const points = [
        { x: 10, y: 20 },
        { x: 50, y: 20 },
        { x: 50, y: 60 },
        { x: 10, y: 60 },
        { x: 10, y: 20 }
      ];
      const result = computeBBox(points);
      assert.deepStrictEqual(result, { x: 10, y: 20, width: 40, height: 40 });
    });

    it('should return null for non-rectangular point count', () => {
      const points = [
        { x: 10, y: 20 },
        { x: 50, y: 20 },
        { x: 50, y: 60 }
      ];
      const result = computeBBox(points);
      assert.strictEqual(result, null);
    });

    it('should return null for 5 points where last != first', () => {
      const points = [
        { x: 10, y: 20 },
        { x: 50, y: 20 },
        { x: 50, y: 60 },
        { x: 10, y: 60 },
        { x: 99, y: 99 }
      ];
      const result = computeBBox(points);
      assert.strictEqual(result, null);
    });

    it('should handle non-axis-aligned rectangle (bounding box)', () => {
      const points = [
        { x: 30, y: 10 },
        { x: 50, y: 30 },
        { x: 30, y: 50 },
        { x: 10, y: 30 }
      ];
      const result = computeBBox(points);
      assert.deepStrictEqual(result, { x: 10, y: 10, width: 40, height: 40 });
    });
  });

  describe('polygonToRect', () => {
    it('should replace a self-closing polygon with a rect', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><polygon points="10,20 50,20 50,60 10,60"/></svg>';
      const result = polygonToRect(svg, '10,20 50,20 50,60 10,60');
      assert.strictEqual(result.replaced, true);
      assert.ok(result.svg.indexOf('<rect') !== -1);
      assert.ok(result.svg.indexOf('<polygon') === -1);
      assert.ok(result.svg.indexOf('x="10"') !== -1);
      assert.ok(result.svg.indexOf('y="20"') !== -1);
      assert.ok(result.svg.indexOf('width="40"') !== -1);
      assert.ok(result.svg.indexOf('height="40"') !== -1);
    });

    it('should replace a self-closing polygon with trailing space', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><polygon points="10,20 50,20 50,60 10,60" /></svg>';
      const result = polygonToRect(svg, '10,20 50,20 50,60 10,60');
      assert.strictEqual(result.replaced, true);
      assert.ok(result.svg.indexOf('<rect') !== -1);
      assert.ok(result.svg.indexOf('<polygon') === -1);
    });

    it('should replace a polyline with a rect', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><polyline points="0,0 100,0 100,50 0,50"/></svg>';
      const result = polygonToRect(svg, '0,0 100,0 100,50 0,50');
      assert.strictEqual(result.replaced, true);
      assert.ok(result.svg.indexOf('<rect') !== -1);
      assert.ok(result.svg.indexOf('<polyline') === -1);
      assert.ok(result.svg.indexOf('width="100"') !== -1);
      assert.ok(result.svg.indexOf('height="50"') !== -1);
    });

    it('should preserve fill attribute', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><polygon fill="red" points="10,20 50,20 50,60 10,60"/></svg>';
      const result = polygonToRect(svg, '10,20 50,20 50,60 10,60');
      assert.strictEqual(result.replaced, true);
      assert.ok(result.svg.indexOf('fill="red"') !== -1);
    });

    it('should preserve stroke attributes', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><polygon stroke="blue" stroke-width="2" points="10,20 50,20 50,60 10,60"/></svg>';
      const result = polygonToRect(svg, '10,20 50,20 50,60 10,60');
      assert.strictEqual(result.replaced, true);
      assert.ok(result.svg.indexOf('stroke="blue"') !== -1);
      assert.ok(result.svg.indexOf('stroke-width="2"') !== -1);
    });

    it('should preserve id attribute', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><polygon id="my-poly" points="10,20 50,20 50,60 10,60"/></svg>';
      const result = polygonToRect(svg, '10,20 50,20 50,60 10,60');
      assert.strictEqual(result.replaced, true);
      assert.ok(result.svg.indexOf('id="my-poly"') !== -1);
    });

    it('should preserve transform attribute', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><polygon transform="rotate(45)" points="10,20 50,20 50,60 10,60"/></svg>';
      const result = polygonToRect(svg, '10,20 50,20 50,60 10,60');
      assert.strictEqual(result.replaced, true);
      assert.ok(result.svg.indexOf('transform="rotate(45)"') !== -1);
    });

    it('should handle closed polygon with 5 points (last == first)', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><polygon points="10,20 50,20 50,60 10,60 10,20"/></svg>';
      const result = polygonToRect(svg, '10,20 50,20 50,60 10,60 10,20');
      assert.strictEqual(result.replaced, true);
      assert.ok(result.svg.indexOf('<rect') !== -1);
      assert.ok(result.svg.indexOf('width="40"') !== -1);
      assert.ok(result.svg.indexOf('height="40"') !== -1);
    });

    it('should not replace a triangle (3 points)', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><polygon points="10,20 50,20 30,60"/></svg>';
      const result = polygonToRect(svg, '10,20 50,20 30,60');
      assert.strictEqual(result.replaced, false);
      assert.strictEqual(result.svg, svg);
    });

    it('should not replace when points attribute is not found in SVG', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><polygon points="10,20 50,20 50,60 10,60"/></svg>';
      const result = polygonToRect(svg, '99,99 88,88 77,77 66,66');
      assert.strictEqual(result.replaced, false);
      assert.strictEqual(result.svg, svg);
    });

    it('should replace only the matching polygon when multiple exist', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<polygon points="0,0 10,0 10,10 0,10"/>' +
        '<polygon points="100,100 200,100 200,200 100,200"/>' +
        '</svg>';
      const result = polygonToRect(svg, '100,100 200,100 200,200 100,200');
      assert.strictEqual(result.replaced, true);
      assert.ok(result.svg.indexOf('points="0,0 10,0 10,10 0,10"') !== -1, 'first polygon should be preserved');
      assert.ok(result.svg.indexOf('<rect') !== -1);
      assert.ok(result.svg.indexOf('x="100"') !== -1);
      assert.ok(result.svg.indexOf('y="100"') !== -1);
      assert.ok(result.svg.indexOf('width="100"') !== -1);
      assert.ok(result.svg.indexOf('height="100"') !== -1);
    });

    it('should preserve surrounding elements', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<rect width="50" height="50"/>' +
        '<polygon points="10,20 50,20 50,60 10,60"/>' +
        '<circle cx="100" cy="100" r="25"/>' +
        '</svg>';
      const result = polygonToRect(svg, '10,20 50,20 50,60 10,60');
      assert.strictEqual(result.replaced, true);
      assert.ok(result.svg.indexOf('<rect width="50" height="50"/>') !== -1, 'original rect preserved');
      assert.ok(result.svg.indexOf('<circle cx="100" cy="100" r="25"/>') !== -1, 'circle preserved');
      assert.ok(result.svg.indexOf('x="10"') !== -1);
      assert.ok(result.svg.indexOf('y="20"') !== -1);
    });

    it('should handle polygon inside a group', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<g id="layer1">' +
        '<polygon points="10,20 50,20 50,60 10,60"/>' +
        '</g>' +
        '</svg>';
      const result = polygonToRect(svg, '10,20 50,20 50,60 10,60');
      assert.strictEqual(result.replaced, true);
      assert.ok(result.svg.indexOf('<rect') !== -1);
      assert.ok(result.svg.indexOf('id="layer1"') !== -1);
    });
  });
});
