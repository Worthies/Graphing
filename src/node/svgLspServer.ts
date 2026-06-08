import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    InitializeResult,
    TextDocumentSyncKind,
    Diagnostic,
    DiagnosticSeverity,
    Range,
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
    TextDocumentPositionParams,
    Hover,
    MarkupContent,
    MarkupKind,
    DocumentSymbol,
    SymbolKind,
    DocumentSymbolParams,
    DocumentFormattingParams,
    TextEdit,
    DocumentColorParams,
    ColorInformation,
    ColorPresentationParams,
    ColorPresentation,
    SemanticTokensParams,
    SemanticTokens
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { textToXml, XmlElement, XmlNode, XmlNodeNop } from "../isomorphism/xmlParser";
import { serializeXmls, LinearOptions } from "../isomorphism/xmlSerializer";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

// Server configuration from initializationOptions
let serverConfig = {
    indentStyle: "space" as string,
    indentSize: 4 as number
};

connection.console.log("SVG LSP Server starting...");
connection.console.info("SVG LSP Server initializing...");

connection.onInitialize(function (params: InitializeParams): InitializeResult {
    connection.console.log("SVG LSP Server onInitialize called");

    // Read initializationOptions from client
    if (params.initializationOptions) {
        var opts = params.initializationOptions;
        if (opts.indentStyle !== undefined) serverConfig.indentStyle = opts.indentStyle;
        if (opts.indentSize !== undefined) serverConfig.indentSize = opts.indentSize;
    }

    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Full,
            completionProvider: { triggerCharacters: ["<", " ", '"'] },
            hoverProvider: true,
            documentSymbolProvider: true,
            documentFormattingProvider: true,
            colorProvider: true,
            semanticTokensProvider: {
                legend: {
                    tokenTypes: [
                        "namespace", "type", "class", "enum", "interface",
                        "struct", "typeParameter", "parameter", "variable",
                        "property", "enumMember", "event", "function", "method",
                        "macro", "keyword", "modifier", "comment", "string",
                        "number", "regexp", "operator", "decorator"
                    ],
                    tokenModifiers: [
                        "declaration", "definition", "readonly", "static",
                        "deprecated", "abstract", "async", "modification",
                        "documentation", "defaultLibrary"
                    ]
                },
                full: true,
                range: true
            }
        }
    };
});

// --- Diagnostics: well-formedness checks ---
function validateSvg(text: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Check for XML declaration placement
    const xmlDeclIndex = text.indexOf("<?xml");
    if (xmlDeclIndex > 0) {
        diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: errorRange(text, xmlDeclIndex),
            message: "XML declaration must be at the start of the document"
        });
    }

    // Check for unclosed tags (simple heuristic)
    const tagStack: { tag: string; pos: number }[] = [];
    const tagRegex = /<\/?([a-zA-Z][\w:-]*)[^>]*\/?>/g;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(text)) !== null) {
        const fullTag = match[0];
        const tagName = match[1];
        const isClosing = fullTag.charAt(1) === "/";
        const isSelfClosing = fullTag.charAt(fullTag.length - 2) === "/";

        if (isClosing) {
            if (tagStack.length > 0 && tagStack[tagStack.length - 1].tag === tagName) {
                tagStack.pop();
            } else if (tagStack.length === 0) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: errorRange(text, match.index),
                    message: "Unexpected closing tag </" + tagName + ">"
                });
            } else {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: errorRange(text, match.index),
                    message: "Mismatched closing tag: expected </" + tagStack[tagStack.length - 1].tag + ">, found </" + tagName + ">"
                });
            }
        } else if (!isSelfClosing) {
            tagStack.push({ tag: tagName, pos: match.index });
        }
    }

    for (let i = 0; i < tagStack.length; i++) {
        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: errorRange(text, tagStack[i].pos),
            message: "Unclosed tag <" + tagStack[i].tag + ">"
        });
    }

    return diagnostics;
}

function errorRange(text: string, pos: number): Range {
    const lines = text.slice(0, pos).split(/\r?\n/);
    const line = lines.length - 1;
    const column = lines[line].length;
    return Range.create(line, column, line, column + 10);
}

