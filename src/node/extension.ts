import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { collectSystemFonts } from "./fontFileProcedures";
import isAbsoluteUrl from "is-absolute-url";
type OperatorName = "duplicate" | "delete" | "zoomIn" | "zoomOut" | "group" | "ungroup" | "font" | "bringForward" | "sendBackward" |
    "alignLeft" | "alignRight" | "alignBottom" | "alignTop" | "objectToPath" | "rotateClockwise" | "rotateCounterclockwise" | "rotateClockwiseByTheAngleStep" | "rotateCounterclockwiseByTheAngleStep" |
    "centerHorizontal" | "centerVertical" | "fitCanvasToContent";
import { textToXml, Interval, trimXml, trimPositions, XmlElement, XmlElementNop } from "../isomorphism/xmlParser";
import { XmlDiff, jsondiffForXml, xmlJsonDiffToStringDiff } from "../isomorphism/xmlDiffPatch";
import { LinearOptions } from "../isomorphism/xmlSerializer";
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient/node";
import { SvgOutlineProvider, SvgOutlineItem } from "./svgOutlineProvider";
import { computeMoveUpdates, isPhase1Shape } from "./moveDelta";

// Inline utilities from ../isomorphism/utils to avoid loading incremental-dom at runtime
function assertNever(x: never): never {
    throw new Error("Unexpected object: " + JSON.stringify(x));
}
function optionOf<T>(t: T | null | undefined): { map<U>(fn: (t: NonNullable<T>) => U): { getOrElse(dflt: U): U }; getOrElse(dflt: T): T } {
    const value = (t === null || t === undefined) ? null : t;
    return {
        map: function <U>(fn: (t: NonNullable<T>) => U) {
            const mapped = value === null ? null : fn(value as NonNullable<T>);
            return { getOrElse: function (dflt: U): U { return mapped === null ? dflt : mapped; } };
        },
        getOrElse: function (dflt: T): T { return value === null ? dflt : value; }
    };
}
function iterate<T extends object, R>(obj: T, fn: (key: Extract<keyof T, string>, value: T[Extract<keyof T, string>]) => R): Record<keyof T, R> {
    const acc: Record<keyof T, R> = {} as any;
    Object.entries(obj).forEach(function (entry) {
        const key = entry[0] as Extract<keyof T, string>;
        const value = entry[1] as T[Extract<keyof T, string>];
        acc[key] = fn(key, value);
    });
    return acc;
}

type PanelSet = { panel: vscode.WebviewPanel, editor: vscode.TextEditor, text: string, blockOnChangeText: boolean, blockSelectionSyncUntil: number, messageDisposable?: vscode.Disposable };

// markdown-it plugin: render ```svg code fences and inline <svg> in markdown preview
export function extendMarkdownIt(md: any) {
    // Sanitize SVG: strip <script>, event handlers, javascript: URIs
    function sanitizeSvg(html: string): string {
        return html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
            .replace(/(href|xlink:href)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, "");
    }

    // 1. Convert ```svg code fences into rendered HTML
    md.core.ruler.after("fence", "svg-fence-render", function (state: any) {
        var tokens = state.tokens;
        for (var i = 0; i < tokens.length; i++) {
            if (tokens[i].type === "fence" && tokens[i].info.trim().toLowerCase() === "svg") {
                tokens[i].type = "html_block";
                tokens[i].tag = "";
                tokens[i].children = [];
            }
        }
    });

    // 2. Override html_block renderer to always output SVG content,
    //    even when markdown-it html option is false (VS Code default)
    var defaultHtmlBlockRender = md.renderer.rules.html_block || function (tokens: any, idx: number) {
        return tokens[idx].content;
    };
    md.renderer.rules.html_block = function (tokens: any, idx: number, options: any, env: any, self: any) {
        if (/<svg[\s>]/i.test(tokens[idx].content)) {
            return sanitizeSvg(tokens[idx].content);
        }
        return defaultHtmlBlockRender(tokens, idx, options, env, self);
    };

    // 3. Override html_inline renderer to always output SVG content
    var defaultHtmlInlineRender = md.renderer.rules.html_inline || function (tokens: any, idx: number) {
        return tokens[idx].content;
    };
    md.renderer.rules.html_inline = function (tokens: any, idx: number, options: any, env: any, self: any) {
        if (/<svg[\s>]/i.test(tokens[idx].content)) {
            return sanitizeSvg(tokens[idx].content);
        }
        return defaultHtmlInlineRender(tokens, idx, options, env, self);
    };

    return md;
}

