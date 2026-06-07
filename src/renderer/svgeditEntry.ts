/**
 * SVG Edit webview entry point.
 * Replaces the custom incremental-dom renderer with @svgedit/svgcanvas.
 */

import SvgCanvas from '@svgedit/svgcanvas';
import { SvgCanvasExtended, createSvgCanvasExtended } from './svgcanvas-types';
import { sanitizeSvgForEditor, prepareSvgForCanvas } from './svgSanitizer';
import { computeSvgDiff, applyOperations } from './svgDiffToOperations';
import { SvgeditToolbar, DrawMode, Operation } from './svgeditToolbar';
import { SvgeditStylePanel, StyleState } from './svgeditStylePanel';
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

// Apply style to selected elements
function applyStyleToSelection(style: StyleState): void {
  try {
    const elems = getSelectedElements();
    elems.forEach((el: SVGElement) => {
      if (style.fill) el.setAttribute('fill', style.fill);
      if (style.fillOpacity !== undefined) el.setAttribute('fill-opacity', style.fillOpacity.toString());
      if (style.stroke) el.setAttribute('stroke', style.stroke);
      if (style.strokeWidth !== undefined) el.setAttribute('stroke-width', style.strokeWidth.toString());
      if (style.strokeOpacity !== undefined) el.setAttribute('stroke-opacity', style.strokeOpacity.toString());
      if (style.fontFamily) el.setAttribute('font-family', style.fontFamily);
      if (style.fontSize !== undefined) el.setAttribute('font-size', style.fontSize.toString());
      if (style.fontWeight) el.setAttribute('font-weight', style.fontWeight);
      if (style.fontStyle) el.setAttribute('font-style', style.fontStyle);
      if (style.opacity !== undefined) el.setAttribute('opacity', style.opacity.toString());
    });
  } catch (error) {
    logger.error('Failed to apply style to selection', error);
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
