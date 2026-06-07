# Graphing — SVG Editor Feature Specification

A comprehensive SVG illustration tool for VS Code. This document enumerates every feature the editor must provide, organized by category. Each feature is tagged with its implementation status.

**Legend:**
- `[done]` — Fully implemented and working
- `[partial]` — Partially implemented, needs completion
- `[planned]` — Not yet implemented, planned for future
- `[via-canvas]` — Available through @svgedit/svgcanvas but not yet wired to toolbar/commands

---

## 1. Drawing Tools

The core shapes and elements an illustrator can create interactively on the canvas.

| Feature | Status | Notes |
|---------|--------|-------|
| Rectangle (drag to create) | `[done]` | Toolbar: R key |
| Ellipse (drag to create) | `[done]` | Toolbar: E key |
| Circle | `[via-canvas]` | Available in canvas mode list, not in toolbar |
| Line (two-point) | `[done]` | Toolbar: L key |
| Polyline (click-to-add points, right-click to finish) | `[done]` | Toolbar: P key |
| Polygon (closed polyline) | `[via-canvas]` | Available in canvas mode list, not in toolbar |
| Path (bezier curves, click/drag segments) | `[done]` | Toolbar: A key |
| Text (click to place, type to edit) | `[done]` | Toolbar: T key |
| Image (embed raster image) | `[done]` | Toolbar: I key, embeds as base64 data URI |
| Freehand draw | `[planned]` | Draw arbitrary paths by dragging |
| Arc tool | `[planned]` | Create elliptical arc segments |
| Spiral tool | `[planned]` | Create spiral paths |
| Star/polygon tool | `[planned]` | Create regular star/polygon shapes with configurable points |
| Rounded rectangle (via corner radius) | `[done]` | `rx`/`ry` attributes on rect |

## 2. Selection and Transformation

How users select, move, resize, and transform elements.

| Feature | Status | Notes |
|---------|--------|-------|
| Single-click select | `[done]` | Toolbar: V key |
| Multi-select (Shift+click) | `[done]` | Add/remove from selection |
| Rubber-band select (drag empty area) | `[done]` | Select all elements within marquee |
| Move selected (drag) | `[done]` | Pixel-precise positioning |
| Resize selected (8 directional handles) | `[done]` | Corner and edge handles |
| Rotate selected (rotation handle) | `[done]` | Handle at top of bounding box |
| Scale proportionally (Shift+resize) | `[partial]` | Available in svgcanvas, may need Shift key binding |
| Rotate in steps (15-degree increments) | `[done]` | `[` / `]` keys, configurable step angle |
| Rotate 90 degrees | `[done]` | `Cmd+[` / `Cmd+]` |
| Flip horizontal | `[via-canvas]` | `flipSelectedElements()` exists, not in toolbar |
| Flip vertical | `[via-canvas]` | `flipSelectedElements()` exists, not in toolbar |
| Object to Path conversion | `[done]` | `Shift+Cmd+C`, converts shapes to editable paths |
| Duplicate with offset | `[done]` | `Cmd+D`, 4% offset clone |
| Clone N copies | `[via-canvas]` | `cloneSelectedElements(count)` |
| Delete selected | `[done]` | Backspace / Delete keys |
| Cut / Copy / Paste | `[done]` | `Cmd+X` / `Cmd+C` / `Cmd+V` |
| Undo | `[via-canvas]` | `undoMgr.undo()` — needs keyboard shortcut |
| Redo | `[via-canvas]` | `undoMgr.redo()` — needs keyboard shortcut |

## 3. Alignment and Distribution

Positioning elements relative to each other or the canvas.

| Feature | Status | Notes |
|---------|--------|-------|
| Align Left | `[done]` | `Ctrl+Alt+Numpad4` |
| Align Right | `[done]` | `Ctrl+Alt+Numpad6` |
| Align Top | `[done]` | `Ctrl+Alt+Numpad8` |
| Align Bottom | `[done]` | `Ctrl+Alt+Numpad2` |
| Center Horizontally | `[done]` | `Ctrl+Alt+T` |
| Center Vertically | `[done]` | `Ctrl+Alt+H` |
| Align to selection bounds | `[via-canvas]` | `alignSelectedElements(dir, 'selection')` |
| Align to canvas | `[done]` | Default behavior of align commands |
| Distribute horizontally (equal spacing) | `[planned]` | Required for illustration layouts |
| Distribute vertically (equal spacing) | `[planned]` | Required for illustration layouts |
| Distribute by key object | `[planned]` | Align to a reference element |