export function activate(context: vscode.ExtensionContext) {

    // Output channel for logging
    const outputChannel = vscode.window.createOutputChannel("SVG LSP Server & Editor");
    outputChannel.appendLine("Graphing extension activating...");

    let readResource =
        (filename: string) => fs.readFileSync(path.join(context.extensionPath, "resources", filename), "utf-8");
    let readImage =
        (filename: string) => fs.readFileSync(path.join(context.extensionPath, "images", filename), "utf-8");
    let readOthers =
        (filename: string) => fs.readFileSync(path.join(context.extensionPath, filename), "utf-8");
    let viewer = readResource("viewer.html");
    let templateSvg = readResource("template.svg");
    let css = readResource("style.css");
    let svgeditCss = readResource("svgedit-theme.css");
    let bundleJs = readResource("bundle.js");

    let icons = [
        "addLinearGradient.svg", "alignLeft.svg", "bringForward.svg", "duplicate.svg", "objectToPath.svg", "sendBackward.svg",
        "addRadialGradient.svg", "alignRight.svg", "zoomOut.svg",
        "alignBottom.svg", "alignTop.svg", "delete.svg", "group.svg", "zoomIn.svg", "ungroup.svg",
        "rotateClockwise.svg", "rotateCounterclockwise.svg", "centerVertical.svg", "centerHorizontal.svg"
    ].map(readImage).join("");

    let panelSet: PanelSet | null = null;

    // SVG Outline TreeView with explicit cursor-following
    var outlineProvider = new SvgOutlineProvider();
    var outlineTreeView = vscode.window.createTreeView("graphing.svgOutline", { treeDataProvider: outlineProvider });
    context.subscriptions.push(outlineTreeView);

    // Navigate to element in text editor when outline item is clicked
    context.subscriptions.push(vscode.commands.registerCommand("graphing.outline.gotoElement", function (item: SvgOutlineItem) {
        if (!panelSet) return;
        var iv = item.elem.positions.startTag;
        var pos = panelSet.editor.document.positionAt(iv.start);
        panelSet.editor.selection = new vscode.Selection(pos, pos);
        panelSet.editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        // Also select the element on the webview canvas (bidirectional sync)
        var data: any;
        if (item.elem.attrs.id) {
            data = { elementId: item.elem.attrs.id };
        } else {
            // Compute global tag index for this element
            var xml = getCachedXml(panelSet.text);
            if (xml) {
                var allElements = collectElements(xml);
                var found = -1;
                for (var i = 0; i < allElements.length; i++) {
                    if (allElements[i].elem === item.elem) { found = allElements[i].tagIndex; break; }
                }
                data = { tagName: item.tag, tagIndex: found >= 0 ? found : 0 };
            }
        }
        if (data) {
            panelSet.blockSelectionSyncUntil = Date.now() + 200;
            panelSet.panel.webview.postMessage({ command: "selectElement", data: data });
        }
    }));

    // Reveal outline item when provider signals a selection change (from cursor movement)
    context.subscriptions.push(outlineProvider.onDidChangeSelection(function (item: SvgOutlineItem | null) {
        if (item) {
            // Delay reveal to let the tree process pending data changes first
            setTimeout(function () {
                outlineTreeView.reveal(item, { select: true, focus: false, expand: true }).then(undefined, function () {
                    // Suppress "Data tree node not found" errors when tree is still rebuilding
                });
            }, 50);
        }
    }));

    let setup = (editor: vscode.TextEditor, oldPanel?: vscode.WebviewPanel) => {
        const config = vscode.workspace.getConfiguration("graphing", editor.document.uri);
        let text = editor.document.getText();
        const panel = oldPanel || (() => {
            const additionalResourceUris = [];
            for (let path of config.get<string[]>("additionalResourcePaths") || []) {
                try { additionalResourceUris.push(vscode.Uri.file(path)); } catch (_err) { }
            }
            const panel = vscode.window.createWebviewPanel(
                "graphing",
                "SVG Editor",
                vscode.ViewColumn.Beside, {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(context.extensionPath),
                    ...(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.map(x => x.uri) : []),
                    ...additionalResourceUris
                ]
            }
            )
            return panel;
        })();
        panel.webview.html = replaceMagic(viewer, { bundleJs, css, svgeditCss, icons, uri: editor.document.uri.toString() });
        panelSet = { panel, editor, text, blockOnChangeText: false, blockSelectionSyncUntil: 0 };
        setListener(panelSet);
        setWebviewActiveContext(oldPanel ? false : true);
        // Refresh outline tree for the new document
        var xml = textToXml(text);
        outlineProvider.refresh(editor.document, xml);
    }

    const SVGEDIT_AUTO_ID_RE = /^svg_\d+$/;
    const SVGEDIT_INTERNAL_ATTRS = new Set([
        'data-id', 'data-editable', 'data-lock', 'data-xmlns',
        'se:connector', 'se:nonce', 'style'
    ]);

    function findElementInXml(
        tagName: string | undefined,
        elementId: string | null,
        canvasAttrs: Record<string, string>,
        xml: XmlElement | null
    ): XmlElement | null {
        if (!xml || !tagName) return null;

        // Strategy 1: ID exists in source text (skip svgedit auto-generated IDs)
        if (elementId && !SVGEDIT_AUTO_ID_RE.test(elementId)) {
            const found = findByAttr(xml, 'id', elementId);
            if (found) return found;
        }

        // Strategy 2: attribute signature matching against parsed XML tree
        const candidates = collectByTag(xml, tagName);
        if (candidates.length === 0) return null;
        if (candidates.length === 1) return candidates[0];

        // Build a filtered attribute set (skip svgedit internals and auto-IDs)
        const sigAttrs: Record<string, string> = {};
        for (const key in canvasAttrs) {
            if (SVGEDIT_INTERNAL_ATTRS.has(key)) continue;
            if (key === 'id' && SVGEDIT_AUTO_ID_RE.test(canvasAttrs[key])) continue;
            if (key.indexOf('se:') === 0) continue;
            sigAttrs[key] = canvasAttrs[key];
        }

        let bestMatch: XmlElement | null = null;
        let bestScore = -1;
        for (const cand of candidates) {
            let score = 0;
            let misses = 0;
            for (const key in sigAttrs) {
                if (cand.attrs[key] !== undefined) {
                    if (cand.attrs[key] === sigAttrs[key]) {
                        score += 2;
                    } else {
                        score += 1;
                        misses++;
                    }
                }
            }
            // Penalize candidates with many extra attributes not in canvas
            if (score > bestScore || (score === bestScore && misses < (bestMatch ? Object.keys(bestMatch.attrs).length : Infinity))) {
                bestScore = score;
                bestMatch = cand;
            }
        }

        return bestScore > 0 ? bestMatch : null;
    }

    function findElementPositionInSource(
        text: string,
        tagName: string | undefined,
        elementId: string | null,
        canvasAttrs: Record<string, string>,
        xml: XmlElement | null
    ): number {
        const found = findElementInXml(tagName, elementId, canvasAttrs, xml);
        return found ? found.positions.openElement.start : -1;
    }

    function findByAttr(node: XmlElement, attr: string, value: string): XmlElement | null {
        if (node.attrs[attr] === value) return node;
        for (const child of node.children) {
            if (child.type === 'element') {
                const found = findByAttr(child as XmlElement, attr, value);
                if (found) return found;
            }
        }
        return null;
    }

    function collectByTag(node: XmlElement, tag: string): XmlElement[] {
        const result: XmlElement[] = [];
        function walk(n: XmlElement): void {
            if (n.tag === tag) result.push(n);
            for (const child of n.children) {
                if (child.type === 'element') walk(child as XmlElement);
            }
        }
        walk(node);
        return result;
    }

    let setListener = (pset: PanelSet) => {
        // Dispose previous message handler to prevent duplicates
        if (pset.messageDisposable) {
            pset.messageDisposable.dispose();
        }

        const config = vscode.workspace.getConfiguration("graphing", pset.editor.document.uri);
        pset.messageDisposable = pset.panel.webview.onDidReceiveMessage(async message => {
            try {
                switch (message.command) {
                    case "modified":
                        const newSvgString = message.data as string;
                        if (!newSvgString) {
                            outputChannel.appendLine("Received empty SVG string, skipping");
                            return;
                        }

                        // Prevent feedback loop
                        if (pset.blockOnChangeText) {
                            outputChannel.appendLine("Already processing change, skipping");
                            return;
                        }

                        pset.blockOnChangeText = true;
                        try {
                            outputChannel.appendLine(`Received SVG update (${newSvgString.length} chars)`);

                            // Try diff/patch first for incremental updates
                            let applied = false;
                            try {
                                const originalXml = parseXml(pset.text);
                                const fixedXml = parseXml(newSvgString);

                                if (originalXml !== null && fixedXml !== null) {
                                    const fixedXmlNop = trimPositions(fixedXml);
                                    const unit = config.get<string>("indentStyle") === "tab" ? "\t" : " ".repeat(optionOf(config.get<number>("indentSize")).getOrElse(4));
                                    const eol = pset.editor.document.eol === vscode.EndOfLine.LF ? "\n" : "\r\n";
                                    const xmldiff = xmlSerialDiff(originalXml, fixedXmlNop, { indent: { unit, level: 0, eol } });

                                    if (xmldiff.length > 0) {
                                        await pset.editor.edit(editBuilder => {
                                            patchByXmlDiff(pset.text, xmldiff, editBuilder);
                                        });
                                        pset.text = pset.editor.document.getText();
                                        applied = true;
                                        outputChannel.appendLine(`Applied ${xmldiff.length} diffs`);
                                    } else {
                                        outputChannel.appendLine("No diffs found, content identical");
                                        applied = true; // No changes needed
                                    }
                                } else {
                                    outputChannel.appendLine(`XML parse failed: original=${originalXml !== null}, new=${fixedXml !== null}`);
                                }
                            } catch (diffError) {
                                outputChannel.appendLine(`Diff/patch error: ${diffError}`);
                            }

                            // Fallback: full text replacement if diff/patch didn't work
                            if (!applied) {
                                outputChannel.appendLine("Using full text replacement");
                                const fullRange = new vscode.Range(
                                    pset.editor.document.positionAt(0),
                                    pset.editor.document.positionAt(pset.text.length)
                                );
                                const success = await pset.editor.edit(editBuilder => {
                                    editBuilder.replace(fullRange, newSvgString);
                                });
                                if (success) {
                                    pset.text = newSvgString;
                                    outputChannel.appendLine("Full replacement succeeded");
                                } else {
                                    outputChannel.appendLine("Full replacement FAILED");
                                    pset.panel.webview.postMessage({
                                        command: "error",
                                        data: "Failed to update SVG source"
                                    });
                                }
                            }
                        } catch (error) {
                            outputChannel.appendLine(`Error processing SVG update: ${error}`);
                            pset.panel.webview.postMessage({
                                command: "error",
                                data: `Sync error: ${error}`
                            });
                        } finally {
                            pset.blockOnChangeText = false;
                        }
                        return;
                    case "move-delta": {
                        const payload = message as {
                            dx: number; dy: number;
                            moves: Array<{ tag: string; elementId: string | null; signature: Record<string, string> }>;
                        };
                        if (!payload.moves || payload.moves.length === 0) return;
                        if (typeof payload.dx !== 'number' || typeof payload.dy !== 'number') return;
                        if (pset.blockOnChangeText) {
                            outputChannel.appendLine("move-delta: already processing change, skipping");
                            return;
                        }

                        pset.blockOnChangeText = true;
                        try {
                            const xml = parseXml(pset.text);
                            if (xml === null) {
                                outputChannel.appendLine("move-delta: XML parse failed, falling back to full sync");
                                return;
                            }
                            const decimalPlaces = optionOf(config.get<number>("decimalPlaces")).getOrElse(1);

                            // Resolve each move into concrete (interval, newValue) edits.
                            interface PlannedEdit { start: number; end: number; newValue: string; }
                            const edits: PlannedEdit[] = [];

                            for (const m of payload.moves) {
                                if (!isPhase1Shape(m.tag)) {
                                    outputChannel.appendLine(`move-delta: unsupported tag ${m.tag}, aborting delta path`);
                                    return; // fall through to next message; webview will resend via sendSvgUpdate for these
                                }
                                const el = findElementInXml(m.tag, m.elementId, m.signature, xml);
                                if (!el) {
                                    outputChannel.appendLine(`move-delta: could not locate ${m.tag}, aborting delta path`);
                                    return;
                                }
                                const updates = computeMoveUpdates(el, payload.dx, payload.dy, decimalPlaces);
                                if (updates.length === 0) {
                                    outputChannel.appendLine(`move-delta: no updates for ${m.tag} (likely has transform), aborting`);
                                    return;
                                }
                                for (const u of updates) {
                                    const attrPos = el.positions.attrs[u.name];
                                    if (attrPos) {
                                        edits.push({ start: attrPos.value.start, end: attrPos.value.end, newValue: u.newValue });
                                    } else {
                                        // Attribute doesn't exist in source yet — insert into the open tag before ">".
                                        // Insert as ` name="value"` right before the '>' of the open tag.
                                        const openEnd = el.positions.openElement.end;
                                        // The open tag ends with '>' or '/>'. Insert before the closing character.
                                        const isSelfClose = pset.text.charAt(openEnd - 2) === '/';
                                        const insertAt = isSelfClose ? openEnd - 2 : openEnd - 1;
                                        edits.push({ start: insertAt, end: insertAt, newValue: ` ${u.name}="${u.newValue}"` });
                                    }
                                }
                            }

                            if (edits.length === 0) return;

                            // Apply edits in descending order of start so earlier edits don't shift later intervals.
                            edits.sort((a, b) => b.start - a.start);

                            const success = await pset.editor.edit(editBuilder => {
                                for (const e of edits) {
                                    const range = new vscode.Range(
                                        pset.editor.document.positionAt(e.start),
                                        pset.editor.document.positionAt(e.end)
                                    );
                                    editBuilder.replace(range, e.newValue);
                                }
                            });

                            if (success) {
                                pset.text = pset.editor.document.getText();
                                outputChannel.appendLine(`move-delta: applied ${edits.length} attribute edits`);
                                // Refresh outline; keep parity with the "modified" path.
                                const refreshed = parseXml(pset.text);
                                if (refreshed) outlineProvider.refresh(pset.editor.document, refreshed);
                            } else {
                                outputChannel.appendLine(`move-delta: editor.edit returned false`);
                            }
                        } catch (err) {
                            outputChannel.appendLine(`move-delta: unexpected error ${err}`);
                        } finally {
                            pset.blockOnChangeText = false;
                        }
                        return;
                    }
                    case "attribute-delta": {
                        const payload = message as {
                            tag: string;
                            elementId: string | null;
                            signature: Record<string, string>;
                            updates: Array<{ name: string; newValue: string }>;
                        };
                        if (!payload.updates || payload.updates.length === 0) return;
                        if (typeof payload.tag !== 'string' || payload.tag.length === 0) return;
                        if (pset.blockOnChangeText) {
                            outputChannel.appendLine("attribute-delta: already processing change, skipping");
                            return;
                        }

                        pset.blockOnChangeText = true;
                        try {
                            const xml = parseXml(pset.text);
                            if (xml === null) {
                                outputChannel.appendLine("attribute-delta: source parse failed");
                                return;
                            }
                            const el = findElementInXml(payload.tag, payload.elementId, payload.signature, xml);
                            if (!el) {
                                outputChannel.appendLine(`attribute-delta: could not locate <${payload.tag}>`);
                                return;
                            }

                            interface PlannedEdit { start: number; end: number; newValue: string; }
                            const edits: PlannedEdit[] = [];
                            for (const u of payload.updates) {
                                const attrPos = el.positions.attrs[u.name];
                                if (attrPos) {
                                    edits.push({
                                        start: attrPos.value.start,
                                        end: attrPos.value.end,
                                        newValue: u.newValue
                                    });
                                } else {
                                    const openEnd = el.positions.openElement.end;
                                    const isSelfClose = pset.text.charAt(openEnd - 2) === '/';
                                    const insertAt = isSelfClose ? openEnd - 2 : openEnd - 1;
                                    edits.push({
                                        start: insertAt,
                                        end: insertAt,
                                        newValue: ` ${u.name}="${u.newValue}"`
                                    });
                                }
                            }

                            if (edits.length === 0) return;
                            edits.sort((a, b) => b.start - a.start);

                            const success = await pset.editor.edit(editBuilder => {
                                for (const e of edits) {
                                    const range = new vscode.Range(
                                        pset.editor.document.positionAt(e.start),
                                        pset.editor.document.positionAt(e.end)
                                    );
                                    editBuilder.replace(range, e.newValue);
                                }
                            });
                            if (success) {
                                pset.text = pset.editor.document.getText();
                                outputChannel.appendLine(`attribute-delta: applied ${edits.length} edits`);
                                const refreshed = parseXml(pset.text);
                                if (refreshed) outlineProvider.refresh(pset.editor.document, refreshed);
                            } else {
                                outputChannel.appendLine("attribute-delta: editor.edit returned false");
                            }
                        } catch (err) {
                            outputChannel.appendLine(`attribute-delta: unexpected error ${err}`);
                        } finally {
                            pset.blockOnChangeText = false;
                        }
                        return;
                    }
                    case "input-focused": {
                        const focused = (message as { focused: boolean }).focused === true;
                        vscode.commands.executeCommand('setContext', 'graphingInputFocused', focused);
                        return;
                    }
                    case "text-undo":
                    case "text-redo": {
                        const cmd = message.command === "text-undo" ? "undo" : "redo";
                        try {
                            await vscode.window.showTextDocument(pset.editor.document, {
                                viewColumn: pset.editor.viewColumn,
                                preserveFocus: false
                            });
                            await vscode.commands.executeCommand(cmd);
                            pset.panel.reveal(pset.panel.viewColumn, false);
                        } catch (err) {
                            outputChannel.appendLine(`${message.command}: ${err}`);
                        }
                        return;
                    }
                    case "text-content-delta": {
                        const payload = message as {
                            tag: 'text';
                            elementId: string | null;
                            signature: Record<string, string>;
                            newText: string;
                        };
                        if (payload.tag !== 'text') return;
                        if (typeof payload.newText !== 'string') return;
                        if (pset.blockOnChangeText) {
                            outputChannel.appendLine("text-content-delta: already processing change, skipping");
                            return;
                        }

                        // 1. Validate the new inner content parses as XML when wrapped in a namespaced root.
                        const wrapped = '<r xmlns="http://www.w3.org/2000/svg">' + payload.newText + '</r>';
                        if (parseXml(wrapped) === null) {
                            vscode.window.showWarningMessage(
                                "Text content is not valid XML. Kept previous content."
                            );
                            outputChannel.appendLine("text-content-delta: rejected — invalid XML");
                            return;
                        }

                        pset.blockOnChangeText = true;
                        try {
                            const xml = parseXml(pset.text);
                            if (xml === null) {
                                outputChannel.appendLine("text-content-delta: source parse failed");
                                return;
                            }
                            const el = findElementInXml('text', payload.elementId, payload.signature, xml);
                            if (!el) {
                                outputChannel.appendLine("text-content-delta: could not locate <text> element");
                                return;
                            }

                            // Compute the replacement range.
                            // Case A: <text ...>OLD</text>  → replace [openElement.end .. closeElement.start] with newText.
                            // Case B: <text ... />           → rewrite the '/>' as '>NEWTEXT</text>'.
                            let replaceStart: number;
                            let replaceEnd: number;
                            let replacement: string;

                            if (el.positions.closeElement !== null) {
                                replaceStart = el.positions.openElement.end;
                                replaceEnd = el.positions.closeElement.start;
                                replacement = payload.newText;
                            } else {
                                // Self-closing: rewrite `/>` at end of openElement into `>NEWTEXT</text>`.
                                // openElement.end is the offset just after '>'. So '/' is at openElement.end - 2
                                // and '>' is at openElement.end - 1. Sanity-check the '/' is actually there.
                                const openEnd = el.positions.openElement.end;
                                if (pset.text.charAt(openEnd - 2) !== '/') {
                                    outputChannel.appendLine("text-content-delta: unexpected open tag shape for self-close");
                                    return;
                                }
                                replaceStart = openEnd - 2;
                                replaceEnd = openEnd;
                                replacement = '>' + payload.newText + '</' + el.tag + '>';
                            }

                            const range = new vscode.Range(
                                pset.editor.document.positionAt(replaceStart),
                                pset.editor.document.positionAt(replaceEnd)
                            );
                            const success = await pset.editor.edit(editBuilder => {
                                editBuilder.replace(range, replacement);
                            });

                            if (success) {
                                pset.text = pset.editor.document.getText();
                                outputChannel.appendLine(
                                    `text-content-delta: applied (${replaceEnd - replaceStart} → ${replacement.length} chars)`
                                );
                                const refreshed = parseXml(pset.text);
                                if (refreshed) outlineProvider.refresh(pset.editor.document, refreshed);
                            } else {
                                outputChannel.appendLine("text-content-delta: editor.edit returned false");
                            }
                        } catch (err) {
                            outputChannel.appendLine(`text-content-delta: unexpected error ${err}`);
                        } finally {
                            pset.blockOnChangeText = false;
                        }
                        return;
                    }
                    case "svg-request":
                        // Send raw SVG text to webview (SVG Edit handles parsing internally)
                        pset.panel.webview.postMessage({
                            command: "modified",
                            data: pset.text
                        });
                        pset.panel.webview.postMessage({
                            command: "configuration",
                            data: {
                                defaultUnit: config.get<string | null>("defaultUnit"),
                                decimalPlaces: config.get<number>("decimalPlaces"),
                                collectTransform: config.get<boolean>("collectTransformMatrix"),
                                useStyleAttribute: config.get<boolean>("useStyleAttribute"),
                                indentStyle: config.get<string>("indentStyle"),
                                indentSize: config.get<number>("indentSize"),
                                canvasWidth: config.get<string>("width"),
                                canvasHeight: config.get<string>("height")
                            }
                        });
                        return;
                    case "input-request":
                        const result = await vscode.window.showInputBox({ placeHolder: message.data })
                        pset.panel.webview.postMessage({
                            command: "input-response",
                            data: result
                        });
                        return;
                    case "fontList-request":
                        const fonts = await collectSystemFonts();
                        pset.panel.webview.postMessage({
                            command: "fontList-response",
                            data: iterate(fonts, (_, value) => Object.keys(value))
                        });
                        return;
                    case "information-request":
                        const ret = await vscode.window.showInformationMessage(message.data.message, ...message.data.items);
                        pset.panel.webview.postMessage({
                            command: "information-response",
                            data: {
                                result: ret,
                                kind: message.data.kind,
                                args: message.data.args
                            }
                        });
                        return;
                    case "url-normalize-request":
                        const urlFragment = message.data.urlFragment;
                        const callbackUuid = message.data.uuid;
                        pset.panel.webview.postMessage({
                            command: "callback-response",
                            data: {
                                uuid: callbackUuid,
                                args: [normalizeUrl(urlFragment, pset.editor.document.uri.toString(), pset.panel.webview)]
                            }
                        });
                        return;
                    case "error":
                        showError(message.data);
                        return;
                    case "log":
                        if (Array.isArray(message.data)) {
                            outputChannel.appendLine(message.data.join(" "));
                        }
                        return;
                    case "selectionChanged":
                        if (Date.now() < pset.blockSelectionSyncUntil) {
                            return;
                        }
                        if (message.data) {
                            const selPos = findElementPositionInSource(
                                pset.text,
                                message.data.tagName,
                                message.data.elementId,
                                message.data.attributes || {},
                                getCachedXml(pset.text)
                            );
                            if (selPos >= 0) {
                                const position = pset.editor.document.positionAt(selPos);
                                pset.editor.selection = new vscode.Selection(position, position);
                                pset.editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
                                // Setting the text editor selection moves focus to it.
                                // Restore focus to the webview so arrow-key nudging keeps working.
                                pset.panel.reveal(pset.panel.viewColumn, false);
                            }
                        }
                        return;
                }
            } catch (e) {
                showError(e);
            }
        }, undefined, context.subscriptions);

        pset.panel.onDidDispose(() => {
            panelSet = null;
        }, undefined, context.subscriptions);

        pset.panel.onDidChangeViewState(({ webviewPanel }) => {
            setWebviewActiveContext(webviewPanel.active);
        });
    }

    function register(...args: { cmd: string; fn: (...args: any[]) => any }[]): void {
        for (let { cmd, fn } of args) {
            context.subscriptions.push(vscode.commands.registerCommand(cmd, fn));
        }
    }

    function registerPostOnly(...lastNames: OperatorName[]): void {
        register(...lastNames.map(name => {
            return {
                cmd: `graphing.${name}`,
                fn: () => {
                    panelSet && panelSet.panel.webview.postMessage({ command: name });
                }
            };
        }));
    }

    vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
        if (panelSet && panelSet.editor.document === e.document && !panelSet.blockOnChangeText && panelSet.text !== e.document.getText()) {
            // Send raw SVG text to webview (SVG Edit handles parsing internally)
            panelSet.text = e.document.getText();
            panelSet.panel.webview.postMessage({
                command: "modified",
                data: panelSet.text
            });
            // Refresh outline tree
            var xml = textToXml(panelSet.text);
            outlineProvider.refresh(e.document, xml);
        }
    }, null, context.subscriptions);

    // Track cursor position changes to select corresponding element on canvas
    // Cache parsed XML to avoid re-parsing on every cursor movement
    let cachedSvgText: string | null = null;
    let cachedXml: XmlElement | null = null;

    function getCachedXml(svgText: string): XmlElement | null {
        if (svgText !== cachedSvgText) {
            cachedSvgText = svgText;
            cachedXml = textToXml(svgText);
        }
        return cachedXml;
    }

    // Collect all elements in document order with their global tag index
    function collectElements(root: XmlElement): { elem: XmlElement; tagIndex: number }[] {
        const result: { elem: XmlElement; tagIndex: number }[] = [];
        const tagCounters: Record<string, number> = {};

        function walk(node: XmlElement): void {
            const tag = node.tag;
            if (tagCounters[tag] === undefined) tagCounters[tag] = 0;
            const idx = tagCounters[tag];
            tagCounters[tag] = idx + 1;
            result.push({ elem: node, tagIndex: idx });

            for (let i = 0; i < node.children.length; i++) {
                const child = node.children[i];
                if (child.type === "element") {
                    walk(child as XmlElement);
                }
            }
        }

        walk(root);
        return result;
    }

    // Find deepest element containing the offset, return it and its global tag index
    function findElementAtWithIndex(root: XmlElement, offset: number): { elem: XmlElement; tagIndex: number } | null {
        // First find the deepest element containing the offset
        function findDeepest(node: XmlElement): XmlElement | null {
            const interval = node.positions.interval;
            if (offset < interval.start || offset > interval.end) return null;

            for (let i = 0; i < node.children.length; i++) {
                const child = node.children[i];
                if (child.type === "element") {
                    const found = findDeepest(child as XmlElement);
                    if (found) return found;
                }
            }
            return node;
        }

        const target = findDeepest(root);
        if (!target) return null;

        // Find its global tag index
        const allElements = collectElements(root);
        for (let i = 0; i < allElements.length; i++) {
            if (allElements[i].elem === target) {
                return { elem: target, tagIndex: allElements[i].tagIndex };
            }
        }

        return { elem: target, tagIndex: 0 };
    }

    vscode.window.onDidChangeTextEditorSelection((e: vscode.TextEditorSelectionChangeEvent) => {
        if (!panelSet || panelSet.editor !== e.textEditor) return;

        const position = e.selections[0].active;
        const offset = panelSet.editor.document.offsetAt(position);

        const xml = getCachedXml(panelSet.text);
        if (!xml) return;

        const result = findElementAtWithIndex(xml, offset);
        if (!result) return;

        const target = result.elem;
        let data: any = null;

        if (target.attrs.id) {
            data = { elementId: target.attrs.id };
        } else {
            data = { tagName: target.tag, tagIndex: result.tagIndex };
        }

        // Block the webview→text-editor selection sync to prevent feedback loop:
        // text editor click → selectElement → canvas selected → selectionChanged → cursor jump
        // Use a time window (200ms) because canvas fires two events per selectElement
        panelSet.blockSelectionSyncUntil = Date.now() + 200;
        panelSet.panel.webview.postMessage({
            command: "selectElement",
            data: data
        });

        // Update outline selection to follow cursor
        outlineProvider.revealAtPosition(position);
    }, null, context.subscriptions);

    vscode.window.onDidChangeActiveTextEditor(editor => {
        const config = vscode.workspace.getConfiguration("graphing")
        if (
            editor
            && editor.document.languageId === config.get<string>("filenameExtension")
            && panelSet
            && panelSet.editor.document !== editor.document
        ) {
            setup(editor, panelSet.panel || undefined);
        }
    }, null, context.subscriptions);

    function findSvgEditor(): vscode.TextEditor | null {
        // 1. Check activeTextEditor
        var active = vscode.window.activeTextEditor;
        if (active && isSvgDocument(active.document)) {
            outputChannel.appendLine("findSvgEditor: using activeTextEditor " + active.document.fileName);
            return active;
        }

        // 2. Search visible text editors (most recently focused first)
        var visible = vscode.window.visibleTextEditors;
        for (var i = 0; i < visible.length; i++) {
            if (isSvgDocument(visible[i].document)) {
                outputChannel.appendLine("findSvgEditor: using visible editor " + visible[i].document.fileName);
                return visible[i];
            }
        }

        // 3. Search all open text documents
        var docs = vscode.workspace.textDocuments;
        for (var j = 0; j < docs.length; j++) {
            if (isSvgDocument(docs[j])) {
                outputChannel.appendLine("findSvgEditor: found SVG document " + docs[j].fileName + ", opening in editor");
                return vscode.window.visibleTextEditors.find(function (e) { return e.document === docs[j]; }) || null;
            }
        }

        outputChannel.appendLine("findSvgEditor: no SVG editor found");
        return null;
    }

    function isSvgDocument(doc: vscode.TextDocument): boolean {
        return doc.languageId === "svg" || doc.languageId === "xml" && doc.fileName.endsWith(".svg");
    }

    register(
        {
            cmd: "graphing.openSvgEditor",
            fn: () => {
                outputChannel.appendLine("openSvgEditor command invoked");
                if (panelSet) {
                    outputChannel.appendLine("revealing existing panel");
                    panelSet.panel.reveal();
                    return;
                }

                // Find the best SVG editor to use
                var targetEditor = findSvgEditor();
                if (targetEditor) {
                    outputChannel.appendLine("opening SVG editor for: " + targetEditor.document.fileName);
                    setup(targetEditor);
                } else {
                    outputChannel.appendLine("no SVG editor found, creating new untitled SVG");
                    var config = vscode.workspace.getConfiguration("graphing");
                    var width = config.get<string>("width") || "400px";
                    var height = config.get<string>("height") || "400px";
                    newUntitled(vscode.ViewColumn.One, replaceMagic(templateSvg, { width, height })).then(function (ed) {
                        setup(ed);
                    });
                }
            }
        },
        {
            cmd: "graphing.newSvgEditor",
            fn: async () => {
                if (panelSet) panelSet.panel.reveal();
                else try {
                    const config = vscode.workspace.getConfiguration("graphing");
                    const width = config.get<string>("width") || "400px";
                    const height = config.get<string>("height") || "400px";
                    const editor = await newUntitled(vscode.ViewColumn.One, replaceMagic(templateSvg, { width, height }));
                    setup(editor);
                } catch (error) {
                    showError(error);
                }
            }
        },
        {
            cmd: "graphing.reopenRelatedTextEditor",
            fn: async () => {
                if (panelSet) {
                    let editor = await newUntitled(vscode.ViewColumn.Beside, panelSet.text);
                    panelSet.editor = editor;
                    setListener(panelSet);
                }
            }
        }
    );

    registerPostOnly(
        "delete",
        "duplicate",
        "zoomIn",
        "zoomOut",
        "group",
        "ungroup",
        "font",
        "bringForward",
        "sendBackward",
        "alignLeft",
        "alignRight",
        "alignBottom",
        "alignTop",
        "objectToPath",
        "rotateClockwise",
        "rotateCounterclockwise",
        "rotateClockwiseByTheAngleStep",
        "rotateCounterclockwiseByTheAngleStep",
        "centerHorizontal",
        "centerVertical",
        "fitCanvasToContent"
    );

    // Start SVG language server
    var languageClient: any = null;
    try {
        var serverModule = path.join(context.extensionPath, "out", "node", "svgLspServer.js");
        var serverOptions: ServerOptions = {
            run: { module: serverModule, transport: TransportKind.ipc },
            debug: { module: serverModule, transport: TransportKind.ipc }
        };
        var lspConfig = vscode.workspace.getConfiguration("graphing");
        var clientOptions: LanguageClientOptions = {
            documentSelector: [
                { scheme: "file", language: "svg" },
                { scheme: "untitled", language: "svg" },
                { scheme: "file", language: "xml", pattern: "**/*.svg" } as any
            ],
            outputChannel: outputChannel,
            initializationOptions: {
                indentStyle: lspConfig.get<string>("indentStyle"),
                indentSize: lspConfig.get<number>("indentSize")
            }
        };
        languageClient = new LanguageClient("svgLanguageServer", "SVG Language Server", serverOptions, clientOptions);

        outputChannel.appendLine("Starting SVG Language Server...");
        languageClient.start();

        context.subscriptions.push({ dispose: function () { languageClient.stop(); } });

        // Register restart LSP server command
        context.subscriptions.push(vscode.commands.registerCommand("graphing.restartLspServer", function () {
            outputChannel.appendLine("Restarting SVG Language Server...");
            languageClient.stop().then(function () {
                languageClient.start();
                outputChannel.appendLine("SVG Language Server restarted.");
                vscode.window.showInformationMessage("SVG Language Server restarted.");
            }, function (err: any) {
                outputChannel.appendLine("Failed to stop SVG Language Server: " + err);
                vscode.window.showErrorMessage("Failed to restart SVG Language Server.");
            });
        }));
    } catch (error) {
        outputChannel.appendLine("Failed to start SVG Language Server: " + (error instanceof Error ? error.message : String(error)));
    }

    outputChannel.appendLine("Graphing extension activated successfully.");
}

