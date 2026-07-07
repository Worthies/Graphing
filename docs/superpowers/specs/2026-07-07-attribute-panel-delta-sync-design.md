# Attribute-Panel Delta Sync

**Date**: 2026-07-07
**Status**: Approved, pending implementation plan

## Problem

The right-side attribute panel currently commits every non-text change (fill, stroke, x/y, width/height, font-family, transform, id, opacity, points, path `d`, etc.) by calling `applyStyleToSelection(style)` followed by `sendSvgUpdate()` in `svgeditEntry.ts:178-181`. `sendSvgUpdate` calls `canvas.getSvgString()`, and svgcanvas's serializer reshapes the whole document — hoisting comments to the top, wrapping content in `<g class="layer">`, injecting `svg_N` IDs, dropping root attributes like `font-family` and `viewBox`, normalizing path data, and rewriting attribute order alphabetically. This is the exact bug we fixed for the arrow-key nudge (v2.9.4) and text-content edit (v2.9.5) via delta messages. Every other panel field still triggers the reshape.

## Goal

When any single attribute changes in the panel — one field at a time or several at once — the extension edits only the changed attribute values in the source text. Comments, attribute order, whitespace, sibling elements, and root SVG attributes are preserved verbatim. Undo remains one step per change (or per burst, when the user is dragging a slider).

## Non-goals

- Migrating **mouse-drag** off `getSvgString`. Drag emits many mid-motion `changed` events and needs a snapshot-and-diff pattern of its own. Deferred.
- **Multi-selection editing.** Panel only supports single-select today; scope stays there.
- **Attribute removal**: setting a field to empty string sets the attribute to empty in source, not deletion. Removing attributes cleanly is a separate concern.
- **Reformatting values.** If the user types `100.0000` we write `100.0000`, not `100`. The panel's number controls already produce reasonable strings via `.toString()`; we do not re-normalize on the extension side.
- **Batching optimizations** across time. If the user drags a slider that fires 60 input events per second, we send 60 messages. Each is tiny and touches one attribute interval; extension applies them in order. Debouncing/coalescing is a follow-up if needed.

## Design decisions

| Decision | Choice | Why |
|---|---|---|
| Diff computation | On the **webview** side | The panel already tracks `currentAttributes`; adding a `lastAppliedAttributes` snapshot is a two-line change. Extension stays a pure applier. |
| Attribute-name translation | Small map in the panel: `{fillOpacity: 'fill-opacity', strokeWidth: 'stroke-width', fontFamily: 'font-family', fontSize: 'font-size', fontWeight: 'font-weight', fontStyle: 'font-style', strokeOpacity: 'stroke-opacity'}` — every other key is used verbatim | StyleState uses camelCase; SVG attributes are kebab-case. Explicit map is unambiguous. |
| Live vs blur commit | **Live** (input event) — same feel as today | Users expect number/color pickers to update the canvas as they drag. Message volume is tolerable because payloads are tiny. |
| Send when panel value equals element value | Skip | The signature-diff pattern from move-delta and text-content-delta guarantees no-op when values already match. Cheaper to always send. |
| Missing source attribute | Insert ` name="value"` before `>` (or `/>`) of the open tag — reuse the exact logic from `move-delta` | Same behavior users already know from arrow-key nudge. |
| Message name | `attribute-delta` | Distinct from `move-delta` (which is semantic — element move) and `text-content-delta` (element inner content). |
| `id` attribute changes | Included in the delta path like any other attribute | Same surgical behavior. The panel already mutates `el.id` directly; that stays. |
| `transform` attribute | Included; treated identically to any string attribute | Users edit transform via the panel; same delta path. |
| Elements with existing `transform` | Still eligible — we're editing the panel's fields, not moving the element geometrically. The Phase-2 exclusion in `computeMoveUpdates` does not apply here. | Different code path; no interaction. |
| Coalescing bursts | None in v1 | 60 messages/sec of "one attribute changed" is fine. Add debounce only if profiling shows a problem. |

## Architecture

### Message contract

```typescript
interface AttributeDeltaMessage {
    command: 'attribute-delta';
    tag: string;                          // e.g. 'rect'
    elementId: string | null;             // null when svgcanvas auto-id or no id
    signature: Record<string, string>;    // for findElementInXml lookup
    updates: Array<{
        name: string;                     // SVG attribute name in kebab-case, e.g. 'fill-opacity'
        newValue: string;                 // string value to write; empty string means "set to empty"
    }>;
}
```