documents.onDidChangeContent(function (change: { document: TextDocument }) {
    const diagnostics = validateSvg(change.document.getText());
    connection.sendDiagnostics({ uri: change.document.uri, diagnostics: diagnostics });
});

// --- Completion: SVG elements and attributes ---
const svgElements = [
    "svg", "g", "defs", "clipPath", "mask", "pattern",
    "rect", "circle", "ellipse", "line", "polyline", "polygon", "path",
    "text", "tspan", "textPath",
    "image", "use", "switch",
    "linearGradient", "radialGradient", "stop",
    "filter", "feBlend", "feColorMatrix", "feComponentTransfer",
    "feComposite", "feConvolveMatrix", "feDiffuseLighting",
    "feDisplacementMap", "feFlood", "feGaussianBlur", "feImage",
    "feMerge", "feMergeNode", "feMorphology", "feOffset",
    "feSpecularLighting", "feTile", "feTurbulence",
    "animate", "animateTransform", "set",
    "metadata", "title", "desc", "style", "script",
    "foreignObject"
];

const svgAttributes = [
    "id", "class", "style", "transform", "fill", "stroke", "stroke-width",
    "opacity", "visibility", "display", "fill-opacity", "stroke-opacity",
    "stroke-dasharray", "stroke-linecap", "stroke-linejoin",
    "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry",
    "width", "height", "viewBox", "preserveAspectRatio",
    "d", "points", "pathLength",
    "font-family", "font-size", "font-weight", "font-style",
    "text-anchor", "dominant-baseline", "letter-spacing", "word-spacing",
    "href", "xlink:href",
    "clip-path", "mask", "filter",
    "gradientUnits", "gradientTransform", "spreadMethod",
    "fx", "fy",
    "offset", "stop-color", "stop-opacity",
    "patternUnits", "patternTransform",
    "markerWidth", "markerHeight", "refX", "refY", "orient", "markerUnits",
    "in", "in2", "result", "operator",
    "type", "tableValues", "slope", "intercept", "amplitude", "exponent", "seed",
    "baseFrequency", "numOctaves", "stitchTiles",
    "stdDeviation", "edgeMode", "kernelMatrix",
    "targetX", "targetY", "divisor", "bias",
    "diffuseConstant", "specularConstant", "specularExponent",
    "surfaceScale", "pointsAtX", "pointsAtY", "pointsAtZ",
    "kernelUnitLength", "preserveAlpha",
    "mode", "k1", "k2", "k3", "k4",
    "order", "values", "attributeName", "attributeType",
    "from", "to", "dur", "repeatCount", "begin", "end"
];

connection.onCompletion(function (params: TextDocumentPositionParams): CompletionItem[] {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const text = document.getText();
    const offset = document.offsetAt(params.position);
    const textBefore = text.slice(0, offset);

    // Inside a tag: suggest attributes
    const lastOpenAngle = textBefore.lastIndexOf("<");
    const lastSpace = textBefore.lastIndexOf(" ");
    const lastEquals = textBefore.lastIndexOf("=");

    if (lastOpenAngle !== -1 && lastSpace > lastOpenAngle && lastEquals < lastSpace) {
        return svgAttributes.map(function (attr) {
            return {
                label: attr,
                kind: CompletionItemKind.Property,
                detail: "SVG attribute"
            };
        });
    }

    // After "<": suggest elements
    if (lastOpenAngle !== -1 && lastOpenAngle === offset - 1) {
        return svgElements.map(function (elem) {
            return {
                label: elem,
                kind: CompletionItemKind.Module,
                detail: "SVG element",
                insertText: elem + "$0</" + elem + ">",
                insertTextFormat: InsertTextFormat.Snippet
            };
        });
    }

    return [];
});

