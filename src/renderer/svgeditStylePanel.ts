/**
 * SVG Edit properties panel component.
 * Provides comprehensive attribute editing using VS Code theming.
 */

export interface StyleState {
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  opacity: number;
}

export interface ElementAttributes extends StyleState {
  // Identity
  id: string;
  tagName: string;

  // Position/Size (element-specific)
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  cx?: number;
  cy?: number;
  r?: number;
  rx?: number;
  ry?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;

  // Path/Polyline
  d?: string;
  points?: string;

  // Transform
  transform: string;
}

const DEFAULT_STYLE: StyleState = {
  fill: '#ffffff',
  fillOpacity: 1,
  stroke: '#000000',
  strokeWidth: 1,
  strokeOpacity: 1,
  fontFamily: 'serif',
  fontSize: 24,
  fontWeight: 'normal',
  fontStyle: 'normal',
  opacity: 1
};

const DEFAULT_ATTRIBUTES: ElementAttributes = {
  ...DEFAULT_STYLE,
  id: '',
  tagName: '',
  transform: ''
};

const CAMEL_TO_KEBAB: Record<string, string> = {
  fillOpacity: 'fill-opacity',
  strokeWidth: 'stroke-width',
  strokeOpacity: 'stroke-opacity',
  fontFamily: 'font-family',
  fontSize: 'font-size',
  fontWeight: 'font-weight',
  fontStyle: 'font-style'
};

export class SvgeditStylePanel {
  private container: HTMLElement;
  private canvas: any;
  private currentAttributes: ElementAttributes = { ...DEFAULT_ATTRIBUTES };
  private lastAppliedAttributes: ElementAttributes | null = null;
  private onStyleChange: (style: StyleState, changes: Array<{name: string, newValue: string}>) => void;
  private onCanvasResize: ((width: number, height: number) => void) | null = null;
  private inputs: Map<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> = new Map();
  private panel: HTMLElement | null = null;
  private canvasWidth: number = 400;
  private canvasHeight: number = 400;
  private viewBoxX: number = 0;
  private viewBoxY: number = 0;
  private viewBoxW: number = 400;
  private viewBoxH: number = 400;
  private onTextContentChange: ((element: SVGElement, newText: string) => void) | null = null;

  constructor(
    container: HTMLElement,
    canvas: any,
    onStyleChange: (style: StyleState, changes: Array<{name: string, newValue: string}>) => void,
    onTextContentChange?: (element: SVGElement, newText: string) => void
  ) {
    this.container = container;
    this.canvas = canvas;
    this.onStyleChange = onStyleChange;
    this.onTextContentChange = onTextContentChange || null;
    this.render();
  }

  private onViewBoxChange: ((viewBox: { x: number; y: number; w: number; h: number }) => void) | null = null;

  setCanvasResizeHandler(handler: (width: number, height: number) => void): void {
    this.onCanvasResize = handler;
  }

  setViewBoxChangeHandler(handler: (viewBox: { x: number; y: number; w: number; h: number }) => void): void {
    this.onViewBoxChange = handler;
  }

  updateCanvasDimensions(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.viewBoxW = width;
    this.viewBoxH = height;
    this.rebuildPanel();
  }

  updateViewBox(x: number, y: number, w: number, h: number): void {
    this.viewBoxX = x;
    this.viewBoxY = y;
    this.viewBoxW = w;
    this.viewBoxH = h;
    this.rebuildPanel();
  }

  updateFromSelection(): void {
    const elems = (this.canvas as any).getSelectedElements() || [];
    if (elems.length === 0) {
      this.currentAttributes = { ...DEFAULT_ATTRIBUTES };
    } else if (elems.length === 1) {
      const el = elems[0] as SVGElement;
      this.currentAttributes = this.getAttributesFromElement(el);
    }
    this.lastAppliedAttributes = { ...this.currentAttributes };
    this.updateUI();
  }

  updateFromElement(el: SVGElement): void {
    this.currentAttributes = this.getAttributesFromElement(el);
    this.lastAppliedAttributes = { ...this.currentAttributes };
    this.updateUI();
  }

