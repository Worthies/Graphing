/**
 * SVG Edit webview entry point.
 * Replaces the custom incremental-dom renderer with @svgedit/svgcanvas.
 */

import SvgCanvas from '@svgedit/svgcanvas';
import { SvgCanvasExtended, createSvgCanvasExtended } from './svgcanvas-types';
import { sanitizeSvgForEditor, prepareSvgForCanvas, diagnoseSvgError } from './svgSanitizer';
import { isPhase1Shape } from '../node/moveDelta';
import { computeSvgDiff, applyOperations } from './svgDiffToOperations';
import { SvgeditToolbar, DrawMode, Operation } from './svgeditToolbar';
import { SvgeditStylePanel, StyleState, ElementAttributes } from './svgeditStylePanel';
import { registerExtensions } from './svgeditExtensions';
import { logger, withSyncErrorHandling } from './logger';
import { debounce, requestIdleCallback } from './performance';
import { polygonToRect as convertPolygonToRect } from './polygonToRect';
import { initI18n, t } from './i18n';

declare function acquireVsCodeApi(): { postMessage(args: any): void };

const vscode = acquireVsCodeApi();

// Initialize i18n before any UI is built; missing/empty tag falls back to English.
initI18n(document.getElementById('graphing-locale')?.textContent ?? undefined);

// Surface uncaught errors as visible error messages instead of silent failure
window.addEventListener('error', (e: ErrorEvent) => {
  const detail = e.error?.message || e.message || t('errors.unknownWebviewError');
  vscode.postMessage({ command: 'error', data: t('errors.webviewError', { detail }) });
});
window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  const r: any = e.reason;
  const detail = (r && (r.message || r.toString())) || t('errors.unhandledRejection');
  vscode.postMessage({ command: 'error', data: t('errors.webviewError', { detail }) });
});

// State
let currentSvgString = '';
let isInternalChange = false;
let changeTimeout: number | null = null;

// Configuration from VS Code settings
const configuration = {
  indentStyle: 'space' as 'space' | 'tab',
  indentSize: 4,
  canvasWidth: '400px',
  canvasHeight: '400px'
};

// Get container element
const container = document.getElementById('graphing-content')!;

// Create layout structure
const header = document.createElement('header');
header.id = 'svgedit-toolbar';
const body = document.createElement('div');
body.id = 'svgedit-canvas-body';
body.style.cssText = 'flex: 1; overflow: auto; position: relative;';
const footer = document.createElement('footer');
footer.id = 'svgedit-style-panel';

container.appendChild(header);
container.appendChild(body);
container.appendChild(footer);

// Initialize SVG Canvas
let canvas: SvgCanvasExtended;
try {
  canvas = createSvgCanvasExtended(body, {
    canvasName: 'graphing',
    canvas_expansion: 1,
    initFill: { color: 'FFFFFF', opacity: 1 },
    initStroke: { width: 1, color: '000000', opacity: 1 },
    text: { stroke_width: 0, font_size: 24, font_family: 'serif' },
    initTool: 'select',
    wireframe: false,
    showlayers: true,
    no_save_warning: true,
    imgImport: true,
    baseUnit: 'px',
    snappingStep: 10,
    gridSnapping: false,
    dimensions: [400, 400],
    initOpacity: 1,
    show_outside_canvas: true,
    selectNew: true
  });
  logger.info('SVG Canvas initialized successfully');
} catch (error) {
  logger.error('Failed to initialize SVG Canvas', error);
  throw error; // Fatal error - cannot continue without canvas
}

// Register extensions
try {
  registerExtensions(canvas);
  logger.info('Extensions registered successfully');
} catch (error) {
  logger.warn('Some extensions failed to register', error);
}


// Override getMouseTarget to select shapes inside groups, but allow group selection too
const SHAPE_ELEMENTS = ['rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text', 'image', 'use'];

(canvas as any).getMouseTarget = function(evt: MouseEvent): SVGElement | null {
  if (!evt) return null;

  let mouseTarget = evt.target as SVGElement;

  // Handle use elements
  if ((mouseTarget as any).correspondingUseElement) {
    mouseTarget = (mouseTarget as any).correspondingUseElement;
  }

  // Never select canvasBackground or its children
  if (mouseTarget.id === 'canvasBackground' || mouseTarget.closest?.('#canvasBackground')) {
    return canvas.getSvgRoot();
  }

  // Get the canvas boundaries
  const svgRoot = canvas.getSvgRoot();
  const container = (canvas as any).getDOMContainer();
  const content = canvas.getSvgContent();
  const currentLayer = (canvas as any).getCurrentDrawing().getCurrentLayer();

  // If clicking on root/container/layer, return root
  if ([svgRoot, container, content, currentLayer].includes(mouseTarget)) {
    return svgRoot;
  }

  // If clicking on a selector grip, return selector parent group
  if (mouseTarget.closest && mouseTarget.closest('#selectorParentGroup')) {
    return (canvas as any).selectorManager.selectorParentGroup;
  }

  // If the target is a shape element, return it directly
  const targetTag = mouseTarget.tagName?.toLowerCase();
  if (targetTag && SHAPE_ELEMENTS.includes(targetTag)) {
    return mouseTarget;
  }

  // If the target is a group, return it (user clicked on group background)
  if (targetTag === 'g') {
    return mouseTarget;
  }

  // For other elements, walk up to find nearest shape or group
  let target = mouseTarget;
  while (target && target !== svgRoot && target !== content && target !== currentLayer) {
    const tagName = target.tagName?.toLowerCase();
    if (tagName && (SHAPE_ELEMENTS.includes(tagName) || tagName === 'g')) {
      return target;
    }
    target = target.parentNode as SVGElement;
  }

  // Fallback to original behavior
  return mouseTarget;
};

