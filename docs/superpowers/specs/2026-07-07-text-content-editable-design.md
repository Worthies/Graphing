# Editable Text Content for `<text>` Elements

**Date**: 2026-07-07
**Status**: Approved, pending implementation plan

## Problem

The SVG editor lets users change every attribute of a `<text>` element (position, fill, font-family, font-size, etc.) but not the actual text between the open and close tags. To change what a label says, the user has to switch to the text editor pane and hand-edit the source. Editing `<text>` content is the single most common labeling task in diagram authoring, so this friction is out of proportion to the value.

## Goal

When a single `<text>` element is selected in the SVG editor, expose its raw inner content in a textarea in the right-side attribute panel. Editing that textarea and blurring it updates the SVG source in place, preserving everything else — comments, attribute order, whitespace, sibling elements. Reject the edit if what the user typed is not valid XML.

## Non-goals

- Editing `<tspan>` in isolation. Selecting a `<tspan>` shows nothing new; the user must select the enclosing `<text>` to edit its raw inner content.
- Inline (on-canvas) double-click editing. Panel-only for v1.
- Multi-select bulk editing of text content across several `<text>` elements. Field is hidden unless exactly one `<text>` is selected.
- Font/formatting toolbar inside the textarea. It is a plain textarea; formatting is done by editing the raw `<tspan>` markup inside if desired.
- Automatic XML escaping of the user's input. The textarea is a raw editor; the user's characters are written verbatim.

## Design decisions

| Decision | Choice | Why |
|---|---|---|
| Load value | `element.innerHTML` — raw inner XML of the selected `<text>` | Preserves any `<tspan>` markup exactly; user sees and edits what's actually in the file. |
| Save trigger | `blur` only | One delta message per edit session, one undo step. Enter inserts a newline like a normal textarea — no special handling. |
| Element scope | `<text>` only, single selection | Simpler UX; covers the 95% case. `<tspan>`-only editing can be added later without breaking this design. |
| Sync mechanism | Reuse the arrow-key delta pattern (`text-content-delta` message) | Preserves comments, attribute order, whitespace, and root attributes — the same anti-reshape property we just built for arrow-key nudge. |
| Escaping | None — raw pass-through | Matches "you are editing the file's raw inner text." If the user wants a literal `<`, they type `&lt;`. |
| Malformed input | **Reject with a warning notification** and keep source untouched | Prevents the user from silently breaking their SVG. Textarea keeps their draft so they can fix it. |
| tspan clobbering | Any `<tspan>` children inside the range are replaced by whatever the user typed | Follows directly from the raw-passthrough model. If the user wants to keep them, they leave the markup alone. |

## Architecture

### Message contract

New webview-to-extension message:

```typescript
interface TextContentDeltaMessage {
    command: 'text-content-delta';
    tag: 'text';              // always 'text' for v1; leaves room for 'tspan' later
    elementId: string | null; // null when svgcanvas auto-id or no id
    signature: Record<string, string>;
    newText: string;          // raw content to place between open and close tag
}
```

### Webview: `svgeditStylePanel.ts`

- Add a "Content" section rendered only when the current selection is exactly one `<text>` element.
- Section contains a single `<textarea>` (3 visible rows, resizable vertically, monospace font, `placeholder="(no text)"`).
- On selection change (existing `updateFromSelection` hook), set `textarea.value = selectedElement.innerHTML`. The DOM's `innerHTML` on an SVG element returns the serialized inner XML including any `<tspan>` markup — that's exactly what we want.
- On `blur`, if `textarea.value !== originalValue`:
  1. Build the message payload:
     ```typescript
     {
       command: 'text-content-delta',
       tag: 'text',
       elementId: /^svg_\d+$/.test(el.id) ? null : (el.id || null),
       signature: getElementAttributes(el),
       newText: textarea.value
     }
     ```
  2. Set `isInternalChange = true` to suppress the resulting `changed`/`transition` events (`setTimeout(() => { isInternalChange = false; }, 200);`).
  3. Update the canvas DOM optimistically: `el.innerHTML = textarea.value`. If this throws (invalid XML fragment), swallow the exception — the extension-side validation is authoritative and will notify. The visual will re-sync on the next text change echo from the extension.
  4. Refresh the currentSvgString cache the same way arrow-key does.
  5. `vscode.postMessage(payload)`.

### Extension: `src/node/extension.ts`

Add a new case inside the `onDidReceiveMessage` switch, next to `"move-delta"`:

```typescript
case "text-content-delta": {
    const payload = message as TextContentDeltaMessage;
    if (payload.tag !== 'text') return;
    if (typeof payload.newText !== 'string') return;
    if (pset.blockOnChangeText) return;

    // 1. Validate: parseXml(<r>{newText}</r>) must succeed.
    const validationDoc = parseXml(`<r xmlns="http://www.w3.org/2000/svg">${payload.newText}</r>`);
    if (validationDoc === null) {
        vscode.window.showWarningMessage(
            "Text content is not valid XML. Kept previous content."
        );
        return;
    }

    pset.blockOnChangeText = true;
    try {
        const xml = parseXml(pset.text);
        if (xml === null) return;
        const el = findElementInXml('text', payload.elementId, payload.signature, xml);
        if (!el) return;

        // openElement.end = position just after '>' of <text ...>
        // closeElement.start = position of '<' in </text>
        const start = el.positions.openElement.end;
        const end = el.positions.closeElement ? el.positions.closeElement.start : start;

        const range = new vscode.Range(
            pset.editor.document.positionAt(start),
            pset.editor.document.positionAt(end)
        );
        const success = await pset.editor.edit(editBuilder => {
            editBuilder.replace(range, payload.newText);
        });
        if (success) {
            pset.text = pset.editor.document.getText();
            const refreshed = parseXml(pset.text);
            if (refreshed) outlineProvider.refresh(pset.editor.document, refreshed);
        }
    } catch (err) {
        outputChannel.appendLine(`text-content-delta: unexpected error ${err}`);
    } finally {
        pset.blockOnChangeText = false;
    }
    return;
}
```

### Data flow

```
User edits textarea → blur
  ↓
Webview:
  isInternalChange = true (200ms)
  el.innerHTML = newText          (canvas visual sync)
  currentSvgString = sanitize(canvas.getSvgString())
  postMessage('text-content-delta', {tag, elementId, signature, newText})
  ↓
Extension:
  parseXml('<r>' + newText + '</r>')
    ↓ null?
      → showWarningMessage(...); return
    ↓ ok?
      findElementInXml('text', id, sig, sourceXml)
      replace source[openElement.end..closeElement.start] with newText
      pset.text = document.getText()
      outlineProvider.refresh
```

## Edge cases

| Case | Behavior |
|---|---|
| User types invalid XML (unclosed tspan, stray `<`) | Warning message; source untouched; textarea keeps draft. |
| User selects a self-closing `<text/>` | `closeElement` is `null`; treat as empty inner range; still applies (creates `<text/>` → `<text>newtext</text>` shape by string surgery — see follow-up). |
| Textarea is edited then user clicks a different element (blur fires) | Delta sent for the just-blurred `<text>`; new selection follows. |
| User pastes multi-line text with embedded `<tspan x="..." dy="1.2em">` markup | Applied verbatim; SVG renders as multi-line if the tspans have `dy` offsets. |
| User's edit changes canvas `<text>` position/attributes indirectly (e.g. adds a `<tspan x="...">`) | No new element attributes on `<text>` itself — only inner content changes. |
| User deletes all text | Range replaced with empty string; `<text></text>` remains in source, renders as nothing. |
| Selection changes while textarea has unsaved content | Blur fires first, so the edit commits (or is rejected) before selection swaps. |
| Extension receives text-content-delta while a `modified` sync is in flight | `blockOnChangeText` guard causes early return; user's next blur (or the next event) retries. |

## Testing approach

### Unit tests

None required for the extension-side text replacement — it's a straightforward range-based edit that reuses already-tested helpers (`parseXml`, `findElementInXml`). Behavior is dominated by integration.

### Manual smoke

1. Open an SVG with a plain `<text x="100" y="100">Hello</text>`. Open the SVG editor. Click the text. In the "Content" textarea, replace "Hello" with "Goodbye". Click elsewhere. Text editor now shows `<text x="100" y="100">Goodbye</text>`. No other changes.
2. Open an SVG with `<text><tspan x="0">Line 1</tspan><tspan x="0" dy="1.2em">Line 2</tspan></text>`. Select the `<text>`. Textarea shows the raw tspan markup. Edit "Line 1" to "First line". Blur. Source updates in place, tspans preserved.
3. In the same textarea, type an unclosed `<tspan>bad`. Blur. Warning appears; source unchanged; textarea keeps draft.
4. Select a `<rect>`. Content section is not shown.
5. Multi-select two `<text>` elements. Content section is not shown.
6. Edit → Cmd+Z. Single undo step reverts the text change.
7. Comment survival: SVG with `<!-- header --> <text>Hi</text>` — edit "Hi" to "Hello". Comment must remain in the same position.

## Files touched

- Modified: `src/renderer/svgeditStylePanel.ts` — new "Content" section, textarea, blur handler.
- Modified: `src/renderer/svgeditEntry.ts` — nothing directly; the panel's callback already flows through here, but no new integration needed.
- Modified: `src/node/extension.ts` — new `text-content-delta` message case next to `move-delta`.
- Documentation: this file.

No new modules, no new dependencies.

## Open questions for implementation plan

- Exact placement of the "Content" section within `svgeditStylePanel.ts` (above vs below the typography section) — decide during implementation by reading the panel layout.
- Whether the textarea's height should persist across selections or reset — likely reset each selection to keep the UI predictable.
- Whether to also handle the self-closing `<text/>` case correctly on first edit — a small string-surgery detail (`positionAt(openElement.end - 2)` if the tag ends with `/>`), tracked as an implementation note.