// --- Hover: SVG element and attribute documentation ---
const svgDocs: { [key: string]: string } = {
    "svg": "The `<svg>` element is a container for SVG graphics. It defines the coordinate system, viewport, and can contain nested SVG elements.",
    "g": "The `<g>` element groups SVG elements together. Transforms and styles applied to a group affect all children.",
    "rect": "The `<rect>` element draws a rectangle. Attributes: `x`, `y`, `width`, `height`, `rx`, `ry` for rounded corners.",
    "circle": "The `<circle>` element draws a circle. Attributes: `cx`, `cy` (center), `r` (radius).",
    "ellipse": "The `<ellipse>` element draws an ellipse. Attributes: `cx`, `cy` (center), `rx`, `ry` (radii).",
    "line": "The `<line>` element draws a straight line. Attributes: `x1`, `y1` (start), `x2`, `y2` (end).",
    "polyline": "The `<polyline>` element draws connected line segments. The `points` attribute defines the vertices.",
    "polygon": "The `<polygon>` element draws a closed shape. The `points` attribute defines the vertices.",
    "path": "The `<path>` element draws complex shapes using path data. The `d` attribute contains move, line, curve, and arc commands.",
    "text": "The `<text>` element renders text. Children `<tspan>` elements can style substrings.",
    "image": "The `<image>` element embeds raster images. The `href` attribute specifies the image URL.",
    "use": "The `<use>` element clones and references existing SVG elements. The `href` attribute points to the element to clone.",
    "linearGradient": "The `<linearGradient>` element defines a linear gradient. Use `<stop>` children to define color stops.",
    "radialGradient": "The `<radialGradient>` element defines a radial gradient. Use `<stop>` children to define color stops.",
    "defs": "The `<defs>` element stores reusable SVG elements (gradients, patterns, clip paths) that are not rendered directly.",
    "clipPath": "The `<clipPath>` element defines a clipping region. Only parts of child elements inside the clip path are visible.",
    "mask": "The `<mask>` element defines a mask. The luminance of mask children determines visibility of the masked content.",
    "filter": "The `<filter>` element defines graphical filter effects. Contains filter primitives like blur, merge, color matrix.",
    "style": "The `<style>` element contains CSS styles for SVG elements.",
    "title": "The `<title>` element provides an accessible name for the SVG document or element.",
    "desc": "The `<desc>` element provides an accessible description for the SVG document or element.",
    "d": "Path data attribute. Commands: M (move), L (line), H (horizontal), V (vertical), C (cubic bezier), S (smooth cubic), Q (quadratic), T (smooth quadratic), A (arc), Z (close).",
    "transform": "Transform attribute. Functions: translate(tx,ty), scale(sx,sy), rotate(angle,cx,cy), skewX(angle), skewY(angle), matrix(a,b,c,d,e,f).",
    "viewBox": "Defines the coordinate system. Format: `min-x min-y width height`. Allows scaling the SVG to fit different viewport sizes.",
    "preserveAspectRatio": "Controls how the SVG content scales when the viewport aspect ratio differs from the viewBox."
};

connection.onHover(function (params: TextDocumentPositionParams): Hover | null {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const text = document.getText();
    const offset = document.offsetAt(params.position);

    const wordRange = getWordRange(text, offset);
    if (!wordRange) return null;

    const word = text.slice(
        document.offsetAt(wordRange.start),
        document.offsetAt(wordRange.end)
    );

    const doc = svgDocs[word];
    if (!doc) return null;

    const isElement = svgElements.indexOf(word) !== -1;
    const label = isElement ? "<" + word + ">" : word;
    const content: MarkupContent = {
        kind: MarkupKind.Markdown,
        value: "**`" + label + "`**\n\n" + doc
    };

    return { contents: content, range: wordRange };
});

function getWordRange(text: string, offset: number): Range | null {
    if (offset >= text.length) return null;

    let start = offset;
    while (start > 0 && /[\w-]/.test(text.charAt(start - 1))) start--;

    let end = offset;
    while (end < text.length && /[\w-]/.test(text.charAt(end))) end++;

    if (start === end) return null;

    const startLines = text.slice(0, start).split(/\r?\n/);
    const startLine = startLines.length - 1;
    const startCol = startLines[startLine].length;

    const endLines = text.slice(0, end).split(/\r?\n/);
    const endLine = endLines.length - 1;
    const endCol = endLines[endLine].length;

    return Range.create(startLine, startCol, endLine, endCol);
}