// Helper to get selected elements
function getSelectedElements(): SVGGraphicsElement[] {
  return (canvas.getSelectedElements() || []) as SVGGraphicsElement[];
}

// Initialize toolbar
const toolbar = new SvgeditToolbar(
  header,
  (mode: DrawMode) => {
    canvas.setMode(mode);
  },
  (op: Operation) => {
    handleOperation(op);
  }
);

// Initialize style panel
const stylePanel = new SvgeditStylePanel(
  footer,
  canvas,
  (style: StyleState, changes: Array<{name: string, newValue: string}>) => {
    // Keep the canvas visual in sync via svgcanvas.
    applyStyleToSelection(style);

    // Nothing surgical to send if nothing meaningfully changed
    // or if selection isn't exactly one element.
    if (!changes || changes.length === 0) return;
    const elems = getSelectedElements();
    if (elems.length !== 1) return;
    const el = elems[0];

    // Suppress the sendSvgUpdate that svgcanvas's 'changed' event would trigger,
    // and refresh the cached serialized string so a delayed sendSvgUpdate is a no-op.
    isInternalChange = true;
    try {
      currentSvgString = sanitizeSvgForEditor(canvas.getSvgString());
    } catch (err) {
      logger.warn('attribute-delta: currentSvgString refresh failed', err);
    }

    const elementId = el.id && !/^svg_\d+$/.test(el.id) ? el.id : null;
    vscode.postMessage({
      command: 'attribute-delta',
      tag: el.tagName,
      elementId,
      signature: getElementAttributes(el),
      updates: changes
    });

    setTimeout(() => { isInternalChange = false; }, 200);
  },
  (el: SVGElement, newText: string) => {
    // Optimistic canvas update so the visual matches immediately.
    isInternalChange = true;
    try {
      el.innerHTML = newText;
    } catch (err) {
      logger.warn('text-content-delta: canvas innerHTML update failed', err);
    }
    try {
      currentSvgString = sanitizeSvgForEditor(canvas.getSvgString());
    } catch (err) {
      logger.warn('text-content-delta: currentSvgString refresh failed', err);
    }

    const elementId = el.id && !/^svg_\d+$/.test(el.id) ? el.id : null;
    vscode.postMessage({
      command: 'text-content-delta',
      tag: 'text',
      elementId,
      signature: getElementAttributes(el),
      newText
    });

    // Keep the guard through the debounce window so trailing 'changed'
    // events from svgcanvas don't trigger a full sendSvgUpdate.
    setTimeout(() => { isInternalChange = false; }, 200);
  }
);

// Wire up canvas resize handler
stylePanel.setCanvasResizeHandler((width: number, height: number) => {
  canvas.setResolution(width, height);
  // Use the explicit target dimensions (not getResolution, which divides by zoom and can
  // return a scaled/stale value) so svgroot, svgContent and canvasBackground stay in sync.
  const svgRoot = canvas.getSvgRoot();
  const svgContent = canvas.getSvgContent();
  svgRoot.setAttribute('width', String(width));
  svgRoot.setAttribute('height', String(height));
  svgRoot.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
  svgRoot.setAttribute('x', '0');
  svgRoot.setAttribute('y', '0');
  svgContent.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
  resizeCanvasBackground(width, height);
  sendSvgUpdate();
});

// Wire up viewBox change handler
stylePanel.setViewBoxChangeHandler((viewBox: { x: number; y: number; w: number; h: number }) => {
  const svgRoot = canvas.getSvgRoot();
  const svgContent = canvas.getSvgContent();
  const vb = viewBox.x + ' ' + viewBox.y + ' ' + viewBox.w + ' ' + viewBox.h;
  svgRoot.setAttribute('viewBox', vb);
  svgContent.setAttribute('viewBox', vb);
  sendSvgUpdate();
});

