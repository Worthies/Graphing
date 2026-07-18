/**
 * English (source-of-truth) webview UI strings.
 * Every locale file must satisfy this exact shape; `Messages` enforces it at compile time.
 * `{{shortcut}}` is interpolated with the keyboard hint (e.g. 'V', 'Ctrl+Z').
 */
export interface Messages {
  toolbar: {
    modes: {
      select: string; rect: string; ellipse: string; line: string;
      polyline: string; path: string; text: string; image: string;
    };
    operations: {
      undo: string; redo: string; reload: string;
      delete: string; duplicate: string; group: string; ungroup: string;
      bringForward: string; sendBackward: string;
      alignLeft: string; alignRight: string; alignTop: string; alignBottom: string;
      rotateClockwise: string; rotateCounterclockwise: string;
      zoomIn: string; zoomOut: string;
      centerVertical: string; centerHorizontal: string;
      polygonToRect: string; fitCanvasToContent: string;
      copyAsPng: string; toggleBackground: string;
    };
    groups: { draw: string; operations: string };
  };
  stylePanel: {
    sections: {
      canvas: string; viewBox: string; element: string; positionSize: string;
      content: string; style: string; font: string; transform: string; opacity: string;
    };
    fields: {
      id: string; tag: string;
      x: string; y: string; width: string; height: string;
      cx: string; cy: string; r: string; rx: string; ry: string;
      x1: string; y1: string; x2: string; y2: string;
      minX: string; minY: string;
      points: string; path: string; text: string;
      fill: string; fillOpacity: string;
      stroke: string; strokeWidth: string; strokeOpacity: string;
      family: string; size: string; weight: string; fontStyle: string;
      transform: string; opacity: string;
    };
    noText: string;
  };
  errors: {
    webviewError: string; svgParseError: string;
    svgLoadFailed: string; svgRenderError: string;
    unknownWebviewError: string; unhandledRejection: string; svgcanvasRejected: string;
  };
}

const en: Messages = {
  toolbar: {
    modes: {
      select: 'Select ({{shortcut}})',
      rect: 'Rectangle ({{shortcut}})',
      ellipse: 'Ellipse ({{shortcut}})',
      line: 'Line ({{shortcut}})',
      polyline: 'Polyline ({{shortcut}})',
      path: 'Path ({{shortcut}})',
      text: 'Text ({{shortcut}})',
      image: 'Image ({{shortcut}})'
    },
    operations: {
      undo: 'Undo ({{shortcut}})',
      redo: 'Redo ({{shortcut}})',
      reload: 'Reload SVG from text editor',
      delete: 'Delete',
      duplicate: 'Duplicate ({{shortcut}})',
      group: 'Group ({{shortcut}})',
      ungroup: 'Ungroup ({{shortcut}})',
      bringForward: 'Bring Forward ({{shortcut}})',
      sendBackward: 'Send Backward ({{shortcut}})',
      alignLeft: 'Align Left',
      alignRight: 'Align Right',
      alignTop: 'Align Top',
      alignBottom: 'Align Bottom',
      rotateClockwise: 'Rotate Clockwise ({{shortcut}})',
      rotateCounterclockwise: 'Rotate Counterclockwise ({{shortcut}})',
      zoomIn: 'Zoom In ({{shortcut}})',
      zoomOut: 'Zoom Out ({{shortcut}})',
      centerVertical: 'Center Vertical',
      centerHorizontal: 'Center Horizontal',
      polygonToRect: 'Convert Polygon to Rectangle',
      fitCanvasToContent: 'Fit Canvas to Content',
      copyAsPng: 'Copy as PNG to Clipboard',
      toggleBackground: 'Toggle Background Color'
    },
    groups: { draw: 'Draw', operations: 'Operations' }
  },
  stylePanel: {
    sections: {
      canvas: 'Canvas',
      viewBox: 'ViewBox',
      element: 'Element',
      positionSize: 'Position & Size',
      content: 'Content',
      style: 'Style',
      font: 'Font',
      transform: 'Transform',
      opacity: 'Opacity'
    },
    fields: {
      id: 'ID', tag: 'Tag',
      x: 'X', y: 'Y', width: 'Width', height: 'Height',
      cx: 'CX', cy: 'CY', r: 'R', rx: 'RX', ry: 'RY',
      x1: 'X1', y1: 'Y1', x2: 'X2', y2: 'Y2',
      minX: 'Min X', minY: 'Min Y',
      points: 'Points', path: 'Path', text: 'Text',
      fill: 'Fill', fillOpacity: 'Fill Opacity',
      stroke: 'Stroke', strokeWidth: 'Stroke Width', strokeOpacity: 'Stroke Opacity',
      family: 'Family', size: 'Size', weight: 'Weight', fontStyle: 'Style',
      transform: 'Transform', opacity: 'Opacity'
    },
    noText: '(no text)'
  },
  errors: {
    webviewError: 'SVG editor error: {{detail}}',
    svgParseError: 'SVG parse error: {{detail}}',
    svgLoadFailed: 'SVG could not be loaded: {{reason}}',
    svgRenderError: 'SVG render error: {{detail}}',
    unknownWebviewError: 'Unknown webview error',
    unhandledRejection: 'Unhandled promise rejection',
    svgcanvasRejected: 'svgcanvas rejected the SVG'
  }
};

export default en;