// --- Document Symbol: provide outline for SVG elements using textToXml parser ---
connection.onDocumentSymbol(function (params: DocumentSymbolParams): DocumentSymbol[] {
    var doc = documents.get(params.textDocument.uri);
    if (!doc) return [];

    var text = doc.getText();
    var xml = textToXml(text);
    if (!xml) return [];

    function toSymbol(elem: XmlElement): DocumentSymbol | null {
        var pos = elem.positions;
        if (!pos) return null;
        var interval: { start: number; end: number } = pos.interval;
        var startTag: { start: number; end: number } = pos.startTag;
        if (!interval || !startTag) return null;

        // Build name: tagName or tagName#id
        var id = elem.attrs.id;
        var name = id ? elem.tag + "#" + id : elem.tag;

        var kind: SymbolKind = SymbolKind.Field;
        if (elem.tag === "g") kind = SymbolKind.Namespace;
        else if (elem.tag === "defs") kind = SymbolKind.Module;
        else if (elem.tag === "text" || elem.tag === "tspan") kind = SymbolKind.String;
        else if (elem.tag === "linearGradient" || elem.tag === "radialGradient" || elem.tag === "stop") kind = SymbolKind.Enum;
        else if (elem.tag === "style" || elem.tag === "script") kind = SymbolKind.Object;
        else if (elem.tag === "title" || elem.tag === "desc") kind = SymbolKind.Property;

        // Recursively build child symbols (only element nodes)
        var childSymbols: DocumentSymbol[] = [];
        for (var i = 0; i < elem.children.length; i++) {
            var child = elem.children[i];
            if (child.type === "element") {
                var childSym = toSymbol(child as XmlElement);
                if (childSym) childSymbols.push(childSym);
            }
        }

        var iv: any = interval;
        var st: any = startTag;
        var symbol: DocumentSymbol = {
            name: name,
            kind: kind,
            range: Range.create(
                doc!.positionAt(iv.start),
                doc!.positionAt(iv.end)
            ),
            selectionRange: Range.create(
                doc!.positionAt(st.start),
                doc!.positionAt(st.end)
            )
        };

        if (childSymbols.length > 0) {
            symbol.children = childSymbols;
        }

        return symbol;
    }

    // Build symbols from root element's children
    var symbols: DocumentSymbol[] = [];
    for (var i = 0; i < xml.children.length; i++) {
        var child = xml.children[i];
        if (child.type === "element") {
            var sym = toSymbol(child as XmlElement);
            if (sym) symbols.push(sym);
        }
    }
    return symbols;
});

// --- Document Formatting: pretty-print SVG source ---

// Strip whitespace-only text nodes and trim leading/trailing whitespace from text content
function stripWhitespaceNodes(nodes: XmlNode[]): XmlNode[] {
    var result: XmlNode[] = [];
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.type === "text") {
            // Skip text nodes that are only whitespace
            if (node.text.trim().length === 0) continue;
            // Trim leading/trailing whitespace from text content
            var trimmed = node.text.trim();
            var trimmedNode: any = { type: "text", tag: "text()", text: trimmed };
            if (node.interval) {
                trimmedNode.interval = node.interval;
            }
            result.push(trimmedNode);
        } else if (node.type === "element") {
            // Recursively clean children
            var elem = node as XmlElement;
            elem.children = stripWhitespaceNodes(elem.children);
            result.push(elem);
        } else {
            result.push(node);
        }
    }
    return result;
}