// Apply style/attributes to selected elements
function applyStyleToSelection(attrs: any): void {
  try {
    // Use canvas.changeSelectedAttribute to trigger 'changed' event
    // This ensures changes are synced to the text editor
    if (attrs.fill !== undefined) canvas.changeSelectedAttribute('fill', attrs.fill);
    if (attrs.fillOpacity !== undefined) canvas.changeSelectedAttribute('fill-opacity', attrs.fillOpacity.toString());
    if (attrs.stroke !== undefined) canvas.changeSelectedAttribute('stroke', attrs.stroke);
    if (attrs.strokeWidth !== undefined) canvas.changeSelectedAttribute('stroke-width', attrs.strokeWidth.toString());
    if (attrs.strokeOpacity !== undefined) canvas.changeSelectedAttribute('stroke-opacity', attrs.strokeOpacity.toString());
    if (attrs.fontFamily !== undefined) canvas.changeSelectedAttribute('font-family', attrs.fontFamily);
    if (attrs.fontSize !== undefined) canvas.changeSelectedAttribute('font-size', attrs.fontSize.toString());
    if (attrs.fontWeight !== undefined) canvas.changeSelectedAttribute('font-weight', attrs.fontWeight);
    if (attrs.fontStyle !== undefined) canvas.changeSelectedAttribute('font-style', attrs.fontStyle);
    if (attrs.opacity !== undefined) canvas.changeSelectedAttribute('opacity', attrs.opacity.toString());
    if (attrs.transform !== undefined) canvas.changeSelectedAttribute('transform', attrs.transform);

    // Position/Size attributes
    if (attrs.id !== undefined) {
      const elems = getSelectedElements();
      elems.forEach((el: SVGElement) => {
        if (el.id !== attrs.id) el.id = attrs.id;
      });
    }
    if (attrs.x !== undefined) canvas.changeSelectedAttribute('x', attrs.x.toString());
    if (attrs.y !== undefined) canvas.changeSelectedAttribute('y', attrs.y.toString());
    if (attrs.width !== undefined) canvas.changeSelectedAttribute('width', attrs.width.toString());
    if (attrs.height !== undefined) canvas.changeSelectedAttribute('height', attrs.height.toString());
    if (attrs.cx !== undefined) canvas.changeSelectedAttribute('cx', attrs.cx.toString());
    if (attrs.cy !== undefined) canvas.changeSelectedAttribute('cy', attrs.cy.toString());
    if (attrs.r !== undefined) canvas.changeSelectedAttribute('r', attrs.r.toString());
    if (attrs.rx !== undefined) canvas.changeSelectedAttribute('rx', attrs.rx.toString());
    if (attrs.ry !== undefined) canvas.changeSelectedAttribute('ry', attrs.ry.toString());
    if (attrs.x1 !== undefined) canvas.changeSelectedAttribute('x1', attrs.x1.toString());
    if (attrs.y1 !== undefined) canvas.changeSelectedAttribute('y1', attrs.y1.toString());
    if (attrs.x2 !== undefined) canvas.changeSelectedAttribute('x2', attrs.x2.toString());
    if (attrs.y2 !== undefined) canvas.changeSelectedAttribute('y2', attrs.y2.toString());
    if (attrs.d !== undefined) canvas.changeSelectedAttribute('d', attrs.d);
    if (attrs.points !== undefined) canvas.changeSelectedAttribute('points', attrs.points);
  } catch (error) {
    logger.error('Failed to apply attributes to selection', error);
  }
}

// Resize svgedit's canvasBackground indicator (white box w/ black border) to match the
// canvas. setResolution only resizes svgContent, leaving canvasBackground at its init size.
// svgedit's updateCanvas also offsets the bg via x/y for centering, so we reset those to 0
// and size the inner rect explicitly (it defaults to 100% but nested-svg viewports can
// retain a stale larger size when shrinking).
function resizeCanvasBackground(w: number, h: number): void {
  const bg = document.getElementById('canvasBackground');
  if (!bg) return;
  bg.setAttribute('width', String(w));
  bg.setAttribute('height', String(h));
  bg.setAttribute('x', '0');
  bg.setAttribute('y', '0');
  const rect = bg.querySelector('rect');
  if (rect) {
    rect.setAttribute('width', String(w));
    rect.setAttribute('height', String(h));
  }
}

// Apply zoom: updates viewBox via setCurrentZoom and resizes svgroot for scrollbars
function applyZoom(zoomLevel: number): void {
  canvas.setCurrentZoom(zoomLevel);
  const svgRoot = canvas.getSvgRoot();
  const svgContent = canvas.getSvgContent();
  const res = canvas.getResolution();
  svgRoot.setAttribute('width', String(res.w));
  svgRoot.setAttribute('height', String(res.h));
  svgRoot.setAttribute('viewBox', '0 0 ' + res.w + ' ' + res.h);
  svgContent.setAttribute('viewBox', '0 0 ' + res.w + ' ' + res.h);
}

