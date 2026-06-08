import * as vscode from "vscode";
import { XmlElement } from "../isomorphism/xmlParser";

export class SvgOutlineItem {
    constructor(
        public readonly elem: XmlElement,
        public readonly parent: SvgOutlineItem | null
    ) {}

    get tag(): string { return this.elem.tag; }

    get id(): string | undefined { return this.elem.attrs.id; }

    get label(): string {
        return this.id ? this.tag + "#" + this.id : this.tag;
    }

    get range(): vscode.Range {
        const iv = this.elem.positions.interval;
        // Use the opening tag range for navigation
        const start = this.elem.positions.startTag;
        return new vscode.Range(
            new vscode.Position(0, 0), // will be overridden by document
            new vscode.Position(0, 0)
        );
    }
}

export class SvgOutlineProvider implements vscode.TreeDataProvider<SvgOutlineItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<SvgOutlineItem | undefined | null>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private _onDidChangeSelection = new vscode.EventEmitter<SvgOutlineItem | null>();
    readonly onDidChangeSelection = this._onDidChangeSelection.event;

    private rootItems: SvgOutlineItem[] = [];
    private allItems: SvgOutlineItem[] = [];
    private document: vscode.TextDocument | null = null;

    refresh(document: vscode.TextDocument, xml: XmlElement | null): void {
        this.document = document;
        if (!xml) {
            this.rootItems = [];
            this.allItems = [];
        } else {
            const items: SvgOutlineItem[] = [];
            const all: SvgOutlineItem[] = [];

            function buildChildren(elem: XmlElement, parent: SvgOutlineItem | null): SvgOutlineItem[] {
                const children: SvgOutlineItem[] = [];
                for (let i = 0; i < elem.children.length; i++) {
                    const child = elem.children[i];
                    if (child.type === "element") {
                        const item = new SvgOutlineItem(child as XmlElement, parent);
                        all.push(item);
                        // Recursively build children (stored in elem.children, not item)
                        buildChildren(child as XmlElement, item);
                        children.push(item);
                    }
                }
                return children;
            }

            // Root items are children of the <svg> element
            for (let i = 0; i < xml.children.length; i++) {
                const child = xml.children[i];
                if (child.type === "element") {
                    const item = new SvgOutlineItem(child as XmlElement, null);
                    all.push(item);
                    buildChildren(child as XmlElement, item);
                    items.push(item);
                }
            }

            this.rootItems = items;
            this.allItems = all;
        }
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: SvgOutlineItem): vscode.TreeItem {
        if (!this.document) {
            return new vscode.TreeItem(element.label);
        }

        const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);

        // Icon based on tag
        item.iconPath = this.getIcon(element.tag);

        // Command to navigate to the element in the text editor
        item.command = {
            command: "graphing.outline.gotoElement",
            title: "Go to Element",
            arguments: [element]
        };

        return item;
    }

    getChildren(element?: SvgOutlineItem): SvgOutlineItem[] {
        if (!element) {
            return this.rootItems;
        }
        // Find children of this element
        const children: SvgOutlineItem[] = [];
        for (let i = 0; i < element.elem.children.length; i++) {
            const child = element.elem.children[i];
            if (child.type === "element") {
                // Find the corresponding SvgOutlineItem in allItems
                const item = this.allItems.find(it => it.elem === child);
                if (item) children.push(item);
            }
        }
        return children;
    }

    getParent(element: SvgOutlineItem): SvgOutlineItem | undefined {
        return element.parent || undefined;
    }

    // Find the element at the given cursor position and reveal it in the tree
    revealAtPosition(position: vscode.Position): void {
        if (!this.document) return;

        const offset = this.document.offsetAt(position);

        // Find the deepest element containing the offset
        let best: SvgOutlineItem | null = null;
        for (let i = 0; i < this.allItems.length; i++) {
            const item = this.allItems[i];
            const iv = item.elem.positions.interval;
            if (offset >= iv.start && offset < iv.end) {
                // This element contains the offset; prefer the deepest (last match in document order)
                best = item;
            }
        }

        this._onDidChangeSelection.fire(best);
    }

    // Find the SvgOutlineItem for a given XmlElement
    findItem(elem: XmlElement): SvgOutlineItem | undefined {
        return this.allItems.find(it => it.elem === elem);
    }

    private getIcon(tag: string): vscode.ThemeIcon {
        switch (tag) {
            case "g": return new vscode.ThemeIcon("symbol-namespace");
            case "svg": return new vscode.ThemeIcon("symbol-namespace");
            case "defs": return new vscode.ThemeIcon("symbol-module");
            case "rect": return new vscode.ThemeIcon("symbol-rectangle");
            case "circle": return new vscode.ThemeIcon("symbol-circle");
            case "ellipse": return new vscode.ThemeIcon("symbol-circle");
            case "line": return new vscode.ThemeIcon("symbol-ruler");
            case "polyline":
            case "polygon": return new vscode.ThemeIcon("symbol-polygon");
            case "path": return new vscode.ThemeIcon("symbol-snippet");
            case "text":
            case "tspan": return new vscode.ThemeIcon("symbol-string");
            case "title":
            case "desc": return new vscode.ThemeIcon("symbol-text");
            case "image": return new vscode.ThemeIcon("symbol-file");
            case "linearGradient":
            case "radialGradient": return new vscode.ThemeIcon("symbol-color");
            case "stop": return new vscode.ThemeIcon("symbol-color");
            case "style":
            case "script": return new vscode.ThemeIcon("symbol-keyword");
            default: return new vscode.ThemeIcon("symbol-field");
        }
    }
}
