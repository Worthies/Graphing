/**
 * Polygon-to-rectangle conversion logic.
 * Operates on SVG strings (pure, no DOM dependencies) so it can be unit tested.
 */

export interface PolygonToRectResult {
  svg: string;
  replaced: boolean;
}

/**
 * Parse a "x1,y1 x2,y2 ..." points string into coordinate pairs.
 */
export function parsePoints(pointsStr: string): { x: number; y: number }[] {
  return pointsStr.trim().split(/\s+/).map(function (p) {
    var parts = p.split(',');
    return { x: Number(parts[0]), y: Number(parts[1]) };
  });
}

/**
 * Given 4 corner points, compute the axis-aligned bounding box.
 * Returns null if the points do not form a valid rectangle (i.e. not 4 points).
 */
export function computeBBox(points: { x: number; y: number }[]): { x: number; y: number; width: number; height: number } | null {
  // Accept 4 points, or 5 points where the last equals the first (closed polygon)
  var rectPoints = points;
  if (points.length === 5 && points[0].x === points[4].x && points[0].y === points[4].y) {
    rectPoints = points.slice(0, 4);
  }
  if (rectPoints.length !== 4) return null;

  var xs = rectPoints.map(function (p) { return p.x; });
  var ys = rectPoints.map(function (p) { return p.y; });
  var minX = Math.min.apply(null, xs);
  var minY = Math.min.apply(null, ys);
  var maxX = Math.max.apply(null, xs);
  var maxY = Math.max.apply(null, ys);

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Find a <polygon> or <polyline> in the SVG string whose `points` attribute
 * matches `pointsStr`, and replace it with a <rect> computed from the bounding box.
 *
 * Returns the new SVG string and whether a replacement was made.
 */
export function polygonToRect(svgString: string, pointsStr: string): PolygonToRectResult {
  var points = parsePoints(pointsStr);
  var bbox = computeBBox(points);
  if (!bbox) return { svg: svgString, replaced: false };

  // Escape the points string for use in regex
  var escapedPoints = pointsStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Match either <polygon ... /> or <polyline ... />
  var tagRegex = new RegExp('<(polygon|polyline)\\b([^>]*?)points="' + escapedPoints + '"([^>]*?)/>', 'i');
  var match = tagRegex.exec(svgString);
  if (!match) return { svg: svgString, replaced: false };

  // Extract attributes from the matched tag (everything except the tag name and points)
  var beforePoints = match[2];
  var afterPoints = match[3];
  var allAttrs = beforePoints + afterPoints;

  // Build replacement rect tag
  var rectTag = '<rect';
  rectTag += ' x="' + bbox.x + '"';
  rectTag += ' y="' + bbox.y + '"';
  rectTag += ' width="' + bbox.width + '"';
  rectTag += ' height="' + bbox.height + '"';

  // Copy all other attributes from the original tag
  var attrRegex = /([a-zA-Z][\w:-]*)="([^"]*)"/g;
  var attrMatch: RegExpExecArray | null;
  var skipAttrs = ['points', 'x', 'y', 'width', 'height'];
  while ((attrMatch = attrRegex.exec(allAttrs)) !== null) {
    if (skipAttrs.indexOf(attrMatch[1]) === -1) {
      rectTag += ' ' + attrMatch[1] + '="' + attrMatch[2] + '"';
    }
  }
  rectTag += '/>';

  // Replace in SVG string (in-place)
  var newSvg = svgString.substring(0, match.index) + rectTag + svgString.substring(match.index + match[0].length);
  return { svg: newSvg, replaced: true };
}