// Parse dimension string (e.g. "400px", "400", "50%") to a pixel number
function parseDimension(dim: string): number {
  var match = dim.match(/^(\d+(?:\.\d+)?)\s*(px|%)?$/);
  if (!match) return 400;
  return parseFloat(match[1]);
}

// Resize canvas to match SVG content or configuration defaults
function applyCanvasDimensions(): void {
  var svgContent = canvas.getSvgContent();
  var wAttr = svgContent.getAttribute('width');
  var hAttr = svgContent.getAttribute('height');
  var w: number;
  var h: number;
  // If SVG has no explicit size, use configuration
  if (!wAttr || !hAttr) {
    w = parseDimension(configuration.canvasWidth);
    h = parseDimension(configuration.canvasHeight);
  } else {
    w = parseFloat(wAttr) || parseDimension(configuration.canvasWidth);
    h = parseFloat(hAttr) || parseDimension(configuration.canvasHeight);
  }
  canvas.setResolution(w, h);
  // Resize and reposition svgroot so it matches the SVG content exactly
  var svgRoot = canvas.getSvgRoot();
  var svgContent = canvas.getSvgContent();
  var res = canvas.getResolution();
  svgRoot.setAttribute('width', String(res.w));
  svgRoot.setAttribute('height', String(res.h));
  svgRoot.setAttribute('x', '0');
  svgRoot.setAttribute('y', '0');
  // Read existing viewBox or default to canvas dimensions
  var vbAttr = svgContent.getAttribute('viewBox');
  var vbX = 0, vbY = 0, vbW = res.w, vbH = res.h;
  if (vbAttr) {
    var parts = vbAttr.split(/[\s,]+/);
    if (parts.length === 4) {
      vbX = parseFloat(parts[0]) || 0;
      vbY = parseFloat(parts[1]) || 0;
      vbW = parseFloat(parts[2]) || res.w;
      vbH = parseFloat(parts[3]) || res.h;
    }
  }
  svgRoot.setAttribute('viewBox', vbX + ' ' + vbY + ' ' + vbW + ' ' + vbH);
  svgContent.setAttribute('viewBox', vbX + ' ' + vbY + ' ' + vbW + ' ' + vbH);
  resizeCanvasBackground(res.w, res.h);
  // Update style panel
  stylePanel.updateCanvasDimensions(res.w, res.h);
  stylePanel.updateViewBox(vbX, vbY, vbW, vbH);
}

