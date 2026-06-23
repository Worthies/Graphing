/**
 * SVG Edit toolbar component.
 * Renders drawing mode buttons and operation buttons using inline SVG icons.
 */

import { getIcon } from './svgIcons';

export type DrawMode = 'select' | 'rect' | 'ellipse' | 'circle' | 'line' | 'polyline' | 'polygon' | 'path' | 'text' | 'image';

export type Operation = 'delete' | 'duplicate' | 'group' | 'ungroup' | 'bringForward' | 'sendBackward' |
  'alignLeft' | 'alignRight' | 'alignTop' | 'alignBottom' |
  'rotateClockwise' | 'rotateCounterclockwise' |
  'rotateClockwiseByTheAngleStep' | 'rotateCounterclockwiseByTheAngleStep' |
  'zoomIn' | 'zoomOut' | 'objectToPath' |
  'centerVertical' | 'centerHorizontal' |
  'polygonToRect' | 'fitCanvasToContent' | 'copyAsPng' | 'toggleBackground';

interface ToolbarButton {
  id: string;
  label: string;
  title: string;
  codicon?: string;
  mode?: DrawMode;
  operation?: Operation;
}

const drawModeButtons: ToolbarButton[] = [
  { id: 'select', label: 'Select', title: 'Select (V)', codicon: 'edit', mode: 'select' },
  { id: 'rect', label: 'Rectangle', title: 'Rectangle (R)', codicon: 'symbol-square', mode: 'rect' },
  { id: 'ellipse', label: 'Ellipse', title: 'Ellipse (E)', codicon: 'circle-large', mode: 'ellipse' },
  { id: 'line', label: 'Line', title: 'Line (L)', codicon: 'dash', mode: 'line' },
  { id: 'polyline', label: 'Polyline', title: 'Polyline (P)', codicon: 'graph-line', mode: 'polyline' },
  { id: 'path', label: 'Path', title: 'Path (A)', codicon: 'spline', mode: 'path' },
  { id: 'text', label: 'Text', title: 'Text (T)', codicon: 'symbol-text', mode: 'text' },
  { id: 'image', label: 'Image', title: 'Image (I)', codicon: 'image', mode: 'image' }
];

const operationButtons: ToolbarButton[] = [
  { id: 'delete', label: 'Delete', title: 'Delete', codicon: 'trash', operation: 'delete' },
  { id: 'duplicate', label: 'Duplicate', title: 'Duplicate (Ctrl+D)', codicon: 'copy', operation: 'duplicate' },
  { id: 'group', label: 'Group', title: 'Group (Ctrl+G)', codicon: 'group-by-ref-type', operation: 'group' },
  { id: 'ungroup', label: 'Ungroup', title: 'Ungroup (Ctrl+U)', codicon: 'ungroup-by-ref-type', operation: 'ungroup' },
  { id: 'bringForward', label: 'Forward', title: 'Bring Forward (PageUp)', codicon: 'arrow-up', operation: 'bringForward' },
  { id: 'sendBackward', label: 'Backward', title: 'Send Backward (PageDown)', codicon: 'arrow-down', operation: 'sendBackward' },
  { id: 'separator1', label: '', title: '' },
  { id: 'alignLeft', label: 'Align Left', title: 'Align Left', codicon: 'align-left', operation: 'alignLeft' },
  { id: 'alignRight', label: 'Align Right', title: 'Align Right', codicon: 'align-right', operation: 'alignRight' },
  { id: 'alignTop', label: 'Align Top', title: 'Align Top', codicon: 'align-top', operation: 'alignTop' },
  { id: 'alignBottom', label: 'Align Bottom', title: 'Align Bottom', codicon: 'align-bottom', operation: 'alignBottom' },
  { id: 'separator2', label: '', title: '' },
  { id: 'rotateClockwise', label: 'Rotate CW', title: 'Rotate Clockwise (Ctrl+])', codicon: 'refresh', operation: 'rotateClockwise' },
  { id: 'rotateCounterclockwise', label: 'Rotate CCW', title: 'Rotate Counterclockwise (Ctrl+[)', codicon: 'refresh', operation: 'rotateCounterclockwise' },
  { id: 'separator3', label: '', title: '' },
  { id: 'zoomIn', label: 'Zoom In', title: 'Zoom In (+)', codicon: 'zoom-in', operation: 'zoomIn' },
  { id: 'zoomOut', label: 'Zoom Out', title: 'Zoom Out (-)', codicon: 'zoom-out', operation: 'zoomOut' },
  { id: 'centerVertical', label: 'Center V', title: 'Center Vertical', codicon: 'symbol-numeric', operation: 'centerVertical' },
  { id: 'centerHorizontal', label: 'Center H', title: 'Center Horizontal', codicon: 'symbol-numeric', operation: 'centerHorizontal' },
  { id: 'separator4', label: '', title: '' },
  { id: 'polygonToRect', label: 'To Rect', title: 'Convert Polygon to Rectangle', codicon: 'symbol-square', operation: 'polygonToRect' },
  { id: 'fitCanvasToContent', label: 'Fit Canvas', title: 'Fit Canvas to Content', codicon: 'screen-full', operation: 'fitCanvasToContent' },
  { id: 'copyAsPng', label: 'Copy PNG', title: 'Copy as PNG to Clipboard', codicon: 'clippy', operation: 'copyAsPng' },
  { id: 'toggleBackground', label: 'BG', title: 'Toggle Background Color', codicon: 'color-mode', operation: 'toggleBackground' }
];