## 4. Z-Order (Stacking)

Controlling which elements appear in front of or behind others.

| Feature | Status | Notes |
|---------|--------|-------|
| Bring Forward (move up one) | `[done]` | PageUp key |
| Send Backward (move down one) | `[done]` | PageDown key |
| Bring to Front | `[via-canvas]` | `moveUpDownSelected('Up')` to top |
| Send to Back | `[via-canvas]` | `moveUpDownSelected('Down')` to bottom |

## 5. Grouping

Organizing elements into logical units.

| Feature | Status | Notes |
|---------|--------|-------|
| Group selected | `[done]` | `Cmd+G`, wraps in `<g>` |
| Ungroup | `[done]` | `Cmd+U`, unwraps and propagates transforms |
| Nested groups | `[done]` | Groups within groups |
| Enter group for editing | `[planned]` | Double-click to edit group contents |
| Exit group | `[planned]` | Return to parent context |
| Push group transforms to children | `[via-canvas]` | `pushGroupProperties()` |

## 6. Path Editing (Node Mode)

Fine-grained control over path vertices and curves.

| Feature | Status | Notes |
|---------|--------|-------|
| Enter node edit mode | `[done]` | Select path, switch to Node tool |
| Move individual path nodes | `[done]` | Drag vertices |
| Move bezier control points | `[done]` | Drag curve handles |
| Add path node | `[via-canvas]` | `clonePathNode()` |
| Delete path node | `[done]` | `deletePathNode()` |
| Change node type (corner ↔ smooth) | `[via-canvas]` | `setSegType(type)` |
| Toggle path open/closed | `[done]` | `opencloseSubPath()` |
| Smooth polyline into curve | `[via-canvas]` | `smoothPolylineIntoPath()` |
| Link/unlink control points | `[via-canvas]` | `linkControlPoints()` |
| Reset path orientation | `[via-canvas]` | `resetOrientation(path)` |
| Convert shape to path | `[done]` | `Shift+Cmd+C` |

## 7. Styling and Appearance

Visual properties applied to elements.

### 7.1 Fill

| Feature | Status | Notes |
|---------|--------|-------|
| Solid color fill | `[done]` | Color picker in style panel |
| No fill (none) | `[done]` | Via paint selector |
| Fill opacity | `[done]` | Range 0–1 |
| Fill rule (nonzero/evenodd) | `[partial]` | Attribute supported, UI control missing |
| currentColor / inherit | `[partial]` | Supported in legacy paint selector |

### 7.2 Stroke

| Feature | Status | Notes |
|---------|--------|-------|
| Stroke color | `[done]` | Color picker in style panel |
| No stroke (none) | `[done]` | Via paint selector |
| Stroke width | `[done]` | Numeric input, 0–100 |
| Stroke opacity | `[done]` | Range 0–1 |
| Stroke linecap (butt/round/square) | `[partial]` | Attribute supported, UI control missing |
| Stroke linejoin (miter/round/bevel) | `[partial]` | Attribute supported, UI control missing |
| Stroke dasharray (dashes) | `[partial]` | Attribute supported, UI control missing |
| Stroke dashoffset | `[partial]` | Attribute supported, UI control missing |

### 7.3 Opacity

| Feature | Status | Notes |
|---------|--------|-------|
| Element opacity | `[done]` | Range 0–1, style panel |
| Layer opacity | `[planned]` | Per-layer opacity control |

### 7.4 Colors