// Handle operations from toolbar
function handleOperation(op: Operation): void {
  try {
    switch (op) {
      case 'delete':
        canvas.deleteSelectedElements();
        break;
      case 'duplicate':
        canvas.copySelectedElements();
        canvas.pasteElements();
        break;
      case 'group':
        canvas.groupSelectedElements();
        break;
      case 'ungroup':
        canvas.ungroupSelectedElement();
        break;
      case 'bringForward':
        canvas.moveUpDownSelected('Up');
        break;
      case 'sendBackward':
        canvas.moveUpDownSelected('Down');
        break;
    case 'alignLeft': {
      const elems = getSelectedElements();
      if (elems.length > 1) {
        const minX = Math.min(...elems.map((el: SVGGraphicsElement) => el.getBBox().x));
        elems.forEach((el: SVGGraphicsElement) => {
          const bbox = el.getBBox();
          canvas.moveSelectedElements(minX - bbox.x, 0, false);
        });
      }
      break;
    }
    case 'alignRight': {
      const elems = getSelectedElements();
      if (elems.length > 1) {
        const maxRight = Math.max(...elems.map((el: SVGGraphicsElement) => el.getBBox().x + el.getBBox().width));
        elems.forEach((el: SVGGraphicsElement) => {
          const bbox = el.getBBox();
          canvas.moveSelectedElements(maxRight - (bbox.x + bbox.width), 0, false);
        });
      }
      break;
    }
    case 'alignTop': {
      const elems = getSelectedElements();
      if (elems.length > 1) {
        const minY = Math.min(...elems.map((el: SVGGraphicsElement) => el.getBBox().y));
        elems.forEach((el: SVGGraphicsElement) => {
          const bbox = el.getBBox();
          canvas.moveSelectedElements(0, minY - bbox.y, false);
        });
      }
      break;
    }
    case 'alignBottom': {
      const elems = getSelectedElements();
      if (elems.length > 1) {
        const maxBottom = Math.max(...elems.map((el: SVGGraphicsElement) => el.getBBox().y + el.getBBox().height));
        elems.forEach((el: SVGGraphicsElement) => {
          const bbox = el.getBBox();
          canvas.moveSelectedElements(0, maxBottom - (bbox.y + bbox.height), false);
        });
      }
      break;
    }
    case 'centerVertical': {
      const elems = getSelectedElements();
      if (elems.length > 0) {
        const res = canvas.getResolution();
        const centerY = res.h / 2;
        elems.forEach((el: SVGGraphicsElement) => {
          const bbox = el.getBBox();
          canvas.moveSelectedElements(0, centerY - (bbox.y + bbox.height / 2), false);
        });
      }
      break;
    }
    case 'centerHorizontal': {
      const elems = getSelectedElements();
      if (elems.length > 0) {
        const res = canvas.getResolution();
        const centerX = res.w / 2;
        elems.forEach((el: SVGGraphicsElement) => {
          const bbox = el.getBBox();
          canvas.moveSelectedElements(centerX - (bbox.x + bbox.width / 2), 0, false);
        });
      }
      break;
    }
    case 'rotateClockwise': {
      const elems = getSelectedElements();
      elems.forEach((el: SVGGraphicsElement) => {
        const bbox = el.getBBox();
        const cx = bbox.x + bbox.width / 2;
        const cy = bbox.y + bbox.height / 2;
        const currentTransform = el.getAttribute('transform') || '';
        const cleaned = currentTransform.replace(/\s*rotate\([^)]*\)\s*/g, ' ').trim();
        const newTransform = (cleaned + ' rotate(90, ' + cx + ', ' + cy + ')').trim();
        canvas.changeSelectedAttribute('transform', newTransform, [el]);
      });
      break;
    }
    case 'rotateCounterclockwise': {
      const elems = getSelectedElements();
      elems.forEach((el: SVGGraphicsElement) => {
        const bbox = el.getBBox();
        const cx = bbox.x + bbox.width / 2;
        const cy = bbox.y + bbox.height / 2;
        const currentTransform = el.getAttribute('transform') || '';
        const cleaned = currentTransform.replace(/\s*rotate\([^)]*\)\s*/g, ' ').trim();
        const newTransform = (cleaned + ' rotate(-90, ' + cx + ', ' + cy + ')').trim();
        canvas.changeSelectedAttribute('transform', newTransform, [el]);
      });
      break;
    }
    case 'rotateClockwiseByTheAngleStep': {
      const elems = getSelectedElements();
      const step = 15;
      elems.forEach((el: SVGGraphicsElement) => {
        const bbox = el.getBBox();
        const cx = bbox.x + bbox.width / 2;
        const cy = bbox.y + bbox.height / 2;
        const currentTransform = el.getAttribute('transform') || '';
        const cleaned = currentTransform.replace(/\s*rotate\([^)]*\)\s*/g, ' ').trim();
        const newTransform = (cleaned + ' rotate(' + step + ', ' + cx + ', ' + cy + ')').trim();
        canvas.changeSelectedAttribute('transform', newTransform, [el]);
      });
      break;
    }
    case 'rotateCounterclockwiseByTheAngleStep': {
      const elems = getSelectedElements();
      const step = 15;
      elems.forEach((el: SVGGraphicsElement) => {
        const bbox = el.getBBox();
        const cx = bbox.x + bbox.width / 2;
        const cy = bbox.y + bbox.height / 2;
        const currentTransform = el.getAttribute('transform') || '';
        const cleaned = currentTransform.replace(/\s*rotate\([^)]*\)\s*/g, ' ').trim();
        const newTransform = (cleaned + ' rotate(-' + step + ', ' + cx + ', ' + cy + ')').trim();
        canvas.changeSelectedAttribute('transform', newTransform, [el]);
      });
      break;
    }
    case 'zoomIn': {
      const currentZoom = canvas.getZoom();
      applyZoom(currentZoom * 1.25);
      break;
    }
    case 'zoomOut': {
      const currentZoom = canvas.getZoom();
      applyZoom(currentZoom / 1.25);
      break;
    }
    case 'fitCanvasToContent': {
      canvas.setResolution('fit', 0);
      // Sync svgroot size to match new content dimensions
      var svgRoot = canvas.getSvgRoot();
      var svgContent = canvas.getSvgContent();
      var res = canvas.getResolution();
      svgRoot.setAttribute('width', String(res.w));
      svgRoot.setAttribute('height', String(res.h));
      svgRoot.setAttribute('viewBox', '0 0 ' + res.w + ' ' + res.h);
      svgRoot.setAttribute('x', '0');
      svgRoot.setAttribute('y', '0');
      svgContent.setAttribute('viewBox', '0 0 ' + res.w + ' ' + res.h);
      resizeCanvasBackground(res.w, res.h);
      applyZoom(canvas.getZoom());
      stylePanel.updateCanvasDimensions(res.w, res.h);
      stylePanel.updateViewBox(0, 0, res.w, res.h);
      sendSvgUpdate();
      break;
    }
    case 'objectToPath':
      canvas.setMode('pathedit');
      break;
    case 'polygonToRect': {
      const elems = getSelectedElements();
      let svgString = canvas.getSvgString();
      let modified = false;

      elems.forEach((el: SVGGraphicsElement) => {
        if (el.tagName !== 'polygon' && el.tagName !== 'polyline') return;

        const pointsStr = el.getAttribute('points');
        if (!pointsStr) return;

        const result = convertPolygonToRect(svgString, pointsStr);
        if (result.replaced) {
          svgString = result.svg;
          modified = true;
        }
      });

      if (modified) {
        const scrollPos = { x: body.scrollLeft, y: body.scrollTop };
        const zoomLevel = canvas.getZoom();
        canvas.setSvgString(svgString);
        body.scrollLeft = scrollPos.x;
        body.scrollTop = scrollPos.y;
        applyZoom(zoomLevel);
        sendSvgUpdate();
      }
      break;
    }
    case 'copyAsPng': {
      const svgString = canvas.getSvgString();
      const res = canvas.getResolution();
      const w = res.w || 400;
      const h = res.h || 400;
      const scale = 2; // 2x for retina quality
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = function () {
        const c = document.createElement('canvas');
        c.width = w * scale;
        c.height = h * scale;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0, w, h);
          c.toBlob(function (pngBlob) {
            if (pngBlob) {
              const ClipboardItemCtor = (window as any).ClipboardItem;
              const clip = (navigator as any).clipboard;
              if (ClipboardItemCtor && clip && clip.write) {
                clip.write([
                  new ClipboardItemCtor({ 'image/png': pngBlob })
                ]).then(undefined, function () {
                  logger.error('Failed to copy PNG to clipboard');
                });
              }
            }
          }, 'image/png');
        }
        URL.revokeObjectURL(url);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
      };
      img.src = url;
      break;
    }
    case 'reload': {
      // Discard local state and request fresh SVG from the text editor
      currentSvgString = '';
      vscode.postMessage({ command: 'svg-request' });
      break;
    }
    case 'undo': {
      vscode.postMessage({ command: 'text-undo' });
      break;
    }
    case 'redo': {
      vscode.postMessage({ command: 'text-redo' });
      break;
    }
    case 'toggleBackground': {
      const bgColors = ['#FFFFFF', '#808080', '#000000'];
      const borderColors: Record<string, string> = { '#FFFFFF': '#000000', '#808080': '#444444', '#000000': '#666666' };
      const bg = document.getElementById('canvasBackground');
      const rect = bg ? bg.querySelector('rect') : null;
      const current = (rect?.getAttribute('fill') || '#FFFFFF').toUpperCase();
      const idx = bgColors.indexOf(current);
      const next = bgColors[(idx + 1) % bgColors.length];
      if (rect) {
        rect.setAttribute('fill', next);
        rect.setAttribute('stroke', borderColors[next] || '#000000');
      }
      body.style.backgroundColor = next;
      break;
    }
    }
  } catch (error) {
    logger.error(`Failed to execute operation: ${op}`, error);
    vscode.postMessage({
      command: 'error',
      data: `Failed to execute operation: ${op}`
    });
  }
}