export class SvgeditToolbar {
  private container: HTMLElement;
  private currentMode: DrawMode = 'select';
  private onModeChange: (mode: DrawMode) => void;
  private onOperation: (op: Operation) => void;
  private buttons: Map<string, HTMLElement> = new Map();

  constructor(
    container: HTMLElement,
    onModeChange: (mode: DrawMode) => void,
    onOperation: (op: Operation) => void
  ) {
    this.container = container;
    this.onModeChange = onModeChange;
    this.onOperation = onOperation;
    this.render();
  }

  setActiveMode(mode: DrawMode): void {
    this.currentMode = mode;
    this.updateActiveStates();
  }

  private render(): void {
    const toolbar = document.createElement('div');
    toolbar.className = 'graphing-toolbar';
    toolbar.style.cssText = `
      display: flex;
      gap: 2px;
      padding: 4px;
      background-color: var(--vscode-sideBar-background, #252526);
      border-bottom: 1px solid var(--vscode-sideBar-border, #3c3c3c);
      flex-wrap: wrap;
    `;

    // Draw mode buttons
    const drawGroup = this.createButtonGroup('Draw');
    drawModeButtons.forEach(btn => {
      const button = this.createToolButton(btn, true);
      drawGroup.appendChild(button);
      this.buttons.set(btn.id, button);
    });
    toolbar.appendChild(drawGroup);

    // Separator
    toolbar.appendChild(this.createSeparator());

    // Operation buttons
    const opGroup = this.createButtonGroup('Operations');
    operationButtons.forEach(btn => {
      if (btn.id.startsWith('separator')) {
        opGroup.appendChild(this.createSeparator());
      } else {
        const button = this.createToolButton(btn, false);
        opGroup.appendChild(button);
        this.buttons.set(btn.id, button);
      }
    });
    toolbar.appendChild(opGroup);

    this.container.appendChild(toolbar);
  }

  private createButtonGroup(label: string): HTMLElement {
    const group = document.createElement('div');
    group.className = 'graphing-button-group';
    group.setAttribute('aria-label', label);
    group.style.cssText = 'display: flex; gap: 2px; align-items: center;';
    return group;
  }

  private createSeparator(): HTMLElement {
    const sep = document.createElement('div');
    sep.className = 'graphing-separator';
    sep.style.cssText = 'width: 1px; background: var(--vscode-sideBar-border, #3c3c3c); margin: 0 4px; height: 20px;';
    return sep;
  }

  private createToolButton(btn: ToolbarButton, isMode: boolean): HTMLElement {
    const button = document.createElement('button');
    button.className = 'graphing-toolbutton';
    button.title = btn.title;
    button.dataset['id'] = btn.id;
    button.setAttribute('aria-label', btn.label);

    // Use SVG icon if available, otherwise fallback to text
    const iconSvg = getIcon(btn.id);
    if (iconSvg) {
      button.innerHTML = iconSvg;
    } else {
      button.textContent = btn.label;
    }

    button.style.cssText = `
      width: 28px;
      height: 28px;
      border: 1px solid transparent;
      border-radius: 3px;
      background: transparent;
      color: var(--vscode-foreground, #cccccc);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      padding: 0;
      position: relative;
    `;

    if (isMode && btn.mode === this.currentMode) {
      this.setActiveStyle(button);
    }

    button.addEventListener('click', () => {
      if (isMode && btn.mode) {
        this.currentMode = btn.mode;
        this.updateActiveStates();
        this.onModeChange(btn.mode);
      } else if (!isMode && btn.operation) {
        this.onOperation(btn.operation);
        this.flashButton(button);
      }
    });

    button.addEventListener('mouseenter', () => {
      if (!button.classList.contains('active')) {
        button.style.backgroundColor = 'var(--vscode-toolbar-hoverBackground, rgba(255, 255, 255, 0.1))';
      }
    });

    button.addEventListener('mouseleave', () => {
      if (!button.classList.contains('active')) {
        button.style.backgroundColor = 'transparent';
      }
    });

    return button;
  }

  private setActiveStyle(button: HTMLElement): void {
    button.classList.add('active');
    button.style.backgroundColor = 'var(--vscode-activityBarBadge-background, #007acc)';
    button.style.color = 'var(--vscode-activityBarBadge-foreground, #ffffff)';
  }

  private setInactiveStyle(button: HTMLElement): void {
    button.classList.remove('active');
    button.style.backgroundColor = 'transparent';
    button.style.color = 'var(--vscode-foreground, #cccccc)';
  }

  private flashButton(button: HTMLElement): void {
    const originalBg = button.style.backgroundColor;
    button.style.backgroundColor = 'var(--vscode-activityBarBadge-background, #007acc)';
    setTimeout(() => {
      button.style.backgroundColor = originalBg;
    }, 150);
  }

  private updateActiveStates(): void {
    drawModeButtons.forEach(btn => {
      const button = this.buttons.get(btn.id);
      if (button) {
        if (btn.mode === this.currentMode) {
          this.setActiveStyle(button);
        } else {
          this.setInactiveStyle(button);
        }
      }
    });
  }
}