| Feature | Status | Notes |
|---------|--------|-------|
| HSV color picker | `[done]` | Legacy full-featured picker |
| HTML5 color input | `[done]` | SVG Edit style panel |
| Hex color (#RRGGBB) | `[done]` | Input format |
| RGB color (rgb(r,g,b)) | `[done]` | Supported |
| RGBA with alpha | `[partial]` | Via opacity controls |
| Named CSS colors | `[planned]` | e.g., "tomato", "steelblue" |
| Eyedropper / color from canvas | `[planned]` | Pick color from existing element |
| Color schema in outline/symbols | `[planned]` | Show fill/stroke color swatches next to element names in Outline panel for quick visual identification |
| Inline color annotations in editor | `[planned]` | Virtual text decorations showing color swatches next to hex/rgb values in SVG source |

### 7.5 Gradients

| Feature | Status | Notes |
|---------|--------|-------|
| Linear gradient | `[done]` | Create and edit via legacy UI |
| Radial gradient | `[done]` | Create and edit via legacy UI |
| Gradient stops (add/remove/color) | `[done]` | Stop offset slider, per-stop color |
| Gradient on stroke | `[partial]` | Supported via paint selector |
| Gradient transform | `[planned]` | Rotate/scale gradient |
| Multiple gradients per element | `[planned]` | fill + stroke gradients |

### 7.6 Patterns

| Feature | Status | Notes |
|---------|--------|-------|
| Pattern fill | `[planned]` | `<pattern>` element support |
| Pattern on stroke | `[planned]` | Stroke pattern |

## 8. Text

Creating and editing text elements.

| Feature | Status | Notes |
|---------|--------|-------|
| Create text element | `[done]` | Toolbar: T key |
| Edit text content | `[done]` | Double-click to edit |
| Font family | `[done]` | Text input with system fonts |
| Font size | `[done]` | Numeric input, 1–200 |
| Font weight (bold) | `[done]` | Dropdown: normal, bold, 100–900 |
| Font style (italic) | `[done]` | Dropdown: normal, italic, oblique |
| Text anchor (start/middle/end) | `[partial]` | Attribute supported, UI control missing |
| Dominant baseline | `[partial]` | Attribute supported, UI control missing |
| Letter spacing | `[partial]` | Attribute supported, UI control missing |
| Word spacing | `[partial]` | Attribute supported, UI control missing |
| Tspan (style substrings) | `[partial]` | Supported in parser, limited editing |
| Text on path | `[planned]` | `<textPath>` element |
| Text wrapping / area text | `[planned]` | `<foreignObject>` or automatic wrapping |
| System font collection | `[done]` | `fontFileProcedures.ts` collects system fonts |
| Font measurement | `[done]` | `measureFonts.ts` using font-measure library |

## 9. Layers

Organizing the canvas into compositing layers.

| Feature | Status | Notes |
|---------|--------|-------|
| Create layer | `[via-canvas]` | `addLayer()` in draw.js |
| Delete layer | `[via-canvas]` | `deleteCurrentLayer()` |
| Rename layer | `[via-canvas]` | `renameCurrentLayer()` |
| Toggle layer visibility | `[via-canvas]` | `setLayerVisibility()` |
| Move element to layer | `[via-canvas]` | `moveSelectedToLayer()` |
| Reorder layers | `[via-canvas]` | `setCurrentLayerPosition()` |
| Clone layer | `[via-canvas]` | `cloneLayer()` |
| Layer count | `[via-canvas]` | `getNumLayers()` |
| Layer panel UI | `[planned]` | Visual layer list with drag-to-reorder |

## 10. Canvas and Viewport

Controlling the editing workspace.

| Feature | Status | Notes |
|---------|--------|-------|
| Zoom in | `[done]` | `+` key, 1.25x |
| Zoom out | `[done]` | `-` key, 1.25x |
| Zoom to fit (all elements) | `[planned]` | Fit all content in viewport |
| Zoom to selection | `[planned]` | Zoom to selected elements |
| Zoom to 100% (actual size) | `[planned]` | Reset zoom to 1:1 |
| Pan (scroll/drag canvas) | `[done]` | Middle-click or Alt+click drag |
| Canvas resize | `[via-canvas]` | `setResolution(w, h)` |
| Grid overlay | `[done]` | Toggleable grid via extension |
| Grid snapping | `[via-canvas]` | `gridSnapping` option |
| Snap to grid | `[planned]` | Configurable snap step |
| Snap to element | `[planned]` | Snap to edges/centers of other elements |
| Transparent background (checkerboard) | `[planned]` | Visual indicator for transparency |
| Wireframe mode | `[via-canvas]` | Show only outlines, no fills |

## 11. SVG-Specific Features

Advanced SVG capabilities beyond basic drawing.

| Feature | Status | Notes |
|---------|--------|-------|
| `<defs>` management | `[partial]` | Defs parsed, limited editing UI |
| Clip paths | `[planned]` | Create and apply `<clipPath>` |
| Masks | `[planned]` | Create and apply `<mask>` |
| Filters (blur, drop-shadow, etc.) | `[planned]` | `<filter>` element support |
| `<use>` element | `[partial]` | Parsed and rendered, limited creation |
| `<switch>` element | `[planned]` | Conditional rendering |
| `<foreignObject>` | `[planned]` | Embed HTML in SVG |
| SVG animation (`<animate>`, etc.) | `[planned]` | Animation preview and editing |
| `<metadata>` editing | `[planned]` | Document metadata |
| Namespace handling (xlink, etc.) | `[done]` | Proper namespace declarations |
| SVG comments preservation | `[done]` | Comments preserved in round-trip |
| SVG CDATA preservation | `[done]` | CDATA sections preserved |

## 12. File and Document Operations

Working with SVG files.

| Feature | Status | Notes |
|---------|--------|-------|
| Open SVG file | `[done]` | `graphing.openSvgEditor` command |
| New SVG file | `[done]` | `graphing.newSvgEditor` command |
| Bidirectional text/canvas sync | `[done]` | Text editor changes reflect in canvas and vice versa |
| Minimal diff sync | `[done]` | Only changed elements are patched |
| Export as SVG string | `[done]` | `getSvgString()` / `setSvgString()` |
| Export as PNG | `[planned]` | Canvas to blob export |
| Export as JPEG | `[planned]` | Canvas to blob export |
| Export as PDF | `[planned]` | SVG to PDF conversion |
| Import SVG from clipboard | `[done]` | Paste SVG XML into canvas |
| Document properties (viewBox, dimensions) | `[partial]` | Can set via resolution, UI needed |
| Save to file (overwrite) | `[done]` | Via VS Code save |

## 13. Language Intelligence (LSP)

IDE-like features for SVG source code editing.

| Feature | Status | Notes |
|---------|--------|-------|
| Diagnostics (unclosed tags) | `[done]` | Tag matching validation |
| Diagnostics (XML declaration placement) | `[done]` | Warning for misplaced `<?xml>` |
| Completion — SVG elements | `[done]` | After `<`, snippet with closing tag |
| Completion — SVG attributes | `[done]` | Inside tags, all standard attributes |
| Hover — element documentation | `[done]` | Markdown docs for 20+ elements |
| Hover — attribute documentation | `[done]` | Docs for d, transform, viewBox, etc. |
| Document symbols (outline) | `[done]` | Nested element tree in outline panel |
| Formatting / pretty-print | `[planned]` | Auto-indent SVG source |
| Rename symbol | `[planned]` | Rename element ID |
| Go to definition | `[planned]` | Jump to `<defs>` definition |
| Find references | `[planned]` | Find `<use href="#id">` references |
| Code actions (quick fixes) | `[planned]` | Auto-fix common SVG issues |
| Semantic tokens | `[planned]` | Syntax highlighting for attributes, values |

## 14. Keyboard Shortcuts

Complete reference of all keyboard bindings.

### Drawing Tools
| Key | Action |
|-----|--------|
| V | Select tool |
| R | Rectangle tool |
| E | Ellipse tool |
| L | Line tool |
| P | Polyline tool |
| A | Path tool |
| T | Text tool |
| I | Image tool |

### Edit Operations
| Key | Action |
|-----|--------|
| Backspace / Delete | Delete selected |
| Cmd+D | Duplicate |
| Cmd+X | Cut |
| Cmd+C | Copy |
| Cmd+V | Paste |
| Cmd+Z | Undo (planned) |
| Cmd+Shift+Z | Redo (planned) |

### Transform
| Key | Action |
|-----|--------|
| Cmd+G | Group |
| Cmd+U | Ungroup |
| Shift+Cmd+C | Object to Path |
| PageUp | Bring Forward |
| PageDown | Send Backward |
| ] | Rotate CW by step |
| [ | Rotate CCW by step |
| Cmd+] | Rotate CW 90deg |
| Cmd+[ | Rotate CCW 90deg |

### Alignment
| Key | Action |
|-----|--------|
| Ctrl+Alt+Numpad4 | Align Left |
| Ctrl+Alt+Numpad6 | Align Right |
| Ctrl+Alt+Numpad8 | Align Top |
| Ctrl+Alt+Numpad2 | Align Bottom |
| Cmd+Alt+T | Center Horizontal |
| Cmd+Alt+H | Center Vertical |

### View
| Key | Action |
|-----|--------|
| + | Zoom In |
| - | Zoom Out |
| Cmd+0 | Zoom to Fit (planned) |
| Cmd+1 | Zoom to 100% (planned) |

### Other
| Key | Action |
|-----|--------|
| F8 | Font dialog |
| Escape | Deselect / cancel operation |

## 15. VS Code Integration

How the extension integrates with the VS Code environment.

| Feature | Status | Notes |
|---------|--------|-------|
| SVG language registration | `[done]` | `.svg` files recognized as `svg` language |
| Language configuration | `[done]` | Bracket matching, folding, indentation |
| Editor title bar icon | `[done]` | Pen icon for opening SVG editor |
| Command palette commands | `[done]` | All 4 commands registered |
| Webview panel (beside editor) | `[done]` | Side-by-side text + visual editing |
| Theme adaptation | `[done]` | Uses `--vscode-*` CSS variables |
| Bidirectional sync | `[done]` | Text ↔ canvas with minimal diffs |
| Output channel for diagnostics | `[done]` | "SVG LSP Server & Editor" channel |
| Configuration settings | `[done]` | 10 configurable options |
| Keyboard shortcuts | `[done]` | 20+ bindings with webview focus guard |
| LSP server lifecycle | `[done]` | Auto-start + restart command |
| Document outline | `[done]` | Nested element tree |

## 16. Missing Critical Features for Illustration

Features commonly expected in SVG illustration tools that are not yet implemented.

| Feature | Priority | Notes |
|---------|----------|-------|
| Undo / Redo keyboard shortcuts | Critical | `Cmd+Z` / `Cmd+Shift+Z` — svgcanvas has undoMgr |
| Flip horizontal/vertical | High | svgcanvas has `flipSelectedElements()` |
| Bring to Front / Send to Back | High | svgcanvas has `moveUpDownSelected()` |
| Stroke style controls (dash, linecap, linejoin) | High | Attributes exist, UI controls missing |
| Zoom to fit / zoom to selection | High | Standard illustration UX |
| Eyedropper tool | Medium | Pick color from existing elements |
| Distribute (equal spacing) | Medium | Essential for layout |
| Layer panel UI | Medium | Visual layer management |
| Clip path / mask creation | Medium | Advanced SVG features |
| Export as PNG/JPEG | Medium | Common output format |
| Snap to grid / snap to elements | Medium | Precision drawing |
| Freehand draw tool | Low | Path creation by dragging |
| Star / polygon tool | Low | Preset shape creation |

---

## Configuration Options

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `graphing.filenameExtension` | string | `svg` | Extension for new untitled files |
| `graphing.width` | string | `400px` | Default canvas width |
| `graphing.height` | string | `400px` | Default canvas height |
| `graphing.defaultUnit` | string\|null | `null` | Unit for shape creation (px, em, %, etc.) |
| `graphing.decimalPlaces` | number | `1` | Decimal precision for coordinates |
| `graphing.collectTransformMatrix` | boolean | `true` | Merge transforms into matrix |
| `graphing.additionalResourcePaths` | string[] | `[]` | Extra resource directories |
| `graphing.useStyleAttribute` | boolean | `false` | Use `style=""` instead of presentation attrs |
| `graphing.indentStyle` | string | `space` | Indent with tabs or spaces |
| `graphing.indentSize` | number | `4` | Number of spaces per indent |
