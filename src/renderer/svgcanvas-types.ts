/**
 * Extended type definitions for @svgedit/svgcanvas.
 * Supplements the official types with methods that exist in the implementation
 * but are missing from the type declarations.
 */

import SvgCanvas from '@svgedit/svgcanvas';

/**
 * Extended SvgCanvas interface with additional methods found in implementation
 */
export interface SvgCanvasExtended extends SvgCanvas {
  // Selection methods (exist in implementation but not in types)
  getSelectedElements(): SVGElement[];
  selectedElements: SVGElement[];

  // Additional canvas methods
  addExtension(name: string, extFunc: (canvas: SvgCanvasExtended) => void): void;

  // Layer methods
  getCurrentDrawing(): Drawing;
  getLayer(name: string): SVGGElement | null;
  getCurrentLayerName(): string;
  setCurrentLayer(name: string): boolean;
  renameCurrentLayer(newName: string): boolean;
  setCurrentLayerPosition(newPos: number): boolean;
  setLayerVisibility(name: string, bVisible: boolean): void;
  moveSelectedToLayer(layerName: string): void;
  cloneLayer(name?: string): void;
  deleteCurrentLayer(): boolean;
  getNumLayers(): number;

  // Drawing operations
  cloneSelectedElements(count?: number): void;
  deleteSelectedElements(): void;
  moveUpDownSelected(dir: 'Up' | 'Down'): void;

  // Alignment
  alignSelectedElements(dir: string, relativeTo?: string): void;

  // Path operations
  pathActions: PathActions;

  // History
  undoMgr: UndoManager;
  undo(): void;
  redo(): void;

  // Event system
  bind(event: string, callback: Function): void;
  unbind(event: string, callback: Function): void;
  call(event: string, args?: any[]): void;

  // Utility
  getSvgContent(): SVGSVGElement;
  getSvgRoot(): SVGSVGElement;
  getSvgString(): string;
  setSvgString(xmlString: string, preventUndo?: boolean): boolean;
  clearSelection(noCall?: boolean): void;
  selectOnly(elements: SVGElement[], showGrips?: boolean): void;
  getResolution(): { w: number; h: number; zoom?: number };
  setResolution(w: number | 'fit', h: number): boolean;
  getZoom(): number;
  setZoom(zoomLevel: number): void;
  setCurrentZoom(zoomLevel: number): void;

  // Attribute manipulation
  changeSelectedAttribute(attr: string, val: string | number, elems?: SVGElement[]): void;
  changeSelectedAttributeNoUndo(attr: string, val: string | number, elems?: SVGElement[]): void;

  // Element creation
  addSVGElementsFromJson(data: { element: string; attr: Record<string, string>; curStyles?: boolean; children?: any[] }): SVGElement;

  // Image handling
  embedImage(dataURI: string): Promise<Element>;

  // Properties
  contentW: number;
  contentH: number;
}

/**
 * Drawing interface (layer management)
 */
export interface Drawing {
  getCurrentLayer(): SVGGElement;
  setCurrentLayer(name: string): boolean;
  getLayerByName(name: string): SVGGElement | null;
  getLayerName(layer: SVGGElement): string;
  getLayerNames(): string[];
  getNumLayers(): number;
  hasLayer(name: string): boolean;
  getLayerVisibility(name: string): boolean;
  setLayerVisibility(name: string, visible: boolean): void;
  getLayerOpacity(name: string): number;
  setLayerOpacity(name: string, opacity: number): void;
  getLayerColor(name: string): string;
  setLayerColor(name: string, color: string): void;
  getLayerLocked(name: string): boolean;
  setLayerLocked(name: string, locked: boolean): void;
  renameLayer(oldName: string, newName: string): boolean;
  moveLayer(name: string, pos: number): boolean;
  cloneLayer(name: string): boolean;
  deleteLayer(name: string): boolean;
  mergeLayer(name: string): boolean;
  mergeAllLayers(): boolean;
}

/**
 * Path actions interface
 */
export interface PathActions {
  clear(): void;
  resetOrientation(path: SVGPathElement): boolean;
  zoomChange(): void;
  getNodePoint(): { x: number; y: number };
  linkControlPoints(linkPoints: boolean): void;
  clonePathNode(): void;
  deletePathNode(): void;
  smoothPolylineIntoPath(): void;
  setSegType(type: number): void;
  moveNode(attr: string, newValue: number): void;
  selectNode(node?: Element): void;
  opencloseSubPath(): void;
}

/**
 * Undo manager interface
 */
export interface UndoManager {
  getUndoStackSize(): number;
  getRedoStackSize(): number;
  getNextUndoCommandText(): string;
  getNextRedoCommandText(): string;
  resetUndoStack(): void;
  undo(): void;
  redo(): void;
}

/**
 * Type-safe wrapper around SvgCanvas
 */
export function createSvgCanvasExtended(container: HTMLElement, config?: any): SvgCanvasExtended {
  return new SvgCanvas(container, config) as unknown as SvgCanvasExtended;
}
