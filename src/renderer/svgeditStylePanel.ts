/**
 * SVG Edit style panel component.
 * Provides color pickers and style controls using VS Code theming.
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

export class SvgeditStylePanel {
  private container: HTMLElement;
  private canvas: any;
  private currentStyle: StyleState = { ...DEFAULT_STYLE };
  private onStyleChange: (style: StyleState) => void;
  private inputs: Map<string, HTMLInputElement | HTMLSelectElement> = new Map();

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
      this.currentStyle = { ...DEFAULT_STYLE };
    } else if (elems.length === 1) {
      const el = elems[0] as SVGElement;
      this.currentStyle = this.getStyleFromElement(el);
    }
    this.updateUI();
  }

  private getStyleFromElement(el: SVGElement): StyleState {
    const computed = window.getComputedStyle(el);
    return {
      fill: el.getAttribute('fill') || computed.fill || DEFAULT_STYLE.fill,
      fillOpacity: parseFloat(el.getAttribute('fill-opacity') || computed.fillOpacity || '1'),
      stroke: el.getAttribute('stroke') || computed.stroke || DEFAULT_STYLE.stroke,
      strokeWidth: parseFloat(el.getAttribute('stroke-width') || computed.strokeWidth || '1'),
      strokeOpacity: parseFloat(el.getAttribute('stroke-opacity') || computed.strokeOpacity || '1'),
      fontFamily: el.getAttribute('font-family') || computed.fontFamily || DEFAULT_STYLE.fontFamily,
      fontSize: parseFloat(el.getAttribute('font-size') || computed.fontSize || '24'),
      fontWeight: el.getAttribute('font-weight') || computed.fontWeight || DEFAULT_STYLE.fontWeight,
      fontStyle: el.getAttribute('font-style') || computed.fontStyle || DEFAULT_STYLE.fontStyle,
      opacity: parseFloat(el.getAttribute('opacity') || computed.opacity || '1')
    };
  }

  private render(): void {
    const panel = document.createElement('div');
    panel.className = 'graphing-style-panel';
    panel.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px;
      background-color: var(--vscode-sideBar-background, #252526);
      border-top: 1px solid var(--vscode-sideBar-border, #3c3c3c);
      font-size: 12px;
      color: var(--vscode-foreground, #cccccc);
    `;

    // Fill section
    panel.appendChild(this.createColorControl('Fill', 'fill', this.currentStyle.fill));
    panel.appendChild(this.createNumberControl('Fill Opacity', 'fillOpacity', this.currentStyle.fillOpacity, 0, 1, 0.1));

    // Stroke section
    panel.appendChild(this.createColorControl('Stroke', 'stroke', this.currentStyle.stroke));
    panel.appendChild(this.createNumberControl('Stroke Width', 'strokeWidth', this.currentStyle.strokeWidth, 0, 100, 0.5));
    panel.appendChild(this.createNumberControl('Stroke Opacity', 'strokeOpacity', this.currentStyle.strokeOpacity, 0, 1, 0.1));

    // Font section
    panel.appendChild(this.createTextControl('Font', 'fontFamily', this.currentStyle.fontFamily));
    panel.appendChild(this.createNumberControl('Font Size', 'fontSize', this.currentStyle.fontSize, 1, 200, 1));
    panel.appendChild(this.createSelectControl('Weight', 'fontWeight', this.currentStyle.fontWeight, ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900']));
    panel.appendChild(this.createSelectControl('Style', 'fontStyle', this.currentStyle.fontStyle, ['normal', 'italic', 'oblique']));

    // Opacity
    panel.appendChild(this.createNumberControl('Opacity', 'opacity', this.currentStyle.opacity, 0, 1, 0.1));

    this.container.appendChild(panel);
  }

  private createColorControl(label: string, property: keyof StyleState, value: string): HTMLElement {
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
      (this.currentStyle as any)[property] = input.value;
      this.applyStyle();
    });
    group.appendChild(input);

    this.inputs.set(property, input);
    return group;
  }

  private createNumberControl(label: string, property: keyof StyleState, value: number, min: number, max: number, step: number): HTMLElement {
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
      (this.currentStyle as any)[property] = parseFloat(input.value);
      this.applyStyle();
    });
    group.appendChild(input);

    this.inputs.set(property, input);
    return group;
  }

  private createTextControl(label: string, property: keyof StyleState, value: string): HTMLElement {
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
      (this.currentStyle as any)[property] = input.value;
      this.applyStyle();
    });
    group.appendChild(input);

    this.inputs.set(property, input);
    return group;
  }

  private createSelectControl(label: string, property: keyof StyleState, value: string, options: string[]): HTMLElement {
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
      (this.currentStyle as any)[property] = select.value;
      this.applyStyle();
    });
    group.appendChild(select);

    this.inputs.set(property, select);
    return group;
  }

  private applyStyle(): void {
    this.onStyleChange(this.currentStyle);
  }

  private updateUI(): void {
    for (const [property, input] of this.inputs) {
      const value = (this.currentStyle as any)[property];
      if (input instanceof HTMLInputElement) {
        if (input.type === 'number') {
          input.value = value != null ? value.toString() : '';
        } else {
          input.value = value || '';
        }
      } else if (input instanceof HTMLSelectElement) {
        input.value = value || '';
      }
    }
  }
}