connection.onDocumentFormatting(function (params: DocumentFormattingParams): TextEdit[] {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const text = document.getText();
    const xml = textToXml(text);
    if (xml === null) return [];

    // Strip whitespace-only text nodes to prevent double newlines
    xml.children = stripWhitespaceNodes(xml.children);

    // Use document formatting options if provided, otherwise fall back to server config
    var indentUnit: string;
    if (params.options) {
        indentUnit = params.options.insertSpaces
            ? " ".repeat(params.options.tabSize)
            : "\t";
    } else {
        indentUnit = serverConfig.indentStyle === "tab"
            ? "\t"
            : " ".repeat(serverConfig.indentSize);
    }

    // Detect EOL style from document
    var eol: "\n" | "\r\n" = text.indexOf("\r\n") !== -1 ? "\r\n" : "\n";

    var formatted = serializeXmls([xml], { indent: { unit: indentUnit, level: 0, eol: eol } });

    // Ensure file ends with newline
    if (!formatted.endsWith(eol)) {
        formatted = formatted + eol;
    }

    // Replace entire document
    var lastLine = document.lineCount - 1;
    var lastCol = text.length - text.lastIndexOf("\n") - 1;
    return [{
        range: Range.create(0, 0, lastLine, lastCol),
        newText: formatted
    }];
});

// --- Document Color: provide inline color swatches ---

// SVG attributes that accept color values
var colorAttributes = [
    "fill", "stroke", "stop-color", "flood-color", "lighting-color",
    "color", "background-color"
];

// Parse hex color string to RGBA (0-1 range)
function parseHexColor(hex: string): { r: number; g: number; b: number; a: number } | null {
    hex = hex.replace(/^#/, "");
    var r: number, g: number, b: number, a: number;

    if (hex.length === 3) {
        r = parseInt(hex.charAt(0) + hex.charAt(0), 16) / 255;
        g = parseInt(hex.charAt(1) + hex.charAt(1), 16) / 255;
        b = parseInt(hex.charAt(2) + hex.charAt(2), 16) / 255;
        a = 1;
    } else if (hex.length === 4) {
        r = parseInt(hex.charAt(0) + hex.charAt(0), 16) / 255;
        g = parseInt(hex.charAt(1) + hex.charAt(1), 16) / 255;
        b = parseInt(hex.charAt(2) + hex.charAt(2), 16) / 255;
        a = parseInt(hex.charAt(3) + hex.charAt(3), 16) / 255;
    } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16) / 255;
        g = parseInt(hex.substring(2, 4), 16) / 255;
        b = parseInt(hex.substring(4, 6), 16) / 255;
        a = 1;
    } else if (hex.length === 8) {
        r = parseInt(hex.substring(0, 2), 16) / 255;
        g = parseInt(hex.substring(2, 4), 16) / 255;
        b = parseInt(hex.substring(4, 6), 16) / 255;
        a = parseInt(hex.substring(6, 8), 16) / 255;
    } else {
        return null;
    }

    return { r: r, g: g, b: b, a: a };
}

// Parse rgb/rgba color string to RGBA (0-1 range)
function parseRgbColor(value: string): { r: number; g: number; b: number; a: number } | null {
    var match = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
    if (!match) return null;

    var r = parseInt(match[1]) / 255;
    var g = parseInt(match[2]) / 255;
    var b = parseInt(match[3]) / 255;
    var a = match[4] !== undefined ? parseFloat(match[4]) : 1;

    return { r: r, g: g, b: b, a: a };
}

// Parse any color string to RGBA
function parseColor(value: string): { r: number; g: number; b: number; a: number } | null {
    value = value.trim();
    if (value.charAt(0) === "#") {
        return parseHexColor(value);
    }
    if (value.indexOf("rgb") === 0) {
        return parseRgbColor(value);
    }
    return null;
}