// Function to send SVG update to VS Code
function sendSvgUpdate() {
  try {
    if (isInternalChange) return;
    const svgString = canvas.getSvgString();
    const sanitized = sanitizeSvgForEditor(svgString);

    // Only send if content actually changed
    if (sanitized === currentSvgString) return;

    currentSvgString = sanitized;
    logger.info('Sending SVG update to VS Code', { length: sanitized.length });
    vscode.postMessage({
      command: 'modified',
      data: sanitized
    });

    // Update style panel from selection using idle callback
    requestIdleCallback(() => {
      stylePanel.updateFromSelection();
    });
  } catch (error) {
    logger.error('Failed to send SVG update', error);
  }
}

// Debounced version for frequent events
const notifyChange = debounce(sendSvgUpdate, 150);

// Listen for canvas changes
canvas.bind('changed', () => {
  logger.debug('Canvas changed event fired');
  notifyChange();
});

// Listen for mouseUp to catch drawing operations
canvas.bind('mouseup', () => {
  logger.debug('mouseup event fired');
  // Use immediate version for mouseup to ensure we catch the change
  sendSvgUpdate();
});

// Listen for ext_mouseUp (svgcanvas specific event)
canvas.bind('ext_mouseUp', () => {
  logger.debug('ext_mouseUp event fired');
  sendSvgUpdate();
});

// Listen for transition event (fires after element transformations)
canvas.bind('transition', () => {
  logger.debug('transition event fired');
  notifyChange();
});

// Track selection changes
canvas.bind('selected', (window: any, elems: SVGElement[]) => {
  try {
    // Update style panel from selection
    stylePanel.updateFromSelection();

    // Notify VS Code of selection change
    if (elems && elems.length > 0) {
      const el = elems[0];
      const attrs = getElementAttributes(el);
      const data: any = {
        elementId: el.id || null,
        tagName: el.tagName,
        attributes: attrs
      };

      // Always compute tagIndex as fallback (svgedit may auto-assign IDs
      // like svg_1 that don't exist in the source text)
      const svgContent = canvas.getSvgContent();
      const all = svgContent.querySelectorAll(el.tagName);
      for (let i = 0; i < all.length; i++) {
        if (all[i] === el) {
          data.tagIndex = i;
          break;
        }
      }

      vscode.postMessage({
        command: 'selectionChanged',
        data: data
      });
    } else {
      vscode.postMessage({
        command: 'selectionChanged',
        data: null
      });
    }
  } catch (error) {
    logger.error('Failed to handle selection change', error);
  }
});