Empty `updates` array → panel decided nothing actually changed → webview does not post the message. Extension will never see it.

### Webview

**`svgeditStylePanel.ts`**
- Add a private field `lastAppliedAttributes: ElementAttributes | null = null`.
- In `updateFromSelection` and `updateFromElement`, after `this.currentAttributes = ...`, deep-copy to `this.lastAppliedAttributes`.
- Change the constructor's third callback shape from `(style: StyleState) => void` to `(style: StyleState, changes: Array<{name: string, newValue: string}>) => void`. Existing behavior at the call site (calling `applyStyleToSelection(style)`) is preserved by continuing to pass the full `style` object as the first argument.
- Add a small `CAMEL_TO_KEBAB` map used only for the attribute-name translation.
- In `applyStyle`, before calling `onStyleChange`:
  1. If `lastAppliedAttributes` is null, skip diff — treat as first application (no changes list). This happens on initial render before any user edit; unlikely to trigger a real change.
  2. Walk `currentAttributes`; for each key whose value differs from `lastAppliedAttributes[key]`, push `{name: kebab(key), newValue: String(newVal)}` into `changes`.
  3. Set `lastAppliedAttributes` to a fresh copy of `currentAttributes`.
  4. Call `onStyleChange(currentAttributes, changes)`.

**`svgeditEntry.ts`**
- Change the panel construction callback:
  ```typescript
  (style: StyleState, changes: Array<{name: string, newValue: string}>) => {
      // Still update the canvas visually via svgcanvas.
      applyStyleToSelection(style);

      // If nothing meaningfully changed, or no element is selected, we're done.
      if (changes.length === 0) return;
      const elems = getSelectedElements();
      if (elems.length !== 1) return;
      const el = elems[0];

      // Suppress the sendSvgUpdate that svgcanvas's 'changed' event would trigger.
      isInternalChange = true;
      try {
          currentSvgString = sanitizeSvgForEditor(canvas.getSvgString());
      } catch (err) {
          logger.warn('attribute-delta: currentSvgString refresh failed', err);
      }

      const elementId = el.id && !/^svg_\d+$/.test(el.id) ? el.id : null;
      vscode.postMessage({
          command: 'attribute-delta',
          tag: el.tagName,
          elementId,
          signature: getElementAttributes(el),
          updates: changes
      });

      setTimeout(() => { isInternalChange = false; }, 200);
  }
  ```

### Extension

**`extension.ts`** — new `case "attribute-delta":` in the message switch, structurally identical to `move-delta` but simpler because updates are pre-computed:

```typescript
case "attribute-delta": {
    const payload = message as {
        tag: string;
        elementId: string | null;
        signature: Record<string, string>;
        updates: Array<{ name: string; newValue: string }>;
    };
    if (!payload.updates || payload.updates.length === 0) return;
    if (pset.blockOnChangeText) return;

    pset.blockOnChangeText = true;
    try {
        const xml = parseXml(pset.text);
        if (xml === null) return;
        const el = findElementInXml(payload.tag, payload.elementId, payload.signature, xml);
        if (!el) return;

        interface PlannedEdit { start: number; end: number; newValue: string; }
        const edits: PlannedEdit[] = [];
        for (const u of payload.updates) {
            const attrPos = el.positions.attrs[u.name];
            if (attrPos) {
                edits.push({ start: attrPos.value.start, end: attrPos.value.end, newValue: u.newValue });
            } else {
                const openEnd = el.positions.openElement.end;
                const isSelfClose = pset.text.charAt(openEnd - 2) === '/';
                const insertAt = isSelfClose ? openEnd - 2 : openEnd - 1;
                edits.push({ start: insertAt, end: insertAt, newValue: ` ${u.name}="${u.newValue}"` });
            }
        }
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
            const refreshed = parseXml(pset.text);
            if (refreshed) outlineProvider.refresh(pset.editor.document, refreshed);
        }
    } catch (err) {
        outputChannel.appendLine(`attribute-delta: unexpected error ${err}`);
    } finally {
        pset.blockOnChangeText = false;
    }
    return;
}
```

Note: the descending-start sort and insertion logic are pulled verbatim from `move-delta`. If we later factor them into a shared helper it will be as a follow-up refactor; here the small duplication is fine.

## Data flow

