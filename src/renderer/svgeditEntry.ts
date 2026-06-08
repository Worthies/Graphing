/**
 * SVG Edit webview entry point.
 * Replaces the custom incremental-dom renderer with @svgedit/svgcanvas.
 */

import SvgCanvas from '@svgedit/svgcanvas';
import { SvgCanvasExtended, createSvgCanvasExtended } from './svgcanvas-types';
import { sanitizeSvgForEditor, prepareSvgForCanvas } from './svgSanitizer';
import { computeSvgDiff, applyOperations } from './svgDiffToOperations';
import { SvgeditToolbar, DrawMode, Operation } from './svgeditToolbar';
import { SvgeditStylePanel, StyleState, ElementAttributes } from './svgeditStylePanel';
import { registerExtensions } from './svgeditExtensions';
import { logger, withSyncErrorHandling } from './logger';
import { debounce, requestIdleCallback } from './performance';

declare function acquireVsCodeApi(): { postMessage(args: any): void };

const vscode = acquireVsCodeApi();

// State
let currentSvgString = '';
let isInternalChange = false;
let changeTimeout: number | null = null;

// Configuration from VS Code settings
const configuration = {
  indentStyle: 'space' as 'space' | 'tab',
  indentSize: 4
};

// Get container element
const container = document.getElementById('graphing-content')!;

// Create layout structure
const header = document.createElement('header');
header.id = 'svgedit-toolbar';
const body = document.createElement('div');
body.id = 'svgedit-canvas-body';
body.style.cssText = 'flex: 1; overflow: hidden; position: relative;';
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

// Override getMouseTarget to select the actual shape element (not the group)
// SVG shape elements that can be directly selected
const SHAPE_ELEMENTS = ['rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text', 'image', 'use', 'g'];

(canvas as any).getMouseTarget = function(evt: MouseEvent): SVGElement | null {
  if (!evt) return null;

  let mouseTarget = evt.target as SVGElement;

  // Handle use elements
  if ((mouseTarget as any).correspondingUseElement) {
    mouseTarget = (mouseTarget as any).correspondingUseElement;
  }

  // Get the canvas boundaries
  const svgRoot = canvas.getSvgRoot();
  const container = (canvas as any).getDOMContainer();
  const content = canvas.getSvgContent();

  // If clicking on root/container, return root
  if ([svgRoot, container, content].includes(mouseTarget)) {
    return svgRoot;
  }

  // If clicking on a selector grip, return selector parent group
  if (mouseTarget.closest && mouseTarget.closest('#selectorParentGroup')) {
    return (canvas as any).selectorManager.selectorParentGroup;
  }

  // Walk up to find the nearest shape element (but don't skip to the group)
  let target = mouseTarget;
  while (target && target !== svgRoot && target !== content) {
    const tagName = target.tagName?.toLowerCase();
    // If we found a shape element, return it
    if (tagName && SHAPE_ELEMENTS.includes(tagName)) {
      return target;
    }
    // Walk up
    target = target.parentNode as SVGElement;
  }

  // If no shape found, return the original target
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
  (style: StyleState) => {
    applyStyleToSelection(style);
  }
);