// Track focus of editable elements inside the webview so the extension can
// suppress its keybindings (graphing.delete etc.) while the user is typing.
function isEditableTarget(t: EventTarget | null): boolean {
  if (!t || !(t as HTMLElement).tagName) return false;
  const el = t as HTMLElement;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

let inputFocusReported = false;
function reportInputFocus(focused: boolean): void {
  if (focused === inputFocusReported) return;
  inputFocusReported = focused;
  vscode.postMessage({ command: 'input-focused', focused });
}

document.addEventListener('focusin', (e) => {
  if (isEditableTarget(e.target)) reportInputFocus(true);
});
document.addEventListener('focusout', () => {
  // Wait for the next focus target before deciding — if it's another editable
  // field, this is a hand-off, not a real blur.
  setTimeout(() => {
    if (!isEditableTarget(document.activeElement)) reportInputFocus(false);
  }, 0);
});

// Keyboard shortcut handler (capture phase so we run before VS Code)
window.addEventListener('keydown', (e: KeyboardEvent) => {
  // Ignore when typing in inputs (e.g. attributes panel)
  const target = e.target as HTMLElement;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
    return;
  }

  // Cmd/Ctrl+A: select all shapes in current layer (excluding canvasBackground)
  if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
    e.preventDefault();
    canvas.selectAllInCurrentLayer();
    return;
  }

  // Cmd/Ctrl+Z: undo, Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y: redo
  if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y')) {
    e.preventDefault();
    e.stopPropagation();
    const isRedo = (e.shiftKey && (e.key === 'z' || e.key === 'Z')) || e.key === 'y' || e.key === 'Y';
    vscode.postMessage({ command: isRedo ? 'text-redo' : 'text-undo' });
    return;
  }

  // Arrow key nudging — always preventDefault so VS Code text editor
  // doesn't steal focus when the SVG canvas is focused
  const dirMap: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1]
  };
  const dir = dirMap[e.key];
  if (!dir) return;

  e.preventDefault();
  const selected = getSelectedElements();
  if (selected.length === 0) return;

  const step = e.shiftKey ? 10 : 1;
  const zoom = canvas.getZoom();
  const dx = dir[0] * step;
  const dy = dir[1] * step;

  // Decide up front whether the delta path applies to every selected element.
  const allPhase1 = selected.every(el =>
    isPhase1Shape(el.tagName) && !el.hasAttribute('transform')
  );

  if (allPhase1) {
    // Capture signatures BEFORE moving so they still match the on-disk source.
    const moves = selected.map(el => {
      const attrs = getElementAttributes(el as SVGElement);
      return {
        tag: el.tagName,
        elementId: el.id && !/^svg_\d+$/.test(el.id) ? el.id : null,
        signature: attrs
      };
    });

    // Update the canvas visually. Suppress the resulting `changed`/`transition`
    // events from re-serializing through getSvgString().
    isInternalChange = true;
    try {
      // moveSelectedElements divides scalar deltas by zoom, so multiply.
      canvas.moveSelectedElements(dx * zoom, dy * zoom, true);
    } finally {
      // Keep suppressed through the next microtask so the debounced notifyChange
      // (fires on 'changed') sees the guard.
      setTimeout(() => { isInternalChange = false; }, 200);
    }

    // Track the new canvas state so subsequent diff comparisons in sendSvgUpdate
    // don't spuriously re-send.
    try {
      currentSvgString = sanitizeSvgForEditor(canvas.getSvgString());
    } catch (err) {
      logger.warn('move-delta: failed to update currentSvgString cache', err);
    }

    vscode.postMessage({ command: 'move-delta', dx, dy, moves });
    return;
  }

  // Fallback: at least one element is Phase 2 (path, group, transformed) —
  // use the legacy full-serialize round-trip so behavior is unchanged for it.
  canvas.moveSelectedElements(dx * zoom, dy * zoom, true);
  sendSvgUpdate();
}, true);

// Get element attributes for properties panel
function getElementAttributes(el: SVGElement): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i];
    attrs[attr.name] = attr.value;
  }
  return attrs;
}