connection.onDocumentColor(function (params: DocumentColorParams): ColorInformation[] {
    var doc = documents.get(params.textDocument.uri);
    if (!doc) return [];

    var text = doc.getText();
    var colors: ColorInformation[] = [];

    // Regex to find color attribute values in SVG
    // Matches: fill="#ff0000", stroke="rgb(255,0,0)", stop-color="#abc", etc.
    var attrPattern = /\b(fill|stroke|stop-color|flood-color|lighting-color|color)\s*=\s*"([^"]*)"/gi;
    var attrMatch: RegExpExecArray | null;

    while ((attrMatch = attrPattern.exec(text)) !== null) {
        var attrName = attrMatch[1];
        var attrValue = attrMatch[2];

        // Skip "none", "currentColor", "inherit", url() references
        if (attrValue === "none" || attrValue === "currentColor" || attrValue === "inherit" ||
            attrValue.indexOf("url(") !== -1) {
            continue;
        }

        var parsedColor = parseColor(attrValue);
        if (!parsedColor) continue;

        // Calculate the range of the color value (excluding quotes)
        var valueStart = attrMatch.index + attrMatch[0].indexOf(attrValue);

        var startLines = text.slice(0, valueStart).split(/\r?\n/);
        var startLine = startLines.length - 1;
        var startCol = startLines[startLine].length;

        var endPos = valueStart + attrValue.length;
        var endLines = text.slice(0, endPos).split(/\r?\n/);
        var endLine = endLines.length - 1;
        var endCol = endLines[endLine].length;

        colors.push({
            range: Range.create(startLine, startCol, endLine, endCol),
            color: { red: parsedColor.r, green: parsedColor.g, blue: parsedColor.b, alpha: parsedColor.a }
        });
    }

    return colors;
});

connection.onColorPresentation(function (params: ColorPresentationParams): ColorPresentation[] {
    var color = params.color;
    var r = Math.round(color.red * 255);
    var g = Math.round(color.green * 255);
    var b = Math.round(color.blue * 255);
    var a = color.alpha;

    var presentations: ColorPresentation[] = [];

    // Hex format (#RRGGBB or #RRGGBBAA if alpha < 1)
    if (a < 1) {
        var aHex = Math.round(a * 255).toString(16);
        if (aHex.length < 2) aHex = "0" + aHex;
        presentations.push({
            label: "#" + toHex(r) + toHex(g) + toHex(b) + aHex
        });
    }
    presentations.push({
        label: "#" + toHex(r) + toHex(g) + toHex(b)
    });

    // RGB/RGBA format
    if (a < 1) {
        presentations.push({
            label: "rgba(" + r + ", " + g + ", " + b + ", " + a.toFixed(2) + ")"
        });
    }
    presentations.push({
        label: "rgb(" + r + ", " + g + ", " + b + ")"
    });

    return presentations;
});

function toHex(n: number): string {
    var hex = n.toString(16);
    return hex.length < 2 ? "0" + hex : hex;
}

// --- Semantic Tokens: provide syntax highlighting for SVG ---

// Token types (must match legend order)
var TOKEN_TYPE_NAMESPACE = 0;
var TOKEN_TYPE_TYPE = 1;
var TOKEN_TYPE_PROPERTY = 9;
var TOKEN_TYPE_STRING = 18;
var TOKEN_TYPE_NUMBER = 19;
var TOKEN_TYPE_COMMENT = 17;
var TOKEN_TYPE_DECORATOR = 22;

// SVG element names (treated as types/namespaces)
var svgElementNames = [
    "svg", "g", "defs", "clipPath", "mask", "pattern",
    "rect", "circle", "ellipse", "line", "polyline", "polygon", "path",
    "text", "tspan", "textPath", "image", "use", "switch",
    "linearGradient", "radialGradient", "stop",
    "filter", "feBlend", "feColorMatrix", "feComponentTransfer",
    "feComposite", "feConvolveMatrix", "feDiffuseLighting",
    "feDisplacementMap", "feFlood", "feGaussianBlur", "feImage",
    "feMerge", "feMergeNode", "feMorphology", "feOffset",
    "feSpecularLighting", "feTile", "feTurbulence",
    "animate", "animateTransform", "set",
    "metadata", "title", "desc", "style", "script", "foreignObject"
];

