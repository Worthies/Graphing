/**
 * Tests for svgDiffToOperations module
 */

import { computeSvgDiff, CanvasOperation, SvgDiffResult } from '../../src/renderer/svgDiffToOperations';

describe('svgDiffToOperations', () => {
  describe('computeSvgDiff', () => {
    it('should return noChanges status for identical SVGs', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>';
      const result = computeSvgDiff(svg, svg);
      expect(result.status).toBe('noChanges');
      expect(result.operations).toEqual([]);
    });

    it('should detect attribute changes', () => {
      const oldSvg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>';
      const newSvg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="200" height="100"/></svg>';
      const result = computeSvgDiff(oldSvg, newSvg);

      expect(result.status).toBe('diff');
      expect(result.operations.length).toBeGreaterThan(0);
      expect(result.operations[0].type).toBe('setAttribute');
      expect(result.operations[0].attributes).toHaveProperty('width', '200');
    });

    it('should detect added elements', () => {
      const oldSvg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
      const newSvg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>';
      const result = computeSvgDiff(oldSvg, newSvg);

      expect(result.status).toBe('diff');
      expect(result.operations.some(op => op.type === 'addElement')).toBe(true);
    });

    it('should detect removed elements', () => {
      const oldSvg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>';
      const newSvg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
      const result = computeSvgDiff(oldSvg, newSvg);

      expect(result.status).toBe('diff');
      expect(result.operations.some(op => op.type === 'removeElement')).toBe(true);
    });

    it('should detect replaced elements', () => {
      const oldSvg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100"/></svg>';
      const newSvg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="50"/></svg>';
      const result = computeSvgDiff(oldSvg, newSvg);

      expect(result.status).toBe('diff');
      expect(result.operations.some(op => op.type === 'replaceElement')).toBe(true);
    });

    it('should return parseError for invalid SVG', () => {
      const result = computeSvgDiff('invalid', 'also invalid');
      expect(result.status).toBe('parseError');
      expect(result.operations).toEqual([]);
    });

    it('should return parseError for different root elements', () => {
      const oldSvg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
      const newSvg = '<div>not svg</div>';
      const result = computeSvgDiff(oldSvg, newSvg);
      expect(result.status).toBe('parseError');
      expect(result.operations).toEqual([]);
    });

    it('should handle nested elements', () => {
      const oldSvg = '<svg xmlns="http://www.w3.org/2000/svg"><g><rect width="100"/></g></svg>';
      const newSvg = '<svg xmlns="http://www.w3.org/2000/svg"><g><rect width="200"/></g></svg>';
      const result = computeSvgDiff(oldSvg, newSvg);

      expect(result.status).toBe('diff');
      expect(result.operations.length).toBeGreaterThan(0);
      expect(result.operations[0].xpath).toContain('/g/');
    });

    it('should detect attribute removal', () => {
      const oldSvg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="red"/></svg>';
      const newSvg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>';
      const result = computeSvgDiff(oldSvg, newSvg);

      expect(result.status).toBe('diff');
      expect(result.operations.length).toBeGreaterThan(0);
      expect(result.operations[0].attributes).toHaveProperty('fill', '');
    });
  });
});
