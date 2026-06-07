/**
 * SVG Edit extensions registration.
 * Statically registers useful extensions for the VS Code webview environment.
 */

// Extension type definitions
interface SvgEditExtension {
  name: string;
  init: (canvas: any) => void;
}

/**
 * Built-in shape library extension
 */
const shapesExtension: SvgEditExtension = {
  name: 'shapes',
  init(canvas: any) {
    // Shape library provides predefined shapes
    // SVG Edit's built-in shapes are already available through the canvas
    console.log('Shapes extension initialized');
  }
};

/**
 * Canvas panning extension
 * Allows middle-click or space+drag to pan the canvas
 */
const panningExtension: SvgEditExtension = {
  name: 'panning',
  init(canvas: any) {
    let isPanning = false;
    let startX = 0;
    let startY = 0;
    let scrollStartX = 0;
    let scrollStartY = 0;

    const container = canvas.getSvgRoot().parentElement;
    if (!container) return;

    container.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        isPanning = true;
        startX = e.clientX;
        startY = e.clientY;
        scrollStartX = container.scrollLeft;
        scrollStartY = container.scrollTop;
        e.preventDefault();
      }
    });

    container.addEventListener('mousemove', (e: MouseEvent) => {
      if (isPanning) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        container.scrollLeft = scrollStartX - dx;
        container.scrollTop = scrollStartY - dy;
      }
    });

    container.addEventListener('mouseup', () => {
      isPanning = false;
    });

    container.addEventListener('mouseleave', () => {
      isPanning = false;
    });

    console.log('Panning extension initialized');
  }
};

/**
 * Grid overlay extension
 * Shows alignment grid on the canvas
 */
const gridExtension: SvgEditExtension = {
  name: 'grid',
  init(canvas: any) {
    let gridVisible = false;
    let gridElement: SVGElement | null = null;

    const svgRoot = canvas.getSvgRoot();
    if (!svgRoot) return;

    function createGrid(size: number = 10): SVGElement {
      const ns = 'http://www.w3.org/2000/svg';
      const grid = document.createElementNS(ns, 'g');
      grid.setAttribute('class', 'canvas_grid');
      grid.style.pointerEvents = 'none';

      const res = canvas.getResolution();
      const width = res.w;
      const height = res.h;

      // Vertical lines
      for (let x = 0; x <= width; x += size) {
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', x.toString());
        line.setAttribute('y1', '0');
        line.setAttribute('x2', x.toString());
        line.setAttribute('y2', height.toString());
        line.setAttribute('stroke', 'var(--vscode-editorWidget-border, #444444)');
        line.setAttribute('stroke-width', '0.5');
        line.setAttribute('stroke-dasharray', '2,2');
        grid.appendChild(line);
      }

      // Horizontal lines
      for (let y = 0; y <= height; y += size) {
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', '0');
        line.setAttribute('y1', y.toString());
        line.setAttribute('x2', width.toString());
        line.setAttribute('y2', y.toString());
        line.setAttribute('stroke', 'var(--vscode-editorWidget-border, #444444)');
        line.setAttribute('stroke-width', '0.5');
        line.setAttribute('stroke-dasharray', '2,2');
        grid.appendChild(line);
      }

      return grid;
    }

    // Add toggle method to canvas
    (canvas as any).toggleGrid = () => {
      if (gridVisible && gridElement) {
        gridElement.remove();
        gridElement = null;
        gridVisible = false;
      } else {
        gridElement = createGrid();
        svgRoot.insertBefore(gridElement, svgRoot.firstChild);
        gridVisible = true;
      }
    };

    console.log('Grid extension initialized');
  }
};

/**
 * Register all extensions with the canvas
 */
export function registerExtensions(canvas: any): void {
  const extensions = [
    shapesExtension,
    panningExtension,
    gridExtension
  ];

  extensions.forEach(ext => {
    try {
      ext.init(canvas);
    } catch (e) {
      console.error(`Failed to initialize extension ${ext.name}:`, e);
    }
  });
}