// VS Code -> SVG Edit message handler
window.addEventListener('message', (event) => {
  const message = event.data;

  try {
    switch (message.command) {
      case 'modified': {
        // SVG content from text editor
        isInternalChange = true;
        try {
          // Validate upfront so we can report a specific parse error
          const diag = diagnoseSvgError(message.data);
          if (diag) {
            logger.error('SVG parse error from text editor', diag);
            vscode.postMessage({ command: 'error', data: t('errors.svgParseError', { detail: diag }) });
            break;
          }

          const prepared = prepareSvgForCanvas(message.data);
          if (prepared !== message.data) {
            var hasVar = prepared.indexOf('var(--') !== -1;
            logger.info('CSS variables resolved', { remaining: hasVar ? 'some unresolved' : 'all resolved', delta: prepared.length - message.data.length });
          }

          // Try incremental update to preserve undo history
          const diffResult = computeSvgDiff(currentSvgString, prepared);
          const applied = diffResult.status === 'diff' && applyOperations(canvas, diffResult.operations);

          if (!applied) {
            if (diffResult.status === 'noChanges') {
              // Content is identical, nothing to do
              return;
            }
            // Fallback: full replacement (loses undo history)
            const scrollPos = { x: body.scrollLeft, y: body.scrollTop };
            const zoomLevel = canvas.getZoom();

            const success = canvas.setSvgString(prepared);
            if (!success) {
              const reason = diagnoseSvgError(prepared) || t('errors.svgcanvasRejected');
              logger.error('setSvgString failed', reason);
              vscode.postMessage({
                command: 'error',
                data: t('errors.svgLoadFailed', { reason })
              });
            }

            body.scrollLeft = scrollPos.x;
            body.scrollTop = scrollPos.y;
            applyCanvasDimensions();
            applyZoom(zoomLevel);
          } else {
            logger.debug('Applied incremental SVG update', { operations: diffResult.operations.length });
            applyCanvasDimensions();
          }

          currentSvgString = sanitizeSvgForEditor(canvas.getSvgString());
        } catch (e) {
          const detail = e instanceof Error ? e.message : String(e);
          logger.error('Unexpected error handling modified SVG', e);
          vscode.postMessage({ command: 'error', data: t('errors.svgRenderError', { detail }) });
        } finally {
          isInternalChange = false;
        }
        break;
      }

    case 'configuration': {
      if (message.data.indentStyle !== undefined) {
        configuration.indentStyle = message.data.indentStyle;
      }
      if (message.data.indentSize !== undefined) {
        configuration.indentSize = message.data.indentSize;
      }
      if (message.data.canvasWidth !== undefined) {
        configuration.canvasWidth = message.data.canvasWidth;
      }
      if (message.data.canvasHeight !== undefined) {
        configuration.canvasHeight = message.data.canvasHeight;
      }
      // Apply canvas dimensions if SVG has no explicit size
      applyCanvasDimensions();
      break;
    }

    case 'selectElement': {
      // Select element on canvas from text editor
      if (!message.data) break;
      const svgContent = canvas.getSvgContent();

      let target: Element | null = null;
      if (message.data.elementId) {
        target = svgContent.querySelector(`#${message.data.elementId}`);
      } else if (message.data.tagName && message.data.tagIndex !== undefined) {
        // Find nth element of given tag type
        const all = svgContent.querySelectorAll(message.data.tagName);
        const idx = message.data.tagIndex;
        if (idx < all.length) {
          target = all[idx];
        }
      }

      if (target) {
        canvas.clearSelection();
        canvas.selectOnly([target as SVGElement], true);
        // Directly update style panel from the target element (bypasses getSelectedElements)
        stylePanel.updateFromElement(target as SVGElement);
      }
      break;
    }

    // VS Code command handlers (from registerPostOnly in extension.ts)
    case 'delete':
    case 'duplicate':
    case 'group':
    case 'ungroup':
    case 'bringForward':
    case 'sendBackward':
    case 'alignLeft':
    case 'alignRight':
    case 'alignTop':
    case 'alignBottom':
    case 'centerVertical':
    case 'centerHorizontal':
    case 'rotateClockwise':
    case 'rotateCounterclockwise':
    case 'rotateClockwiseByTheAngleStep':
    case 'rotateCounterclockwiseByTheAngleStep':
    case 'zoomIn':
    case 'zoomOut':
    case 'fitCanvasToContent':
    case 'objectToPath':
      handleOperation(message.command);
      break;

    case 'font':
      // Font configuration - focus font family input
      break;

    case 'input-response':
      // Text input from VS Code
      break;

    case 'fontList-response':
      // Font list from VS Code
      break;

    case 'information-response':
      // Information dialog response
      break;

    case 'callback-response':
      // Callback response
      break;

    default:
      // Handle mode changes from toolbar
      if (['select', 'rect', 'ellipse', 'circle', 'line', 'polyline', 'polygon', 'path', 'text', 'image'].includes(message.command)) {
        canvas.setMode(message.command);
        toolbar.setActiveMode(message.command as DrawMode);
      }
      break;
  }
  } catch (error) {
    logger.error('Failed to handle message from VS Code', error, message.command);
  }
});

// Request initial SVG content
vscode.postMessage({ command: 'svg-request' });
vscode.postMessage({ command: 'fontList-request' });
