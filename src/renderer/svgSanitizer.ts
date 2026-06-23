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
 * Resolve CSS custom properties in a raw SVG string.
 * Works entirely on string level — no DOMParser needed.
 * svgcanvas sanitizeSvg strips style attributes, so var() references break.
 * We collect all --custom-property definitions, resolve the dependency chain,
 * then replace every var() occurrence in the entire string.
 */
function resolveCssVariablesInString(svgString: string): string {
  if (svgString.indexOf('var(') === -1) return svgString;

  var vars: Record<string, string> = {};

  // 1. Collect variables from style="..." attributes (especially root <svg>)
  var styleAttrRe = /style="([^"]*)"/g;
  var sam: RegExpExecArray | null;
  while ((sam = styleAttrRe.exec(svgString)) !== null) {
    var styleVal = sam[1];
    var propRe = /--([\w_-]+)\s*:\s*([^;"]+)/g;
    var pm: RegExpExecArray | null;
    while ((pm = propRe.exec(styleVal)) !== null) {
      vars['--' + pm[1]] = pm[2].trim();
    }
  }

  // 2. Collect variables from <style>...</style> blocks
  var styleBlockRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  var sbm: RegExpExecArray | null;
  while ((sbm = styleBlockRe.exec(svgString)) !== null) {
    var css = sbm[1];
    var propRe2 = /--([\w_-]+)\s*:\s*([^;}\n]+)/g;
    var pm2: RegExpExecArray | null;
    while ((pm2 = propRe2.exec(css)) !== null) {
      vars['--' + pm2[1]] = pm2[2].trim();
    }
  }

  if (Object.keys(vars).length === 0) return svgString;

  // 3. Multi-pass resolution: variables can reference other variables
  for (var pass = 0; pass < 10; pass++) {
    var changed = false;
    for (var key in vars) {
      var resolved = resolveVarRefs(vars[key], vars);
      if (resolved !== vars[key]) {
        vars[key] = resolved;
        changed = true;
      }
    }
    if (!changed) break;
  }

  // 4. Replace all var() references throughout the entire SVG string
  var result = svgString;
  var prevResult = '';
  for (var ri = 0; ri < 10 && result !== prevResult; ri++) {
    prevResult = result;
    result = resolveVarRefs(result, vars);
  }

  return result;
}

function resolveVarRefs(value: string, vars: Record<string, string>): string {
  // Repeatedly resolve var() references (handles nested var() in fallbacks)
  var maxIter = 20;
  for (var iter = 0; iter < maxIter; iter++) {
    var idx = value.indexOf('var(');
    if (idx === -1) break;

    // Find the matching closing paren for var(...), starting AFTER the opening '('
    var depth = 1;
    var end = -1;
    for (var ci = idx + 4; ci < value.length; ci++) {
      if (value[ci] === '(') depth++;
      else if (value[ci] === ')') {
        depth--;
        if (depth === 0) { end = ci; break; }
      }
    }
    if (end === -1) break;

    var inside = value.substring(idx + 4, end).trim();
    // Split into var name and fallback at the first comma (after the var name)
    var commaIdx = inside.indexOf(',');
    var varName: string;
    var fallback: string | undefined;
    if (commaIdx !== -1) {
      varName = inside.substring(0, commaIdx).trim();
      fallback = inside.substring(commaIdx + 1).trim();
    } else {
      varName = inside.trim();
    }

    var resolved: string;
    if (vars[varName] !== undefined) {
      resolved = vars[varName];
    } else if (fallback !== undefined) {
      resolved = fallback;
    } else {
      // Can't resolve — leave as-is to avoid infinite loop
      break;
    }
    value = value.substring(0, idx) + resolved + value.substring(end + 1);
  }

  // Resolve color-mix() to approximated hex values
  value = resolveColorMix(value);
  return value;
}

function parseHexColor(c: string): [number, number, number] | null {
  c = c.trim();
  if (c[0] === '#') {
    var hex = c.substring(1);
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (hex.length === 6) {
      return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
    }
  }
  return null;
}

function toHex(n: number): string {
  var h = Math.round(Math.max(0, Math.min(255, n))).toString(16);
  return h.length === 1 ? '0' + h : h;
}

function resolveColorMix(value: string): string {
  // Match color-mix(in srgb, <color1> <pct>%, <color2>)
  var re = /color-mix\(\s*in\s+srgb\s*,\s*([^,]+?)\s+(\d+(?:\.\d+)?)%\s*,\s*([^)]+)\s*\)/g;
  return value.replace(re, function(_m, c1str, pctStr, c2str) {
    var rgb1 = parseHexColor(c1str.trim());
    var rgb2 = parseHexColor(c2str.trim());
    if (!rgb1 || !rgb2) return _m;
    var pct = parseFloat(pctStr) / 100;
    var r = rgb1[0] * pct + rgb2[0] * (1 - pct);
    var g = rgb1[1] * pct + rgb2[1] * (1 - pct);
    var b = rgb1[2] * pct + rgb2[2] * (1 - pct);
    return '#' + toHex(r) + toHex(g) + toHex(b);
  });
}

/**
 * Prepare SVG string for setting on SVG Edit canvas.
 * Ensures required namespace declarations exist and resolves CSS variables.
 */
export function prepareSvgForCanvas(svgString: string): string {
  if (!svgString) return svgString;

  // Resolve CSS custom properties first (string-based, no DOM dependency)
  var resolved = resolveCssVariablesInString(svgString);

  try {
    var parser = new DOMParser();
    var doc = parser.parseFromString(resolved, 'image/svg+xml');

    var errorNode = doc.querySelector('parsererror');
    if (errorNode) {
      return prepareSvgForCanvasFallback(resolved);
    }

    var root = doc.documentElement;
    if (!root) return prepareSvgForCanvasFallback(resolved);

    var modified = false;

    // Ensure xmlns is present
    if (!root.getAttribute('xmlns')) {
      root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      modified = true;
    }

    // Ensure xmlns:xlink if xlink:href is used
    if (resolved.indexOf('xlink:href') !== -1 && !root.getAttribute('xmlns:xlink')) {
      root.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', 'http://www.w3.org/1999/xlink');
      modified = true;
    }

    if (modified) {
      var serializer = new XMLSerializer();
      return serializer.serializeToString(root);
    }

    return resolved;
  } catch (e) {
    return prepareSvgForCanvasFallback(resolved);
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