connection.languages.semanticTokens.on(function (params: SemanticTokensParams): SemanticTokens {
    try {
        var doc = documents.get(params.textDocument.uri);
        if (!doc) return { data: [] };

        var text = doc.getText();
        var data: number[] = [];

        // Pre-compute line offsets for efficient position lookup
        var lineOffsets: number[] = [0];
        for (var i = 0; i < text.length; i++) {
            if (text.charAt(i) === "\n") {
                lineOffsets.push(i + 1);
            }
        }

        // Track position for delta encoding
        var prevLine = 0;
        var prevChar = 0;

        function pushToken(line: number, char: number, length: number, tokenType: number, tokenModifiers: number): void {
            var deltaLine = line - prevLine;
            var deltaChar = (deltaLine === 0) ? char - prevChar : char;
            data.push(deltaLine, deltaChar, length, tokenType, tokenModifiers);
            prevLine = line;
            prevChar = char;
        }

        function getLineCol(pos: number): { line: number; col: number } {
            // Binary search for line number
            var lo = 0, hi = lineOffsets.length - 1;
            while (lo < hi) {
                var mid = (lo + hi + 1) >> 1;
                if (lineOffsets[mid] <= pos) lo = mid;
                else hi = mid - 1;
            }
            return { line: lo, col: pos - lineOffsets[lo] };
        }

        // Parse XML tags and attributes using regex
        var tagRegex = /<\/?([a-zA-Z][\w:-]*)((?:\s+[^>]*?)?)(\s*\/?>)/g;
        var match: RegExpExecArray | null;

        while ((match = tagRegex.exec(text)) !== null) {
            var fullTag = match[0];
            var tagName = match[1];
            var attrs = match[2];
            var tagStart = match.index;
            var isClosing = fullTag.charAt(1) === "/";

            // Highlight tag name
            var nameOffset = isClosing ? 2 : 1;
            var namePos = tagStart + nameOffset;
            var nameLoc = getLineCol(namePos);
            var tokenType = TOKEN_TYPE_TYPE;
            if (tagName === "svg" || tagName === "g" || tagName === "defs") {
                tokenType = TOKEN_TYPE_NAMESPACE;
            }
            pushToken(nameLoc.line, nameLoc.col, tagName.length, tokenType, 0);

            // Highlight attributes within the tag
            if (attrs) {
                var attrRegex = /([a-zA-Z][\w:-]*)\s*=\s*"([^"]*)"/g;
                var attrMatch: RegExpExecArray | null;
                var attrsAbsStart = tagStart + 1 + tagName.length;

                while ((attrMatch = attrRegex.exec(attrs)) !== null) {
                    var attrName = attrMatch[1];
                    var attrValue = attrMatch[2];
                    var attrStart = attrsAbsStart + attrMatch.index;
                    var valueStart = attrStart + attrName.length + attrMatch[0].indexOf(attrValue) - attrMatch.index;

                    var attrNameLoc = getLineCol(attrStart);
                    pushToken(attrNameLoc.line, attrNameLoc.col, attrName.length, TOKEN_TYPE_PROPERTY, 0);

                    var valueLoc = getLineCol(valueStart);
                    var valueTokenType = TOKEN_TYPE_STRING;
                    if (/^-?\d+(\.\d+)?(%|px|em|pt|cm|mm|in|pc|ex)?$/i.test(attrValue)) {
                        valueTokenType = TOKEN_TYPE_NUMBER;
                    }
                    pushToken(valueLoc.line, valueLoc.col, attrValue.length, valueTokenType, 0);
                }
            }
        }

        // Highlight comments
        var commentRegex = /<!--([\s\S]*?)-->/g;
        var commentMatch: RegExpExecArray | null;
        while ((commentMatch = commentRegex.exec(text)) !== null) {
            var commentLoc = getLineCol(commentMatch.index);
            pushToken(commentLoc.line, commentLoc.col, commentMatch[0].length, TOKEN_TYPE_COMMENT, 0);
        }

        return { data: data };
    } catch (e) {
        connection.console.error("Semantic tokens error: " + (e instanceof Error ? e.message : String(e)));
        return { data: [] };
    }
});

