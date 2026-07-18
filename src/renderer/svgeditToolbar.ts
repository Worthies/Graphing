/**
 * SVG Edit toolbar component.
 * Renders drawing mode buttons and operation buttons using inline SVG icons.
 */
import { getIcon } from './svgIcons';
import { t } from './i18n';

export type DrawMode = 'select' | 'rect' | 'ellipse' | 'circle' | 'line' | 'polyline' | 'polygon' | 'path' | 'text' | 'image';

export type Operation = 'delete' | 'duplicate' | 'group' | 'ungroup' | 'bringForward' | 'sendBackward' |
  'alignLeft' | 'alignRight' | 'alignTop' | 'alignBottom' |
  'rotateClockwise' | 'rotateCounterclockwise' |
  'rotateClockwiseByTheAngleStep' | 'rotateCounterclockwiseByTheAngleStep' |
  'zoomIn' | 'zoomOut' | 'objectToPath' |
  'centerVertical' | 'centerHorizontal' |
  'polygonToRect' | 'fitCanvasToContent' | 'copyAsPng' | 'toggleBackground' |
  'undo' | 'redo' | 'reload';

interface ToolbarButton {
  id: string;
  i18nKey: string;        // full key, e.g. 'toolbar.modes.select'
  shortcut?: string;      // keyboard hint, interpolated as {{shortcut}}
  codicon?: string;
  mode?: DrawMode;
  operation?: Operation;
}

const drawModeButtons: ToolbarButton[] = [
  { id: 'select', i18nKey: 'toolbar.modes.select', shortcut: 'V', codicon: 'edit', mode: 'select' },
  { id: 'rect', i18nKey: 'toolbar.modes.rect', shortcut: 'R', codicon: 'symbol-square', mode: 'rect' },
  { id: 'ellipse', i18nKey: 'toolbar.modes.ellipse', shortcut: 'E', codicon: 'circle-large', mode: 'ellipse' },
  { id: 'line', i18nKey: 'toolbar.modes.line', shortcut: 'L', codicon: 'dash', mode: 'line' },
  { id: 'polyline', i18nKey: 'toolbar.modes.polyline', shortcut: 'P', codicon: 'graph-line', mode: 'polyline' },
  { id: 'path', i18nKey: 'toolbar.modes.path', shortcut: 'A', codicon: 'spline', mode: 'path' },
  { id: 'text', i18nKey: 'toolbar.modes.text', shortcut: 'T', codicon: 'symbol-text', mode: 'text' },
  { id: 'image', i18nKey: 'toolbar.modes.image', shortcut: 'I', codicon: 'image', mode: 'image' }
];

const operationButtons: ToolbarButton[] = [
  { id: 'undo', i18nKey: 'toolbar.operations.undo', shortcut: 'Ctrl+Z', codicon: 'discard', operation: 'undo' },
  { id: 'redo', i18nKey: 'toolbar.operations.redo', shortcut: 'Ctrl+Shift+Z', codicon: 'redo', operation: 'redo' },
  { id: 'reload', i18nKey: 'toolbar.operations.reload', codicon: 'refresh', operation: 'reload' },
  { id: 'separator0', i18nKey: '' },
  { id: 'delete', i18nKey: 'toolbar.operations.delete', codicon: 'trash', operation: 'delete' },
  { id: 'duplicate', i18nKey: 'toolbar.operations.duplicate', shortcut: 'Ctrl+D', codicon: 'copy', operation: 'duplicate' },
  { id: 'group', i18nKey: 'toolbar.operations.group', shortcut: 'Ctrl+G', codicon: 'group-by-ref-type', operation: 'group' },
  { id: 'ungroup', i18nKey: 'toolbar.operations.ungroup', shortcut: 'Ctrl+U', codicon: 'ungroup-by-ref-type', operation: 'ungroup' },
  { id: 'bringForward', i18nKey: 'toolbar.operations.bringForward', shortcut: 'PageUp', codicon: 'arrow-up', operation: 'bringForward' },
  { id: 'sendBackward', i18nKey: 'toolbar.operations.sendBackward', shortcut: 'PageDown', codicon: 'arrow-down', operation: 'sendBackward' },
  { id: 'separator1', i18nKey: '' },
  { id: 'alignLeft', i18nKey: 'toolbar.operations.alignLeft', codicon: 'align-left', operation: 'alignLeft' },
  { id: 'alignRight', i18nKey: 'toolbar.operations.alignRight', codicon: 'align-right', operation: 'alignRight' },
  { id: 'alignTop', i18nKey: 'toolbar.operations.alignTop', codicon: 'align-top', operation: 'alignTop' },
  { id: 'alignBottom', i18nKey: 'toolbar.operations.alignBottom', codicon: 'align-bottom', operation: 'alignBottom' },
  { id: 'separator2', i18nKey: '' },
  { id: 'rotateClockwise', i18nKey: 'toolbar.operations.rotateClockwise', shortcut: 'Ctrl+]', codicon: 'refresh', operation: 'rotateClockwise' },
  { id: 'rotateCounterclockwise', i18nKey: 'toolbar.operations.rotateCounterclockwise', shortcut: 'Ctrl+[', codicon: 'refresh', operation: 'rotateCounterclockwise' },
  { id: 'separator3', i18nKey: '' },
  { id: 'zoomIn', i18nKey: 'toolbar.operations.zoomIn', shortcut: '+', codicon: 'zoom-in', operation: 'zoomIn' },
  { id: 'zoomOut', i18nKey: 'toolbar.operations.zoomOut', shortcut: '-', codicon: 'zoom-out', operation: 'zoomOut' },
  { id: 'centerVertical', i18nKey: 'toolbar.operations.centerVertical', codicon: 'symbol-numeric', operation: 'centerVertical' },
  { id: 'centerHorizontal', i18nKey: 'toolbar.operations.centerHorizontal', codicon: 'symbol-numeric', operation: 'centerHorizontal' },
  { id: 'separator4', i18nKey: '' },
  { id: 'polygonToRect', i18nKey: 'toolbar.operations.polygonToRect', codicon: 'symbol-square', operation: 'polygonToRect' },
  { id: 'fitCanvasToContent', i18nKey: 'toolbar.operations.fitCanvasToContent', codicon: 'screen-full', operation: 'fitCanvasToContent' },
  { id: 'copyAsPng', i18nKey: 'toolbar.operations.copyAsPng', codicon: 'clippy', operation: 'copyAsPng' },
  { id: 'toggleBackground', i18nKey: 'toolbar.operations.toggleBackground', codicon: 'color-mode', operation: 'toggleBackground' }
];

