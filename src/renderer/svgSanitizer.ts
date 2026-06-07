/**
 * SVG string sanitizer for bridging SVG Edit canvas and VS Code text editor.
 * Uses DOMParser for reliable parsing instead of fragile regex.
 */

// Attributes added by SVG Edit that should be stripped from output
const SVGEDIT_INTERNAL_ATTRS = new Set([
  'data-id',
  'data-editable',
  'data-lock',
  'data-xmlns',
  'se:connector',
  'se:nonce'
]);

// Internal class prefixes added by SVG Edit
const SVGEDIT_CLASS_PREFIXES = ['se-', 'svg_edit_'];

/**
 * Check if a class attribute value is purely SVG Edit internal classes
 */
function isInternalClassOnly(classValue: string): boolean {
  const classes = classValue.split(/\s+/).filter(Boolean);
  if (classes.length === 0) return true;
  return classes.every(function(cls: string) {
    return SVGEDIT_CLASS_PREFIXES.some(function(prefix) { return cls.indexOf(prefix) === 0; });
  });
}

/**
 * Strip SVG Edit internal attributes and elements from SVG string.
 * Called when sending SVG from canvas back to VS Code text editor.
 */
export function sanitizeSvgForEditor(svgString: string): string {
  if (!svgString) return svgString;

  try {
    var parser = new DOMParser();
    var doc = parser.parseFromString(svgString, 'image/svg+xml');

    // Check for parse errors
    var errorNode = doc.querySelector('parsererror');
    if (errorNode) {
      return svgString;
    }

    var root = doc.documentElement;
    if (!root) return svgString;

    // Remove SVG Edit internal attributes from all elements
    var allElements = root.querySelectorAll('*');
    var elements = Array.from(allElements);
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];

      // Remove known internal attributes
      SVGEDIT_INTERNAL_ATTRS.forEach(function(attr) {
        if (el.hasAttribute(attr)) {
          el.removeAttribute(attr);
        }
      });

      // Handle class attribute: remove if all classes are internal
      var classValue = el.getAttribute('class');
      if (classValue !== null) {
        if (isInternalClassOnly(classValue)) {
          el.removeAttribute('class');
        } else {
          // Remove only internal classes, keep user-defined ones
          var userClasses = classValue.split(/\s+/).filter(function(cls) {
            return cls && !SVGEDIT_CLASS_PREFIXES.some(function(prefix) { return cls.indexOf(prefix) === 0; });
          });
          if (userClasses.length > 0) {
            el.setAttribute('class', userClasses.join(' '));
          } else {
            el.removeAttribute('class');
          }
        }
      }

      // Remove se: prefixed attributes
      var attrsToRemove: string[] = [];
      var attrs = Array.from(el.attributes);
      for (var j = 0; j < attrs.length; j++) {
        if (attrs[j].name.indexOf('se:') === 0 && !SVGEDIT_INTERNAL_ATTRS.has(attrs[j].name)) {
          attrsToRemove.push(attrs[j].name);
        }
      }
      for (var k = 0; k < attrsToRemove.length; k++) {
        el.removeAttribute(attrsToRemove[k]);
      }
    }

    // Remove se:guide elements
    var guides = root.querySelectorAll('se\\:guide, guide');
    var guideElements = Array.from(guides);
    for (var g = 0; g < guideElements.length; g++) {
      var guide = guideElements[g];
      if (guide.parentNode) {
        guide.parentNode.removeChild(guide);
      }
    }

    // Remove empty metadata elements
    var metadata = root.querySelectorAll('metadata');
    var metaElements = Array.from(metadata);
    for (var m = 0; m < metaElements.length; m++) {
      var meta = metaElements[m];
      var textContent = meta.textContent || '';
      if (meta.children.length === 0 || textContent.trim() === '') {
        if (meta.parentNode) {
          meta.parentNode.removeChild(meta);
        }
      }
    }

    // Serialize back to string
    var serializer = new XMLSerializer();
    return serializer.serializeToString(root);
  } catch (e) {
    // Fallback: return original if DOM parsing fails
    return svgString;
  }
}

/**
 * Prepare SVG string for setting on SVG Edit canvas.
 * Ensures required namespace declarations exist.
 */
export function prepareSvgForCanvas(svgString: string): string {
  if (!svgString) return svgString;

  try {
    var parser = new DOMParser();
    var doc = parser.parseFromString(svgString, 'image/svg+xml');

    var errorNode = doc.querySelector('parsererror');
    if (errorNode) {
      return prepareSvgForCanvasFallback(svgString);
    }

    var root = doc.documentElement;
    if (!root) return prepareSvgForCanvasFallback(svgString);

    var modified = false;

    // Ensure xmlns is present
    if (!root.getAttribute('xmlns')) {
      root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      modified = true;
    }

    // Ensure xmlns:xlink if xlink:href is used
    if (svgString.indexOf('xlink:href') !== -1 && !root.getAttribute('xmlns:xlink')) {
      root.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', 'http://www.w3.org/1999/xlink');
      modified = true;
    }

    if (modified) {
      var serializer = new XMLSerializer();
      return serializer.serializeToString(root);
    }

    return svgString;
  } catch (e) {
    return prepareSvgForCanvasFallback(svgString);
  }
}

/**
 * Regex-based fallback for prepareSvgForCanvas when DOMParser fails.
 */
function prepareSvgForCanvasFallback(svgString: string): string {
  var prepared = svgString;

  if (prepared.indexOf('<svg') !== -1 && prepared.indexOf('xmlns=') === -1) {
    prepared = prepared.replace(
      '<svg',
      '<svg xmlns="http://www.w3.org/2000/svg"'
    );
  }

  if (prepared.indexOf('xlink:href') !== -1 && prepared.indexOf('xmlns:xlink') === -1) {
    prepared = prepared.replace(
      '<svg',
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink"'
    );
  }

  return prepared;
}