  private getAttributesFromElement(el: SVGElement): ElementAttributes {
    const computed = window.getComputedStyle(el);
    const tagName = el.tagName.toLowerCase();

    // Base attributes
    const attrs: ElementAttributes = {
      ...DEFAULT_STYLE,
      id: el.id || '',
      tagName: tagName,
      fill: el.getAttribute('fill') || computed.fill || DEFAULT_STYLE.fill,
      fillOpacity: parseFloat(el.getAttribute('fill-opacity') || computed.fillOpacity || '1'),
      stroke: el.getAttribute('stroke') || computed.stroke || DEFAULT_STYLE.stroke,
      strokeWidth: parseFloat(el.getAttribute('stroke-width') || computed.strokeWidth || '1'),
      strokeOpacity: parseFloat(el.getAttribute('stroke-opacity') || computed.strokeOpacity || '1'),
      fontFamily: el.getAttribute('font-family') || computed.fontFamily || DEFAULT_STYLE.fontFamily,
      fontSize: parseFloat(el.getAttribute('font-size') || computed.fontSize || '24'),
      fontWeight: el.getAttribute('font-weight') || computed.fontWeight || DEFAULT_STYLE.fontWeight,
      fontStyle: el.getAttribute('font-style') || computed.fontStyle || DEFAULT_STYLE.fontStyle,
      opacity: parseFloat(el.getAttribute('opacity') || computed.opacity || '1'),
      transform: el.getAttribute('transform') || ''
    };

    // Element-specific attributes
    switch (tagName) {
      case 'rect':
        attrs.x = parseFloat(el.getAttribute('x') || '0');
        attrs.y = parseFloat(el.getAttribute('y') || '0');
        attrs.width = parseFloat(el.getAttribute('width') || '0');
        attrs.height = parseFloat(el.getAttribute('height') || '0');
        attrs.rx = parseFloat(el.getAttribute('rx') || '0');
        attrs.ry = parseFloat(el.getAttribute('ry') || '0');
        break;

      case 'circle':
        attrs.cx = parseFloat(el.getAttribute('cx') || '0');
        attrs.cy = parseFloat(el.getAttribute('cy') || '0');
        attrs.r = parseFloat(el.getAttribute('r') || '0');
        break;

      case 'ellipse':
        attrs.cx = parseFloat(el.getAttribute('cx') || '0');
        attrs.cy = parseFloat(el.getAttribute('cy') || '0');
        attrs.rx = parseFloat(el.getAttribute('rx') || '0');
        attrs.ry = parseFloat(el.getAttribute('ry') || '0');
        break;

      case 'line':
        attrs.x1 = parseFloat(el.getAttribute('x1') || '0');
        attrs.y1 = parseFloat(el.getAttribute('y1') || '0');
        attrs.x2 = parseFloat(el.getAttribute('x2') || '0');
        attrs.y2 = parseFloat(el.getAttribute('y2') || '0');
        break;

      case 'polyline':
      case 'polygon':
        attrs.points = el.getAttribute('points') || '';
        break;

      case 'path':
        attrs.d = el.getAttribute('d') || '';
        break;

      case 'text':
        attrs.x = parseFloat(el.getAttribute('x') || '0');
        attrs.y = parseFloat(el.getAttribute('y') || '0');
        break;

      case 'image':
        attrs.x = parseFloat(el.getAttribute('x') || '0');
        attrs.y = parseFloat(el.getAttribute('y') || '0');
        attrs.width = parseFloat(el.getAttribute('width') || '0');
        attrs.height = parseFloat(el.getAttribute('height') || '0');
        break;
    }

    return attrs;
  }

  private render(): void {
    this.panel = document.createElement('div');
    this.panel.className = 'graphing-properties-panel';
    this.panel.style.cssText = `
      display: flex;
      flex-direction: column;
      padding: 8px;
      background-color: var(--vscode-sideBar-background, #252526);
      border-top: 1px solid var(--vscode-sideBar-border, #3c3c3c);
      font-size: 12px;
      color: var(--vscode-foreground, #cccccc);
      max-height: 300px;
      overflow-y: auto;
    `;

    this.container.appendChild(this.panel);
    this.rebuildPanel();
  }