function showError(reason: any) {
    const message = reason instanceof Error ? reason.message :
        typeof reason === 'string' ? reason :
            (reason && reason.message) || 'An unknown error occurred';
    vscode.window.showErrorMessage(message);
}

function parseXml(xmlText: string): XmlElement | null {
    const xml = textToXml(xmlText);
    return xml && trimXml(xml);
}

function xmlSerialDiff(left: XmlElement | null, right: XmlElementNop, options: LinearOptions): XmlDiff[] {
    if (left === null) return [];
    const leftNop = trimPositions(left);
    const diff = jsondiffForXml(leftNop, right);
    if (diff === undefined) return [];
    return xmlJsonDiffToStringDiff(left, diff, options);
}

export function intervalToRange(text: string, interval: Interval): vscode.Range {
    const lines1 = text.slice(0, interval.start).split(/\r?\n/);
    const lines2 = text.slice(0, interval.end).split(/\r?\n/);
    const startLine = lines1.length - 1;
    const endLine = lines2.length - 1;
    const startColumn = lines1[startLine].length;
    const endColumn = lines2[endLine].length;
    return new vscode.Range(startLine, startColumn, endLine, endColumn);
}

export function charposToPosition(text: string, pos: number): vscode.Position {
    const lines = text.slice(0, pos).split(/\r?\n/);
    const line = lines.length - 1;
    const column = lines[line].length;
    return new vscode.Position(line, column);
}