export class SvgeditToolbar {
  private container: HTMLElement;
  private currentMode: DrawMode = 'select';
  private onModeChange: (mode: DrawMode) => void;
  private onOperation: (op: Operation) => void;
  private buttons: Map<string, HTMLElement> = new Map();
  private tooltip: HTMLElement | null = null;
  private tooltipTimer: number | null = null;

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

    const drawGroup = this.createButtonGroup(t('toolbar.groups.draw'));
    drawModeButtons.forEach(btn => {
      const button = this.createToolButton(btn, true);
      drawGroup.appendChild(button);
      this.buttons.set(btn.id, button);
    });
    toolbar.appendChild(drawGroup);

    // Separator
    toolbar.appendChild(this.createSeparator());

    // Operation buttons
    const opGroup = this.createButtonGroup(t('toolbar.groups.operations'));
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
    const label = t(btn.i18nKey, btn.shortcut ? { shortcut: btn.shortcut } : undefined);
    button.dataset['id'] = btn.id;
    button.setAttribute('aria-label', label);
    this.attachTooltip(button, label);

    // Use SVG icon if available, otherwise fallback to text
    const iconSvg = getIcon(btn.id);
    if (iconSvg) {
      button.innerHTML = iconSvg;
    } else {
      button.textContent = label;
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

  private attachTooltip(button: HTMLElement, label: string): void {
    button.addEventListener('mouseenter', () => {
      this.tooltipTimer = window.setTimeout(() => {
        this.showTooltip(button, label);
      }, 300);
    });
    button.addEventListener('mouseleave', () => this.hideTooltip());
    button.addEventListener('mousedown', () => this.hideTooltip());
  }

  private showTooltip(anchor: HTMLElement, text: string): void {
    this.hideTooltip();
    const tip = document.createElement('div');
    tip.className = 'graphing-tooltip';
    tip.textContent = text;
    tip.style.cssText = `
      position: fixed;
      z-index: 10000;
      padding: 3px 8px;
      border-radius: 3px;
      font-size: 11px;
      line-height: 1.4;
      white-space: nowrap;
      pointer-events: none;
      background: var(--vscode-editorWidget-background, #252526);
      color: var(--vscode-editorWidget-foreground, #cccccc);
      border: 1px solid var(--vscode-editorWidget-border, #454545);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.36);
    `;
    document.body.appendChild(tip);
    this.tooltip = tip;

    const rect = anchor.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    let top = rect.bottom + 6;
    if (top + tipRect.height > window.innerHeight) {
      top = rect.top - tipRect.height - 6;
    }
    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    left = Math.max(4, Math.min(left, window.innerWidth - tipRect.width - 4));
    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
  }

  private hideTooltip(): void {
    if (this.tooltipTimer !== null) {
      window.clearTimeout(this.tooltipTimer);
      this.tooltipTimer = null;
    }
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
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
