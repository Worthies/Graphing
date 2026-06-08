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

export class SvgeditStylePanel {
  private container: HTMLElement;
  private canvas: any;
  private currentAttributes: ElementAttributes = { ...DEFAULT_ATTRIBUTES };
  private onStyleChange: (style: StyleState) => void;
  private inputs: Map<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> = new Map();
  private propertiesContainer: HTMLElement | null = null;

  constructor(
    container: HTMLElement,
    canvas: any,
    onStyleChange: (style: StyleState) => void
  ) {
    this.container = container;
    this.canvas = canvas;
    this.onStyleChange = onStyleChange;
    this.render();
  }

  updateFromSelection(): void {
    const elems = (this.canvas as any).getSelectedElements() || [];
    if (elems.length === 0) {
      this.currentAttributes = { ...DEFAULT_ATTRIBUTES };
    } else if (elems.length === 1) {
      const el = elems[0] as SVGElement;
      this.currentAttributes = this.getAttributesFromElement(el);
    }
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
    const panel = document.createElement('div');
    panel.className = 'graphing-properties-panel';
    panel.style.cssText = `
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

    // Properties sections container
    this.propertiesContainer = document.createElement('div');
    this.propertiesContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

    // Element Info section
    this.propertiesContainer.appendChild(this.createSection('Element', [
      this.createTextControl('ID', 'id', ''),
      this.createReadOnlyControl('Tag', 'tagName', '')
    ]));

    // Position/Size section (dynamic based on element type)
    const positionSection = document.createElement('div');
    positionSection.id = 'position-section';
    this.propertiesContainer.appendChild(positionSection);

    // Style section
    this.propertiesContainer.appendChild(this.createSection('Style', [
      this.createColorControl('Fill', 'fill', DEFAULT_STYLE.fill),
      this.createNumberControl('Fill Opacity', 'fillOpacity', DEFAULT_STYLE.fillOpacity, 0, 1, 0.1),
      this.createColorControl('Stroke', 'stroke', DEFAULT_STYLE.stroke),
      this.createNumberControl('Stroke Width', 'strokeWidth', DEFAULT_STYLE.strokeWidth, 0, 100, 0.5),
      this.createNumberControl('Stroke Opacity', 'strokeOpacity', DEFAULT_STYLE.strokeOpacity, 0, 1, 0.1)
    ]));

    // Font section
    this.propertiesContainer.appendChild(this.createSection('Font', [
      this.createTextControl('Family', 'fontFamily', DEFAULT_STYLE.fontFamily),
      this.createNumberControl('Size', 'fontSize', DEFAULT_STYLE.fontSize, 1, 200, 1),
      this.createSelectControl('Weight', 'fontWeight', DEFAULT_STYLE.fontWeight, ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900']),
      this.createSelectControl('Style', 'fontStyle', DEFAULT_STYLE.fontStyle, ['normal', 'italic', 'oblique'])
    ]));

    // Transform section
    this.propertiesContainer.appendChild(this.createSection('Transform', [
      this.createTextControl('Transform', 'transform', '')
    ]));

    // Opacity section
    this.propertiesContainer.appendChild(this.createSection('Opacity', [
      this.createNumberControl('Opacity', 'opacity', DEFAULT_STYLE.opacity, 0, 1, 0.1)
    ]));

    panel.appendChild(this.propertiesContainer);
    this.container.appendChild(panel);
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

  private updatePositionSection(): void {
    const positionSection = document.getElementById('position-section');
    if (!positionSection) return;

    // Clear existing content
    positionSection.innerHTML = '';
    positionSection.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 4px 0;
      border-bottom: 1px solid var(--vscode-sideBar-border, #3c3c3c);
    `;

    const controls: HTMLElement[] = [];
    const tagName = this.currentAttributes.tagName;

    switch (tagName) {
      case 'rect':
      case 'image':
        controls.push(
          this.createNumberControl('X', 'x', this.currentAttributes.x || 0, -9999, 9999, 1),
          this.createNumberControl('Y', 'y', this.currentAttributes.y || 0, -9999, 9999, 1),
          this.createNumberControl('Width', 'width', this.currentAttributes.width || 0, 0, 9999, 1),
          this.createNumberControl('Height', 'height', this.currentAttributes.height || 0, 0, 9999, 1)
        );
        if (tagName === 'rect') {
          controls.push(
            this.createNumberControl('RX', 'rx', this.currentAttributes.rx || 0, 0, 9999, 1),
            this.createNumberControl('RY', 'ry', this.currentAttributes.ry || 0, 0, 9999, 1)
          );
        }
        break;

      case 'circle':
        controls.push(
          this.createNumberControl('CX', 'cx', this.currentAttributes.cx || 0, -9999, 9999, 1),
          this.createNumberControl('CY', 'cy', this.currentAttributes.cy || 0, -9999, 9999, 1),
          this.createNumberControl('R', 'r', this.currentAttributes.r || 0, 0, 9999, 1)
        );
        break;

      case 'ellipse':
        controls.push(
          this.createNumberControl('CX', 'cx', this.currentAttributes.cx || 0, -9999, 9999, 1),
          this.createNumberControl('CY', 'cy', this.currentAttributes.cy || 0, -9999, 9999, 1),
          this.createNumberControl('RX', 'rx', this.currentAttributes.rx || 0, 0, 9999, 1),
          this.createNumberControl('RY', 'ry', this.currentAttributes.ry || 0, 0, 9999, 1)
        );
        break;

      case 'line':
        controls.push(
          this.createNumberControl('X1', 'x1', this.currentAttributes.x1 || 0, -9999, 9999, 1),
          this.createNumberControl('Y1', 'y1', this.currentAttributes.y1 || 0, -9999, 9999, 1),
          this.createNumberControl('X2', 'x2', this.currentAttributes.x2 || 0, -9999, 9999, 1),
          this.createNumberControl('Y2', 'y2', this.currentAttributes.y2 || 0, -9999, 9999, 1)
        );
        break;

      case 'polyline':
      case 'polygon':
        controls.push(
          this.createTextAreaControl('Points', 'points', this.currentAttributes.points || '')
        );
        break;

      case 'path':
        controls.push(
          this.createTextAreaControl('Path', 'd', this.currentAttributes.d || '')
        );
        break;

      case 'text':
        controls.push(
          this.createNumberControl('X', 'x', this.currentAttributes.x || 0, -9999, 9999, 1),
          this.createNumberControl('Y', 'y', this.currentAttributes.y || 0, -9999, 9999, 1)
        );
        break;
    }

    if (controls.length > 0) {
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
      header.textContent = 'Position & Size';

      const content = document.createElement('div');
      content.className = 'graphing-properties-section-content';
      content.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      `;

      header.addEventListener('click', () => {
        const isVisible = content.style.display !== 'none';
        content.style.display = isVisible ? 'none' : 'flex';
        header.textContent = (isVisible ? '▶ ' : '▼ ') + 'Position & Size';
      });

      controls.forEach(control => content.appendChild(control));
      positionSection.appendChild(header);
      positionSection.appendChild(content);
    }
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

  private applyStyle(): void {
    this.onStyleChange(this.currentAttributes);
  }

  private updateUI(): void {
    // Update position section based on element type
    this.updatePositionSection();

    // Update all input values
    for (const [property, input] of this.inputs) {
      const value = (this.currentAttributes as any)[property];
      if (input instanceof HTMLInputElement) {
        if (input.type === 'number') {
          input.value = value != null ? value.toString() : '';
        } else {
          input.value = value || '';
        }
      } else if (input instanceof HTMLSelectElement) {
        input.value = value || '';
      } else if (input instanceof HTMLTextAreaElement) {
        input.value = value || '';
      }
    }
  }
}