function setWebviewActiveContext(value: boolean) {
    vscode.commands.executeCommand('setContext', "graphingWebviewFocus", value);
}

export async function newUntitled(viewColumn: vscode.ViewColumn, content: string) {
    const config = vscode.workspace.getConfiguration("graphing");
    const document = await vscode.workspace.openTextDocument({ language: config.get<string>("filenameExtension"), content });
    return vscode.window.showTextDocument(document, viewColumn);
}

export function patchByXmlDiff(originalText: string, diffArray: XmlDiff[], editBuilder: vscode.TextEditorEdit) {
    for (let diff of diffArray) {
        switch (diff.type) {
            case "add":
                editBuilder.insert(charposToPosition(originalText, diff.pos), diff.value);
                break;
            case "delete":
                editBuilder.delete(intervalToRange(originalText, diff.interval));
                break;
            case "modify":
                editBuilder.replace(intervalToRange(originalText, diff.interval), diff.value);
                break;
            default:
                assertNever(diff);
        }
    }
}

/**
 * @param urlFragment `../foo/bar.svg`, `/foo/bar/baz.svg`, `C:\\Users\\henoc\\sample.svg`
 * @param baseUrl `file:///c%3A/Users/henoc/sample.svg` accept file uri scheme
 */
export function normalizeUrl(urlFragment: string, baseUrl: string, webview?: vscode.Webview): string | null {
    let uri = path.isAbsolute(urlFragment) ? vscode.Uri.file(urlFragment) : isAbsoluteUrl(urlFragment) ? vscode.Uri.parse(urlFragment) : vscode.Uri.parse(path.posix.join(path.posix.dirname(baseUrl), urlFragment.replace(/\\/g, "/")));
    if (uri.scheme === "file" && webview) {
        return webview.asWebviewUri(uri).toString();
    }
    if (uri.scheme === "file") {
        return uri.toString();
    }
    return uri.scheme === "untitled" ? null : uri.toString();
}

export function replaceMagic(str: string, vars: { [key: string]: string }): string {
    return str.replace(/(?:\/\*|<!--)\?\s*([a-zA-Z_$]\w*)\s*(?:\*\/|-->)/g, (_match, p1) => {
        return vars[p1];
    });
}
