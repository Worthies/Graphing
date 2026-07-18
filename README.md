# Graphing

[![Open VSX Registry](https://img.shields.io/open-vsx/v/cloorc/graphing?label=Open%20VSX)](https://open-vsx.org/extension/cloorc/graphing)
![license](https://badgen.net/badge/license/MIT/green)

![sample](images/capture.png)

A powerful visual & literal SVG editor for VS Code, powered by SVG Edit.

Create and edit SVG files using the built-in code editor or the visual drawing tools. Supports shapes, paths, text, gradients, layers, grouping, alignment, and more.

## Features

- **Drawing tools**: Rectangle, Ellipse, Line, Polyline, Path, Text, Image
- **Selection & transformation**: Select, move, resize, rotate elements
- **Layer operations**: Bring forward, send backward
- **Grouping**: Group and ungroup elements
- **Alignment**: Align left, right, top, bottom; center vertically and horizontally
- **Styling**: Fill, stroke, opacity, font controls via the style panel
- **Zoom**: Zoom in/out with keyboard shortcuts
- **Bidirectional sync**: Edits in the visual editor sync to the text editor with minimal diffs
- **VS Code theming**: Adapts to your VS Code light/dark theme

## Commands

| Command | Title |
|:---|:---|
| graphing.openSvgEditor | Open SVG Editor |
| graphing.newSvgEditor | New File with SVG Editor |
| graphing.reopenRelatedTextEditor | Reopen Text Editor Related to Current SVG Editor |

## Configuration

| Name | Description | Default |
|:---|:---|:---|
| graphing.filenameExtension | Initial filename extension of new untitled file. | svg |
| graphing.width | Initial width of new untitled file. | 400px |
| graphing.height | Initial height of new untitled file. | 400px |
| graphing.defaultUnit | Specifies the unit when creating some shapes. | null |
| graphing.decimalPlaces | The number of decimal places. | 1 |
| graphing.collectTransformMatrix | Collect two or more transform functions into a matrix. | true |
| graphing.additionalResourcePaths | Additional resource directory paths Graphing can access. | |
| graphing.useStyleAttribute | Use style attribute instead of presentation attribute. | false |
| graphing.indentStyle | Indent style for auto-formatting. | space |
| graphing.indentSize | Indent size of spaces for auto-formatting. | 4 |

## Keybindings

| Operation | Key |
|:---|:---|
| Delete | Backspace / Delete |
| Duplicate | Ctrl+D |
| Zoom In | + |
| Zoom Out | - |
| Group | Ctrl+G |
| Ungroup | Ctrl+U |
| Bring Forward | PageUp |
| Send Backward | PageDown |
| Align Left | Ctrl+Alt+Numpad4 |
| Align Right | Ctrl+Alt+Numpad6 |
| Align Bottom | Ctrl+Alt+Numpad2 |
| Align Top | Ctrl+Alt+Numpad8 |
| Object to Path | Shift+Ctrl+C |
| Rotate Clockwise | Ctrl+] |
| Rotate Counterclockwise | Ctrl+[ |
| Rotate CW by Step | ] |
| Rotate CCW by Step | [ |
| Center Vertical | Ctrl+Alt+H |
| Center Horizontal | Ctrl+Alt+T |

## Supported SVG Elements

- `svg`, `g`, `defs`, `circle`, `rect`, `ellipse`, `line`, `polyline`, `polygon`, `path`, `text`, `image`, `use`, `linearGradient`, `radialGradient`, `stop`, `style`, `script`

## Notice

### Image References

Location `(xlink:)href` refers to is restricted with your workspace, extension and `graphing.additionalResourcePaths` directories due to `vscode-resource` scheme settings.

## License

MIT