```
User types in a field → panel `input` handler updates currentAttributes
  → panel.applyStyle() computes diff vs lastAppliedAttributes
  → changes = [{name: 'fill', newValue: '#ff0000'}]
  → lastAppliedAttributes = clone(currentAttributes)
  → onStyleChange(currentAttributes, changes)
      ↓
Webview svgeditEntry callback:
  applyStyleToSelection(currentAttributes)   ← canvas visual sync (unchanged)
  isInternalChange = true
  currentSvgString = sanitize(canvas.getSvgString())
  postMessage('attribute-delta', {tag, elementId, signature, updates: changes})
      ↓
Extension attribute-delta handler:
  parseXml(pset.text) → xml
  findElementInXml(tag, id, sig, xml) → element
  for each update:
    if element.positions.attrs[name] exists:
      replace [attrPos.value.start .. attrPos.value.end] with newValue
    else:
      insert ` name="value"` before '>' (or '/>')
  apply edits in descending start order
  pset.text = document.getText()
  outlineProvider.refresh
```

## Edge cases

| Case | Behavior |
|---|---|
| User changes fill from `#fff` to `#000` | One update; source's `fill="..."` value swapped in place; siblings unaffected. |
| User drags stroke-width slider (60 events) | 60 tiny messages, one attribute each. Extension processes serially; last one wins the final state. Undo history has 60 steps (matches today's behavior for full-serialize path — no regression). |
| User pastes multi-line value into a text input | Live SVG accepts any string; extension writes it verbatim inside the double-quoted value. If the user pastes `abc" onmouseover="alert(1)`, they get a broken attribute — matches current behavior; we don't sanitize. |
| Panel selection changes to a different element mid-edit | The panel's `updateFromSelection` runs; `lastAppliedAttributes` snapshots the new element's state; no phantom delta is sent for the previous element. |
| Element has `transform="rotate(45)"` already | Delta path still applies. We do not compose transforms — we replace the whole `transform` value with whatever the user typed. |
| Attribute doesn't exist yet in source (e.g. user types into an empty `id` field) | Extension injects ` name="value"` before the open tag's `>` or `/>`, identical to `move-delta` insertion logic. |
| User types into `id` field and the value collides with another element's id | Not our concern here; svgcanvas / the SVG runtime handles or errors. Delta path only mirrors source text. |
| Selection loses the exact element between message send and message receipt | `findElementInXml` returns null; extension logs and skips. Panel remains authoritative for the canvas visual. |
| `points` / `d` textarea fires on every keystroke | 1 message per keystroke; matches today. If profiling shows this is expensive, follow-up work adds a per-attribute debounce. |
| Panel apply-callback fires with no actual change (e.g. focus-blur churn) | `changes` is empty; webview returns before posting. Extension never sees it. |

## Files touched

- Modified: `src/renderer/svgeditStylePanel.ts` — add `lastAppliedAttributes`, `CAMEL_TO_KEBAB`, diff logic in `applyStyle`, constructor callback signature change.
- Modified: `src/renderer/svgeditEntry.ts` — replace `sendSvgUpdate()` in the style-change callback with the `attribute-delta` post; keep `applyStyleToSelection(style)` intact.
- Modified: `src/node/extension.ts` — new `attribute-delta` case in the message switch.

No new files, no new dependencies.

## Testing approach

### Unit tests

None required for the extension side — the same interval-based replacement logic is already exercised via `move-delta` tests indirectly, and the new case shares no non-trivial branches beyond what's already covered.

### Manual smoke

Reproducer file: `/tmp/scenario-cross-border.backup.svg` (already stashed). After install:

1. Open the SVG. Pick a `<rect>`. Change `fill` to a distinctive color. Diff against backup: **only** that rect's `fill` attribute value changed. Comments, root attributes, layer wrap, path shorthand — all untouched.
2. Change `stroke-width` on the same rect via the slider. Same expectation.
3. Change `font-family` on a `<text>`. Same expectation.
4. Change the `transform` field. Same expectation.
5. Change `id` on an element without one. Extension inserts ` id="value"` before `>`. No other changes.
6. Change `x` and `y` via the panel (not arrow keys). Both intervals replaced. No layer wrap.
7. Combined: change fill, then stroke, then x, then font-size. Undo three times — reverts each in reverse order. Undo more — reverts to original.
8. Regression check: arrow-key nudge still works. Text content edit still works.

## Follow-up (out of scope)

- Mouse-drag delta path (needs `mousedown` snapshot + `mouseup` finalize).
- Debounce/coalesce burst input events if profiling reveals cost.
- Attribute *deletion* (currently we only replace, never remove).
- Refactor the shared "apply planned interval edits" logic into a helper used by move-delta, text-content-delta, and attribute-delta.
