/**
 * SVG Diff to Canvas Operations
 *
 * Converts differences between two SVG strings into canvas operations
 * that can be applied through the SvgCanvas API, preserving undo history.
 */

import { SvgCanvasExtended } from './svgcanvas-types';

export interface CanvasOperation {
  type: 'setAttribute' | 'addElement' | 'removeElement' | 'replaceElement';
  xpath?: string;
  attributes?: Record<string, string>;
  element?: Element;
  parentXpath?: string;
  index?: number;
}

export type SvgDiffResult =
  | { status: 'noChanges'; operations: CanvasOperation[] }
  | { status: 'parseError'; operations: CanvasOperation[] }
  | { status: 'diff'; operations: CanvasOperation[] };

/**
 * Parse SVG string into a DOM document
 */
function parseSvgToDoc(svgString: string): Document | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const errorNode = doc.querySelector('parsererror');
    if (errorNode) return null;
    return doc;
  } catch {
    return null;
  }
}

/**
 * Get xpath for an element relative to root
 */
function getXPath(element: Element, root: Element): string {
  if (element === root) return '/';

  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== root) {
    const parent: Element | null = current.parentElement;
    if (!parent) break;

    const currentTagName = current.tagName;
    const siblings = Array.from(parent.children).filter(
      (el: Element) => el.tagName === currentTagName
    );
    const index = siblings.indexOf(current);
    const tagName = currentTagName.toLowerCase();

    parts.unshift(siblings.length > 1 ? `${tagName}[${index + 1}]` : tagName);
    current = parent;
  }

  return '/' + parts.join('/');
}

/**
 * Find element by xpath in document
 */
function getElementByXPath(doc: Document, xpath: string): Element | null {
  try {
    const result = doc.evaluate(
      xpath,
      doc,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue as Element | null;
  } catch {
    return null;
  }
}

/**
 * Compare two elements and generate attribute operations
 */
function diffAttributes(
  oldEl: Element,
  newEl: Element,
  xpath: string
): CanvasOperation[] {
  const operations: CanvasOperation[] = [];
  const oldAttrs = new Map<string, string>();
  const newAttrs = new Map<string, string>();

  for (const attr of Array.from(oldEl.attributes)) {
    oldAttrs.set(attr.name, attr.value);
  }

  for (const attr of Array.from(newEl.attributes)) {
    newAttrs.set(attr.name, attr.value);
  }

  const changedAttrs: Record<string, string> = {};
  let hasChanges = false;

  for (const [name, value] of newAttrs) {
    if (oldAttrs.get(name) !== value) {
      changedAttrs[name] = value;
      hasChanges = true;
    }
  }

  for (const [name] of oldAttrs) {
    if (!newAttrs.has(name)) {
      changedAttrs[name] = '';
      hasChanges = true;
    }
  }

  if (hasChanges) {
    operations.push({
      type: 'setAttribute',
      xpath,
      attributes: changedAttrs
    });
  }

  return operations;
}

/**
 * Recursively compare element trees
 */
function diffElements(
  oldEl: Element,
  newEl: Element,
  root: Element,
  operations: CanvasOperation[]
): void {
  const xpath = getXPath(newEl, root);

  operations.push(...diffAttributes(oldEl, newEl, xpath));

  const oldChildren = Array.from(oldEl.children);
  const newChildren = Array.from(newEl.children);

  const maxLen = Math.max(oldChildren.length, newChildren.length);

  for (let i = 0; i < maxLen; i++) {
    const oldChild = oldChildren[i];
    const newChild = newChildren[i];

    if (!oldChild && newChild) {
      operations.push({
        type: 'addElement',
        parentXpath: xpath,
        index: i,
        element: newChild.cloneNode(true) as Element
      });
    } else if (oldChild && !newChild) {
      operations.push({
        type: 'removeElement',
        xpath: getXPath(oldChild, root)
      });
    } else if (oldChild && newChild) {
      if (oldChild.tagName !== newChild.tagName) {
        operations.push({
          type: 'replaceElement',
          xpath: getXPath(oldChild, root),
          element: newChild.cloneNode(true) as Element
        });
      } else {
        diffElements(oldChild, newChild, root, operations);
      }
    }
  }
}

/**
 * Compute diff between two SVG strings as canvas operations.
 * Returns a result object distinguishing parse failure from no changes.
 */
export function computeSvgDiff(
  oldSvgString: string,
  newSvgString: string
): SvgDiffResult {
  try {
    const oldDoc = parseSvgToDoc(oldSvgString);
    const newDoc = parseSvgToDoc(newSvgString);

    if (!oldDoc || !newDoc) {
      return { status: 'parseError', operations: [] };
    }

    const oldRoot = oldDoc.documentElement as Element;
    const newRoot = newDoc.documentElement as Element;

    if (!oldRoot || !newRoot || oldRoot.tagName !== newRoot.tagName) {
      return { status: 'parseError', operations: [] };
    }

    const operations: CanvasOperation[] = [];
    diffElements(oldRoot, newRoot, newRoot, operations);

    if (operations.length === 0) {
      return { status: 'noChanges', operations: [] };
    }

    return { status: 'diff', operations };
  } catch (error) {
    console.error('Failed to compute SVG diff:', error);
    return { status: 'parseError', operations: [] };
  }
}

/**
 * Apply canvas operations to SvgCanvas instance.
 * Resolves all xpaths upfront before applying mutations to avoid invalidation.
 * Returns true if operations were applied successfully.
 */
export function applyOperations(
  canvas: SvgCanvasExtended,
  operations: CanvasOperation[]
): boolean {
  if (operations.length === 0) return false;

  try {
    const doc = canvas.getSvgContent().ownerDocument;
    if (!doc) return false;

    // Resolve all xpaths upfront before any DOM mutations to avoid invalidation
    interface ResolvedOp {
      type: string;
      resolvedElement: Element | null;
      resolvedParent: Element | null;
      attributes?: Record<string, string>;
      element?: Element;
      index?: number;
    }

    const resolvedOps: ResolvedOp[] = operations.map(op => {
      const resolved: ResolvedOp = {
        type: op.type,
        resolvedElement: op.xpath ? getElementByXPath(doc, op.xpath) : null,
        resolvedParent: op.parentXpath ? getElementByXPath(doc, op.parentXpath) : null,
        attributes: op.attributes,
        element: op.element,
        index: op.index
      };
      return resolved;
    });

    for (const op of resolvedOps) {
      switch (op.type) {
        case 'setAttribute': {
          const el = op.resolvedElement;
          if (el && op.attributes) {
            for (const [name, value] of Object.entries(op.attributes)) {
              if (value === '') {
                el.removeAttribute(name);
              } else {
                canvas.changeSelectedAttribute(name, value, [el as unknown as SVGElement]);
              }
            }
          }
          break;
        }

        case 'addElement': {
          const parentEl = op.resolvedParent;
          if (parentEl && op.element) {
            const newEl = doc.importNode(op.element, true);
            const refChild = op.index !== undefined
              ? parentEl.children[op.index]
              : null;
            parentEl.insertBefore(newEl, refChild);
          }
          break;
        }

        case 'removeElement': {
          const el = op.resolvedElement;
          if (el) {
            el.remove();
          }
          break;
        }

        case 'replaceElement': {
          const el = op.resolvedElement;
          if (el && op.element) {
            const newEl = doc.importNode(op.element, true);
            el.replaceWith(newEl);
          }
          break;
        }
      }
    }

    return true;
  } catch (e) {
    console.error('Failed to apply canvas operations:', e);
    return false;
  }
}
