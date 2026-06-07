/**
 * Tests for svgSanitizer module
 */

import { sanitizeSvgForEditor, prepareSvgForCanvas } from '../../src/renderer/svgSanitizer';

describe('svgSanitizer', () => {
  describe('sanitizeSvgForEditor', () => {
    it('should strip SVG Edit internal attributes', () => {
      const input = '<svg data-id="1" data-editable="true" xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
      const result = sanitizeSvgForEditor(input);
      expect(result).not.toContain('data-id');
      expect(result).not.toContain('data-editable');
      expect(result).toContain('rect');
    });

    it('should strip se:guide elements', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><se:guide x1="0" y1="0"/><rect/></svg>';
      const result = sanitizeSvgForEditor(input);
      expect(result).not.toContain('se:guide');
      expect(result).toContain('rect');
    });

    it('should strip metadata elements', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><metadata></metadata><rect/></svg>';
      const result = sanitizeSvgForEditor(input);
      expect(result).not.toContain('metadata');
      expect(result).toContain('rect');
    });

    it('should preserve standard SVG attributes', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="red"/></svg>';
      const result = sanitizeSvgForEditor(input);
      expect(result).toContain('width="100"');
      expect(result).toContain('height="100"');
      expect(result).toContain('fill="red"');
    });

    it('should handle empty input', () => {
      expect(sanitizeSvgForEditor('')).toBe('');
    });

    it('should handle null/undefined input', () => {
      expect(sanitizeSvgForEditor(null as any)).toBeNull();
      expect(sanitizeSvgForEditor(undefined as any)).toBeUndefined();
    });

    it('should strip internal classes but preserve user classes', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect class="user-class se-selected"/></svg>';
      const result = sanitizeSvgForEditor(input);
      expect(result).toContain('user-class');
      expect(result).not.toContain('se-selected');
    });

    it('should remove class attribute if all classes are internal', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect class="se-selected se-active"/></svg>';
      const result = sanitizeSvgForEditor(input);
      expect(result).not.toContain('class=');
    });

    it('should not corrupt text content', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><text>Hello  World   Test</text></svg>';
      const result = sanitizeSvgForEditor(input);
      expect(result).toContain('Hello');
      expect(result).toContain('World');
      expect(result).toContain('Test');
    });
  });

  describe('prepareSvgForCanvas', () => {
    it('should add xmlns if missing', () => {
      const input = '<svg width="100" height="100"><rect/></svg>';
      const result = prepareSvgForCanvas(input);
      expect(result).toContain('xmlns="http://www.w3.org/2000/svg"');
    });

    it('should not add xmlns if already present', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg" width="100"><rect/></svg>';
      const result = prepareSvgForCanvas(input);
      const matches = result.match(/xmlns=/g);
      expect(matches).toHaveLength(1);
    });

    it('should add xmlns:xlink if xlink:href is used', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><use xlink:href="#test"/></svg>';
      const result = prepareSvgForCanvas(input);
      expect(result).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
    });

    it('should not add xmlns:xlink if already present', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#test"/></svg>';
      const result = prepareSvgForCanvas(input);
      const matches = result.match(/xmlns:xlink=/g);
      expect(matches).toHaveLength(1);
    });

    it('should handle empty input', () => {
      expect(prepareSvgForCanvas('')).toBe('');
    });
  });
});