// Apply style/attributes to selected elements
function applyStyleToSelection(attrs: any): void {
  try {
    const elems = getSelectedElements();
    elems.forEach((el: SVGElement) => {
      // Style attributes
      if (attrs.fill !== undefined) el.setAttribute('fill', attrs.fill);
      if (attrs.fillOpacity !== undefined) el.setAttribute('fill-opacity', attrs.fillOpacity.toString());
      if (attrs.stroke !== undefined) el.setAttribute('stroke', attrs.stroke);
      if (attrs.strokeWidth !== undefined) el.setAttribute('stroke-width', attrs.strokeWidth.toString());
      if (attrs.strokeOpacity !== undefined) el.setAttribute('stroke-opacity', attrs.strokeOpacity.toString());
      if (attrs.fontFamily !== undefined) el.setAttribute('font-family', attrs.fontFamily);
      if (attrs.fontSize !== undefined) el.setAttribute('font-size', attrs.fontSize.toString());
      if (attrs.fontWeight !== undefined) el.setAttribute('font-weight', attrs.fontWeight);
      if (attrs.fontStyle !== undefined) el.setAttribute('font-style', attrs.fontStyle);
      if (attrs.opacity !== undefined) el.setAttribute('opacity', attrs.opacity.toString());
      if (attrs.transform !== undefined) el.setAttribute('transform', attrs.transform);

      // Position/Size attributes
      if (attrs.id !== undefined && el.id !== attrs.id) {
        el.id = attrs.id;
      }
      if (attrs.x !== undefined) el.setAttribute('x', attrs.x.toString());
      if (attrs.y !== undefined) el.setAttribute('y', attrs.y.toString());
      if (attrs.width !== undefined) el.setAttribute('width', attrs.width.toString());
      if (attrs.height !== undefined) el.setAttribute('height', attrs.height.toString());
      if (attrs.cx !== undefined) el.setAttribute('cx', attrs.cx.toString());
      if (attrs.cy !== undefined) el.setAttribute('cy', attrs.cy.toString());
      if (attrs.r !== undefined) el.setAttribute('r', attrs.r.toString());
      if (attrs.rx !== undefined) el.setAttribute('rx', attrs.rx.toString());
      if (attrs.ry !== undefined) el.setAttribute('ry', attrs.ry.toString());
      if (attrs.x1 !== undefined) el.setAttribute('x1', attrs.x1.toString());
      if (attrs.y1 !== undefined) el.setAttribute('y1', attrs.y1.toString());
      if (attrs.x2 !== undefined) el.setAttribute('x2', attrs.x2.toString());
      if (attrs.y2 !== undefined) el.setAttribute('y2', attrs.y2.toString());
      if (attrs.d !== undefined) el.setAttribute('d', attrs.d);
      if (attrs.points !== undefined) el.setAttribute('points', attrs.points);
    });
  } catch (error) {
    logger.error('Failed to apply attributes to selection', error);
  }
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
        el.setAttribute('transform', (cleaned + ' rotate(90, ' + cx + ', ' + cy + ')').trim());
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
        el.setAttribute('transform', (cleaned + ' rotate(-90, ' + cx + ', ' + cy + ')').trim());
      });
      break;
    }
    case 'rotateClockwiseByTheAngleStep': {
      const elems = getSelectedElements();
      const step = configuration.indentSize || 15;
      elems.forEach((el: SVGGraphicsElement) => {
        const bbox = el.getBBox();
        const cx = bbox.x + bbox.width / 2;
        const cy = bbox.y + bbox.height / 2;
        const currentTransform = el.getAttribute('transform') || '';
        const cleaned = currentTransform.replace(/\s*rotate\([^)]*\)\s*/g, ' ').trim();
        el.setAttribute('transform', (cleaned + ' rotate(' + step + ', ' + cx + ', ' + cy + ')').trim());
      });
      break;
    }
    case 'rotateCounterclockwiseByTheAngleStep': {
      const elems = getSelectedElements();
      const step = configuration.indentSize || 15;
      elems.forEach((el: SVGGraphicsElement) => {
        const bbox = el.getBBox();
        const cx = bbox.x + bbox.width / 2;
        const cy = bbox.y + bbox.height / 2;
        const currentTransform = el.getAttribute('transform') || '';
        const cleaned = currentTransform.replace(/\s*rotate\([^)]*\)\s*/g, ' ').trim();
        el.setAttribute('transform', (cleaned + ' rotate(-' + step + ', ' + cx + ', ' + cy + ')').trim());
      });
      break;
    }
    case 'zoomIn': {
      const currentZoom = canvas.getZoom();
      canvas.setZoom(currentZoom * 1.25);
      break;
    }
    case 'zoomOut': {
      const currentZoom = canvas.getZoom();
      canvas.setZoom(currentZoom / 1.25);
      break;
    }
    case 'objectToPath':
      canvas.setMode('pathedit');
      break;
    }
  } catch (error) {
    logger.error(`Failed to execute operation: ${op}`, error);
    vscode.postMessage({
      command: 'error',
      data: `Failed to execute operation: ${op}`
    });
  }
}

// Debounced change notification: SVG Edit -> VS Code
const notifyChange = debounce(() => {
  try {
    const svgString = canvas.getSvgString();
    const sanitized = sanitizeSvgForEditor(svgString);
    if (sanitized !== currentSvgString) {
      currentSvgString = sanitized;
      vscode.postMessage({
        command: 'modified',
        data: sanitized
      });
    }
    // Update style panel from selection using idle callback
    requestIdleCallback(() => {
      stylePanel.updateFromSelection();
    });
  } catch (error) {
    logger.error('Failed to process canvas change', error);
  }
}, 100);

canvas.bind('changed', () => {
  if (isInternalChange) return;
  notifyChange();
});

// Track selection changes
canvas.bind('selectedChanged', (window: any, elems: SVGElement[]) => {
  try {
    // Update style panel from selection
    stylePanel.updateFromSelection();

    // Notify VS Code of selection change
    if (elems && elems.length > 0) {
      const el = elems[0];
      vscode.postMessage({
        command: 'selectionChanged',
        data: {
          elementId: el.id || null,
          tagName: el.tagName,
          attributes: getElementAttributes(el)
        }
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
          const prepared = prepareSvgForCanvas(message.data);

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
              logger.error('Failed to set SVG string from text editor');
              vscode.postMessage({
                command: 'error',
                data: 'Failed to parse SVG content from text editor'
              });
            }

            body.scrollLeft = scrollPos.x;
            body.scrollTop = scrollPos.y;
            canvas.setZoom(zoomLevel);
          } else {
            logger.debug('Applied incremental SVG update', { operations: diffResult.operations.length });
          }

          currentSvgString = sanitizeSvgForEditor(canvas.getSvgString());
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
      break;
    }

    case 'selectElement': {
      // Select element on canvas from text editor
      if (message.data && message.data.elementId) {
        const svgContent = canvas.getSvgContent();
        const el = svgContent.querySelector(`#${message.data.elementId}`);
        if (el) {
          canvas.clearSelection();
          canvas.selectOnly([el as SVGElement], true);
        }
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