  private rebuildPanel(): void {
    if (!this.panel) return;
    this.panel.innerHTML = '';
    this.inputs.clear();

    const attrs = this.currentAttributes;
    const tagName = attrs.tagName;

    // Canvas section (always visible)
    this.panel.appendChild(this.createSection('Canvas', [
      this.createCanvasNumberControl('Width', this.canvasWidth, 1, 10000, 1),
      this.createCanvasNumberControl('Height', this.canvasHeight, 1, 10000, 1)
    ]));

    // ViewBox section (always visible)
    this.panel.appendChild(this.createSection('ViewBox', [
      this.createViewBoxNumberControl('Min X', 'viewBoxX', this.viewBoxX, -99999, 99999, 1),
      this.createViewBoxNumberControl('Min Y', 'viewBoxY', this.viewBoxY, -99999, 99999, 1),
      this.createViewBoxNumberControl('Width', 'viewBoxW', this.viewBoxW, 1, 99999, 1),
      this.createViewBoxNumberControl('Height', 'viewBoxH', this.viewBoxH, 1, 99999, 1)
    ]));

    // Element Info section
    this.panel.appendChild(this.createSection('Element', [
      this.createTextControl('ID', 'id', attrs.id),
      this.createReadOnlyControl('Tag', 'tagName', tagName)
    ]));

    // Position/Size section (only for elements with geometry)
    if (tagName && ['rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text', 'image'].includes(tagName)) {
      const controls: HTMLElement[] = [];

      switch (tagName) {
        case 'rect':
          controls.push(
            this.createNumberControl('X', 'x', attrs.x || 0, -9999, 9999, 1),
            this.createNumberControl('Y', 'y', attrs.y || 0, -9999, 9999, 1),
            this.createNumberControl('Width', 'width', attrs.width || 0, 0, 9999, 1),
            this.createNumberControl('Height', 'height', attrs.height || 0, 0, 9999, 1),
            this.createNumberControl('RX', 'rx', attrs.rx || 0, 0, 9999, 1),
            this.createNumberControl('RY', 'ry', attrs.ry || 0, 0, 9999, 1)
          );
          break;

        case 'circle':
          controls.push(
            this.createNumberControl('CX', 'cx', attrs.cx || 0, -9999, 9999, 1),
            this.createNumberControl('CY', 'cy', attrs.cy || 0, -9999, 9999, 1),
            this.createNumberControl('R', 'r', attrs.r || 0, 0, 9999, 1)
          );
          break;

        case 'ellipse':
          controls.push(
            this.createNumberControl('CX', 'cx', attrs.cx || 0, -9999, 9999, 1),
            this.createNumberControl('CY', 'cy', attrs.cy || 0, -9999, 9999, 1),
            this.createNumberControl('RX', 'rx', attrs.rx || 0, 0, 9999, 1),
            this.createNumberControl('RY', 'ry', attrs.ry || 0, 0, 9999, 1)
          );
          break;

        case 'line':
          controls.push(
            this.createNumberControl('X1', 'x1', attrs.x1 || 0, -9999, 9999, 1),
            this.createNumberControl('Y1', 'y1', attrs.y1 || 0, -9999, 9999, 1),
            this.createNumberControl('X2', 'x2', attrs.x2 || 0, -9999, 9999, 1),
            this.createNumberControl('Y2', 'y2', attrs.y2 || 0, -9999, 9999, 1)
          );
          break;

        case 'polyline':
        case 'polygon':
          controls.push(
            this.createTextAreaControl('Points', 'points', attrs.points || '')
          );
          break;

        case 'path':
          controls.push(
            this.createTextAreaControl('Path', 'd', attrs.d || '')
          );
          break;

        case 'text':
          controls.push(
            this.createNumberControl('X', 'x', attrs.x || 0, -9999, 9999, 1),
            this.createNumberControl('Y', 'y', attrs.y || 0, -9999, 9999, 1)
          );
          break;

        case 'image':
          controls.push(
            this.createNumberControl('X', 'x', attrs.x || 0, -9999, 9999, 1),
            this.createNumberControl('Y', 'y', attrs.y || 0, -9999, 9999, 1),
            this.createNumberControl('Width', 'width', attrs.width || 0, 0, 9999, 1),
            this.createNumberControl('Height', 'height', attrs.height || 0, 0, 9999, 1)
          );
          break;
      }

      if (controls.length > 0) {
        this.panel.appendChild(this.createSection('Position & Size', controls));
      }
    }

    // Content section (only for a single-selected <text> element)
    if (tagName === 'text') {
        const elems = (this.canvas as any).getSelectedElements() || [];
        if (elems.length === 1 && this.onTextContentChange) {
            const el = elems[0] as SVGElement;
            const initial = el.innerHTML;
            const callback = this.onTextContentChange;
            this.panel.appendChild(this.createSection('Content', [
                this.createTextContentControl('Text', initial, (newText) => {
                    callback(el, newText);
                })
            ]));
        }
    }

    // Style section
    this.panel.appendChild(this.createSection('Style', [
      this.createColorControl('Fill', 'fill', attrs.fill),
      this.createNumberControl('Fill Opacity', 'fillOpacity', attrs.fillOpacity, 0, 1, 0.1),
      this.createColorControl('Stroke', 'stroke', attrs.stroke),
      this.createNumberControl('Stroke Width', 'strokeWidth', attrs.strokeWidth, 0, 100, 0.5),
      this.createNumberControl('Stroke Opacity', 'strokeOpacity', attrs.strokeOpacity, 0, 1, 0.1)
    ]));

    // Font section (only for text elements)
    if (tagName === 'text') {
      this.panel.appendChild(this.createSection('Font', [
        this.createTextControl('Family', 'fontFamily', attrs.fontFamily),
        this.createNumberControl('Size', 'fontSize', attrs.fontSize, 1, 200, 1),
        this.createSelectControl('Weight', 'fontWeight', attrs.fontWeight, ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900']),
        this.createSelectControl('Style', 'fontStyle', attrs.fontStyle, ['normal', 'italic', 'oblique'])
      ]));
    }

    // Transform section
    this.panel.appendChild(this.createSection('Transform', [
      this.createTextControl('Transform', 'transform', attrs.transform)
    ]));

    // Opacity section
    this.panel.appendChild(this.createSection('Opacity', [
      this.createNumberControl('Opacity', 'opacity', attrs.opacity, 0, 1, 0.1)
    ]));
  }

  private createSection(title: string, controls: HTMLElement[]): HTMLElement {
    const section = document.createElement('div');
    section.className = 'graphing-properties-section';
    section.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 4px 0;
      border-bottom: 1px solid var(--vscode-sideBar-border, #3c3c3c);
    `;

    const header = document.createElement('div');
    header.className = 'graphing-properties-section-header';
    header.style.cssText = `
      font-weight: bold;
      font-size: 11px;
      text-transform: uppercase;
      opacity: 0.7;
      cursor: pointer;
      user-select: none;
    `;
    header.textContent = title;

    const content = document.createElement('div');
    content.className = 'graphing-properties-section-content';
    content.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    `;

    // Toggle section collapse
    header.addEventListener('click', () => {
      const isVisible = content.style.display !== 'none';
      content.style.display = isVisible ? 'none' : 'flex';
      header.textContent = (isVisible ? '▶ ' : '▼ ') + title;
    });

    controls.forEach(control => content.appendChild(control));
    section.appendChild(header);
    section.appendChild(content);

    return section;
  }

  private createColorControl(label: string, property: keyof ElementAttributes, value: string): HTMLElement {
    const group = document.createElement('div');
    group.style.cssText = 'display: flex; flex-direction: column; gap: 2px; min-width: 80px;';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-size: 11px; opacity: 0.8;';
    group.appendChild(labelEl);

    const input = document.createElement('input');
    input.type = 'color';
    input.value = value;
    input.style.cssText = `
      width: 100%;
      height: 24px;
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      border-radius: 3px;
      background: var(--vscode-input-background, #3c3c3c);
      cursor: pointer;
    `;
    input.addEventListener('input', () => {
      (this.currentAttributes as any)[property] = input.value;
      this.applyStyle();
    });
    group.appendChild(input);

    this.inputs.set(property, input);
    return group;
  }

  private createCanvasNumberControl(label: string, value: number, min: number, max: number, step: number): HTMLElement {
    const group = document.createElement('div');
    group.style.cssText = 'display: flex; flex-direction: column; gap: 2px; min-width: 60px;';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-size: 11px; opacity: 0.8;';
    group.appendChild(labelEl);

    const input = document.createElement('input');
    input.type = 'number';
    input.value = value.toString();
    input.min = min.toString();
    input.max = max.toString();
    input.step = step.toString();
    input.style.cssText = `
      width: 100%;
      height: 24px;
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      border-radius: 3px;
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #cccccc);
      padding: 0 4px;
      box-sizing: border-box;
    `;
    input.addEventListener('change', () => {
      const newValue = parseFloat(input.value);
      if (label === 'Width') {
        this.canvasWidth = newValue;
      } else {
        this.canvasHeight = newValue;
      }
      if (this.onCanvasResize) {
        this.onCanvasResize(this.canvasWidth, this.canvasHeight);
      }
    });
    group.appendChild(input);

    return group;
  }

  private createViewBoxNumberControl(label: string, property: string, value: number, min: number, max: number, step: number): HTMLElement {
    const group = document.createElement('div');
    group.style.cssText = 'display: flex; flex-direction: column; gap: 2px; min-width: 60px;';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-size: 11px; opacity: 0.8;';
    group.appendChild(labelEl);

    const input = document.createElement('input');
    input.type = 'number';
    input.value = value.toString();
    input.min = min.toString();
    input.max = max.toString();
    input.step = step.toString();
    input.style.cssText = `
      width: 100%;
      height: 24px;
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      border-radius: 3px;
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #cccccc);
      padding: 0 4px;
      box-sizing: border-box;
    `;
    input.addEventListener('change', () => {
      const newValue = parseFloat(input.value);
      (this as any)[property] = newValue;
      if (this.onViewBoxChange) {
        this.onViewBoxChange({
          x: this.viewBoxX,
          y: this.viewBoxY,
          w: this.viewBoxW,
          h: this.viewBoxH
        });
      }
    });
    group.appendChild(input);

    return group;
  }

  private createNumberControl(label: string, property: keyof ElementAttributes, value: number, min: number, max: number, step: number): HTMLElement {
    const group = document.createElement('div');
    group.style.cssText = 'display: flex; flex-direction: column; gap: 2px; min-width: 60px;';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-size: 11px; opacity: 0.8;';
    group.appendChild(labelEl);

    const input = document.createElement('input');
    input.type = 'number';
    input.value = value.toString();
    input.min = min.toString();
    input.max = max.toString();
    input.step = step.toString();
    input.style.cssText = `
      width: 100%;
      height: 24px;
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      border-radius: 3px;
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #cccccc);
      padding: 0 4px;
      box-sizing: border-box;
    `;
    input.addEventListener('input', () => {
      (this.currentAttributes as any)[property] = parseFloat(input.value);
      this.applyStyle();
    });
    group.appendChild(input);

    this.inputs.set(property, input);
    return group;
  }

  private createTextControl(label: string, property: keyof ElementAttributes, value: string): HTMLElement {
    const group = document.createElement('div');
    group.style.cssText = 'display: flex; flex-direction: column; gap: 2px; min-width: 100px;';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-size: 11px; opacity: 0.8;';
    group.appendChild(labelEl);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.style.cssText = `
      width: 100%;
      height: 24px;
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      border-radius: 3px;
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #cccccc);
      padding: 0 4px;
      box-sizing: border-box;
    `;
    input.addEventListener('input', () => {
      (this.currentAttributes as any)[property] = input.value;
      this.applyStyle();
    });
    group.appendChild(input);

    this.inputs.set(property, input);
    return group;
  }

  private createReadOnlyControl(label: string, property: keyof ElementAttributes, value: string): HTMLElement {
    const group = document.createElement('div');
    group.style.cssText = 'display: flex; flex-direction: column; gap: 2px; min-width: 100px;';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-size: 11px; opacity: 0.8;';
    group.appendChild(labelEl);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.readOnly = true;
    input.style.cssText = `
      width: 100%;
      height: 24px;
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      border-radius: 3px;
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #cccccc);
      padding: 0 4px;
      box-sizing: border-box;
      opacity: 0.7;
    `;
    group.appendChild(input);

    this.inputs.set(property, input);
    return group;
  }

  private createSelectControl(label: string, property: keyof ElementAttributes, value: string, options: string[]): HTMLElement {
    const group = document.createElement('div');
    group.style.cssText = 'display: flex; flex-direction: column; gap: 2px; min-width: 70px;';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-size: 11px; opacity: 0.8;';
    group.appendChild(labelEl);

    const select = document.createElement('select');
    select.style.cssText = `
      width: 100%;
      height: 24px;
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      border-radius: 3px;
      background: var(--vscode-dropdown-background, #3c3c3c);
      color: var(--vscode-dropdown-foreground, #cccccc);
      padding: 0 4px;
      box-sizing: border-box;
    `;
    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      if (opt === value) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', () => {
      (this.currentAttributes as any)[property] = select.value;
      this.applyStyle();
    });
    group.appendChild(select);

    this.inputs.set(property, select);
    return group;
  }