// Range semantic tokens handler - returns tokens for a specific range
connection.languages.semanticTokens.onRange(function (params: any): SemanticTokens {
    try {
        var doc = documents.get(params.textDocument.uri);
        if (!doc) return { data: [] };

        var text = doc.getText();
        var data: number[] = [];

        var lineOffsets: number[] = [0];
        for (var i = 0; i < text.length; i++) {
            if (text.charAt(i) === "\n") {
                lineOffsets.push(i + 1);
            }
        }

        var prevLine = 0;
        var prevChar = 0;

        function pushToken(line: number, char: number, length: number, tokenType: number, tokenModifiers: number): void {
            // Filter by range
            if (line < params.range.start.line || line > params.range.end.line) return;
            if (line === params.range.start.line && char < params.range.start.character) return;
            if (line === params.range.end.line && char > params.range.end.character) return;

            var deltaLine = line - prevLine;
            var deltaChar = (deltaLine === 0) ? char - prevChar : char;
            data.push(deltaLine, deltaChar, length, tokenType, tokenModifiers);
            prevLine = line;
            prevChar = char;
        }

        function getLineCol(pos: number): { line: number; col: number } {
            var lo = 0, hi = lineOffsets.length - 1;
            while (lo < hi) {
                var mid = (lo + hi + 1) >> 1;
                if (lineOffsets[mid] <= pos) lo = mid;
                else hi = mid - 1;
            }
            return { line: lo, col: pos - lineOffsets[lo] };
        }

        var tagRegex = /<\/?([a-zA-Z][\w:-]*)((?:\s+[^>]*?)?)(\s*\/?>)/g;
        var match: RegExpExecArray | null;

        while ((match = tagRegex.exec(text)) !== null) {
            var fullTag = match[0];
            var tagName = match[1];
            var attrs = match[2];
            var tagStart = match.index;
            var isClosing = fullTag.charAt(1) === "/";

            var nameOffset = isClosing ? 2 : 1;
            var namePos = tagStart + nameOffset;
            var nameLoc = getLineCol(namePos);
            var tokenType = TOKEN_TYPE_TYPE;
            if (tagName === "svg" || tagName === "g" || tagName === "defs") {
                tokenType = TOKEN_TYPE_NAMESPACE;
            }
            pushToken(nameLoc.line, nameLoc.col, tagName.length, tokenType, 0);

            if (attrs) {
                var attrRegex = /([a-zA-Z][\w:-]*)\s*=\s*"([^"]*)"/g;
                var attrMatch: RegExpExecArray | null;
                var attrsAbsStart = tagStart + 1 + tagName.length;

                while ((attrMatch = attrRegex.exec(attrs)) !== null) {
                    var attrName = attrMatch[1];
                    var attrValue = attrMatch[2];
                    var attrStart = attrsAbsStart + attrMatch.index;
                    var valueStart = attrStart + attrName.length + attrMatch[0].indexOf(attrValue) - attrMatch.index;

                    var attrNameLoc = getLineCol(attrStart);
                    pushToken(attrNameLoc.line, attrNameLoc.col, attrName.length, TOKEN_TYPE_PROPERTY, 0);

                    var valueLoc = getLineCol(valueStart);
                    var valueTokenType = TOKEN_TYPE_STRING;
                    if (/^-?\d+(\.\d+)?(%|px|em|pt|cm|mm|in|pc|ex)?$/i.test(attrValue)) {
                        valueTokenType = TOKEN_TYPE_NUMBER;
                    } else if (/^(#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|hsl\(|hsla\()/.test(attrValue)) {
                        valueTokenType = TOKEN_TYPE_DECORATOR;
                    }
                    pushToken(valueLoc.line, valueLoc.col, attrValue.length, valueTokenType, 0);
                }
            }
        }

        var commentRegex = /<!--([\s\S]*?)-->/g;
        var commentMatch: RegExpExecArray | null;
        while ((commentMatch = commentRegex.exec(text)) !== null) {
            var commentLoc = getLineCol(commentMatch.index);
            pushToken(commentLoc.line, commentLoc.col, commentMatch[0].length, TOKEN_TYPE_COMMENT, 0);
        }

        return { data: data };
    } catch (e) {
        connection.console.error("Semantic tokens range error: " + (e instanceof Error ? e.message : String(e)));
        return { data: [] };
    }
});

documents.listen(connection);
connection.listen();