  private createTextAreaControl(label: string, property: keyof ElementAttributes, value: string): HTMLElement {
    const group = document.createElement('div');
    group.style.cssText = 'display: flex; flex-direction: column; gap: 2px; width: 100%;';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-size: 11px; opacity: 0.8;';
    group.appendChild(labelEl);

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.rows = 3;
    textarea.style.cssText = `
      width: 100%;
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      border-radius: 3px;
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #cccccc);
      padding: 4px;
      box-sizing: border-box;
      font-family: monospace;
      font-size: 11px;
      resize: vertical;
    `;
    textarea.addEventListener('input', () => {
      (this.currentAttributes as any)[property] = textarea.value;
      this.applyStyle();
    });
    group.appendChild(textarea);

    this.inputs.set(property, textarea);
    return group;
  }

  private createTextContentControl(
    label: string,
    initialText: string,
    onCommit: (newText: string) => void
  ): HTMLElement {
    const group = document.createElement('div');
    group.style.cssText = 'display: flex; flex-direction: column; gap: 2px; width: 100%;';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-size: 11px; opacity: 0.8;';
    group.appendChild(labelEl);

    const textarea = document.createElement('textarea');
    textarea.value = initialText;
    textarea.rows = 3;
    textarea.placeholder = '(no text)';
    textarea.style.cssText = `
      width: 100%;
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      border-radius: 3px;
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #cccccc);
      padding: 4px;
      box-sizing: border-box;
      font-family: monospace;
      font-size: 11px;
      resize: vertical;
    `;

    // Track the value at focus time so we only commit on real change.
    let focusedValue = initialText;
    textarea.addEventListener('focus', () => {
        focusedValue = textarea.value;
    });
    textarea.addEventListener('blur', () => {
        if (textarea.value !== focusedValue) {
            onCommit(textarea.value);
        }
    });

    group.appendChild(textarea);
    return group;
  }

  private computeChanges(
    prev: ElementAttributes,
    curr: ElementAttributes
  ): Array<{name: string, newValue: string}> {
    const changes: Array<{name: string, newValue: string}> = [];
    const keys = Object.keys(curr) as Array<keyof ElementAttributes>;
    for (const key of keys) {
      if (key === 'tagName') continue; // metadata, not an SVG attribute
      const prevV = (prev as any)[key];
      const currV = (curr as any)[key];
      if (String(prevV) === String(currV)) continue;
      const attrName = CAMEL_TO_KEBAB[key as string] || (key as string);
      changes.push({ name: attrName, newValue: String(currV) });
    }
    return changes;
  }

  private applyStyle(): void {
    let changes: Array<{name: string, newValue: string}> = [];
    if (this.lastAppliedAttributes) {
      changes = this.computeChanges(this.lastAppliedAttributes, this.currentAttributes);
    }
    this.lastAppliedAttributes = { ...this.currentAttributes };
    this.onStyleChange(this.currentAttributes, changes);
  }

  private updateUI(): void {
    this.rebuildPanel();
  }
}
