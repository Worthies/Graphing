# Input-Focus Keybinding Guard & Text-Editor Undo

**Date**: 2026-07-07
**Status**: Approved, pending implementation plan

## Problem

Two production bugs, both surfaced by users while editing the newly added attribute-panel text fields:

1. **Delete/Backspace in a panel textarea removes the selected shape.** Every command keybinding contributed by the extension (`package.json`'s `keybindings` array — delete, cmd+d, cmd+a, cmd+g, cmd+u, arrows via `[`/`]`, etc.) is gated only on VS Code's `graphingWebviewFocus` context. That context stays `true` when a textarea *inside* the webview has focus, so VS Code fires the mapped command before the keystroke ever reaches the textarea. The DOM-level keydown handler in `svgeditEntry.ts:786-791` already gates itself on `target.tagName !== INPUT/TEXTAREA/SELECT` and `!target.isContentEditable`, so DOM-level interception is not the problem — VS Code's keybinding layer runs earlier.

2. **Cmd+Z / undo button reorders comments.** Both undo paths (webview keydown at `svgeditEntry.ts:800-816` and the toolbar buttons) call `canvas.undoMgr.undo()` followed by `sendSvgUpdate()`. `sendSvgUpdate()` calls `canvas.getSvgString()`, which is the svgcanvas serializer we spent three prior features avoiding — it hoists comments, wraps content in `<g class="layer">`, injects `svg_N` IDs, and rewrites attribute order. All write paths (move, text content, attribute panel) are on delta-sync; the undo path alone bleeds through the full-serialize.

## Goal

- Prevent extension keybindings from firing while a user is typing in any editable field inside the webview.
- Route undo/redo through VS Code's text-editor undo stack so that reversing an edit reverses the *text change* — preserving everything the delta sync preserved when the edit was made.

## Non-goals

- Rebuilding svgcanvas's undo manager or otherwise touching third-party code.
- Handling keybindings that VS Code core provides on its own (cut/copy/paste). These already respect input focus in webviews via VS Code's own machinery.
- Selectively re-enabling *some* keybindings while typing (all extension keybindings become inactive under input focus — simpler and consistent).
- Coalescing text edits into one undo step across multiple slider events. If the user drags a slider producing 60 messages, undo will step through 60 text edits (matches current behavior for the pre-delta full-serialize path — no regression).

## Design decisions

| Decision | Choice | Why |
|---|---|---|
| Input focus tracking | Webview posts `input-focused` message on any focusable element gaining/losing focus | The webview is the only place that can observe focus inside itself. Extension receives, sets a VS Code context. |
| Context name | `graphingInputFocused` (boolean) | Namespace matches the existing `graphingWebviewFocus`. |
| Keybinding gating | Append `&& !graphingInputFocused` to every existing `when: graphingWebviewFocus` clause in `package.json` | Uniform, easy to audit. No per-keybinding case analysis. |
| Focus event source | `focusin` / `focusout` on `document` (bubbling variants of `focus`/`blur`) | Element-agnostic; fires once per real focus change; skips programmatic focus that doesn't reach editable elements. |
| Elements that count as "input" | `INPUT`, `TEXTAREA`, `SELECT`, or any element with `isContentEditable === true` | Matches the DOM-handler check that already exists at `svgeditEntry.ts:789`. |
| Undo/redo mechanism | Webview posts `text-undo` / `text-redo`; extension runs `vscode.commands.executeCommand('undo'|'redo')` on `pset.editor` | The text editor is now the source of truth for the delta architecture. Undoing the last text edit is exactly the right semantics. Canvas re-renders from the reverted text via the existing document-change listener. |
| Removed: `canvas.undoMgr.undo/redo` calls | Yes | With every write path going through delta sync, the canvas's internal undo stack no longer reflects the user's edit history reliably. Better to have one source of truth. |
| Removed: `sendSvgUpdate()` after undo | Yes | The extension's echo of the reverted text drives the canvas rebuild. `sendSvgUpdate` would round-trip through `getSvgString` and reshape. |
| Ensuring the text editor receives the undo command | Extension calls `vscode.window.showTextDocument(pset.editor.document, { viewColumn: pset.editor.viewColumn, preserveFocus: false })` to focus the text editor, runs the command, then `pset.panel.reveal(pset.panel.viewColumn, false)` to hand focus back to the webview | Same focus-restoration pattern already used in the selection-sync handler. |

## Architecture

### Message contracts

New webview-to-extension messages:

```typescript
interface InputFocusedMessage {
    command: 'input-focused';
    focused: boolean;
}

interface TextUndoMessage { command: 'text-undo'; }
interface TextRedoMessage { command: 'text-redo'; }
```

### Webview

**`svgeditEntry.ts`**

- Near the top of the file (before the existing `window.addEventListener('keydown', ...)`), install two document-level focus listeners:

  ```typescript
  function isEditableTarget(t: EventTarget | null): boolean {
      if (!t || !(t as HTMLElement).tagName) return false;
      const el = t as HTMLElement;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  let inputFocusReported = false;
  function reportInputFocus(focused: boolean): void {
      if (focused === inputFocusReported) return;
      inputFocusReported = focused;
      vscode.postMessage({ command: 'input-focused', focused });
  }

  document.addEventListener('focusin', (e) => {
      if (isEditableTarget(e.target)) reportInputFocus(true);
  });
  document.addEventListener('focusout', (e) => {
      // Wait for the *next* focus target before deciding; if it's not editable, blur.
      setTimeout(() => {
          const active = document.activeElement;
          if (!isEditableTarget(active)) reportInputFocus(false);
      }, 0);
  });
  ```

- In the keydown handler (`svgeditEntry.ts:786-816`), replace the Cmd/Ctrl+Z branch's body:

  Current:
  ```typescript
  const isRedo = ...;
  try {
      if (isRedo) {
          if (canvas.undoMgr.getRedoStackSize() > 0) canvas.undoMgr.redo();
      } else {
          if (canvas.undoMgr.getUndoStackSize() > 0) canvas.undoMgr.undo();
      }
      sendSvgUpdate();
  } catch (err) {
      logger.error('undo/redo failed', err);
  }
  ```

  New:
  ```typescript
  const isRedo = ...;
  vscode.postMessage({ command: isRedo ? 'text-redo' : 'text-undo' });
  ```

- In the toolbar operation handler (`svgeditEntry.ts:504-547` region — the `'undo'` and `'redo'` cases inside `handleOperation`), same replacement — post `text-undo` / `text-redo` instead of calling `canvas.undoMgr.*`. Do not call `sendSvgUpdate()` afterward.

### Extension

**`extension.ts`**

- New `case "input-focused":` in the message switch. Body:

  ```typescript
  case "input-focused": {
      const focused = (message as { focused: boolean }).focused === true;
      vscode.commands.executeCommand('setContext', 'graphingInputFocused', focused);
      return;
  }
  ```

- New `case "text-undo":` and `case "text-redo":`. Body:

  ```typescript
  case "text-undo":
  case "text-redo": {
      const cmd = message.command === "text-undo" ? "undo" : "redo";
      try {
          await vscode.window.showTextDocument(pset.editor.document, {
              viewColumn: pset.editor.viewColumn,
              preserveFocus: false
          });
          await vscode.commands.executeCommand(cmd);
          // Restore focus to the webview.
          pset.panel.reveal(pset.panel.viewColumn, false);
      } catch (err) {
          outputChannel.appendLine(`${message.command}: ${err}`);
      }
      return;
  }
  ```

- Ensure `pset.blockOnChangeText` is NOT set when running these — the resulting text-change must echo to the webview so the canvas re-renders.

### `package.json`

Modify every keybinding whose `when` currently equals `graphingWebviewFocus`. Change it to `graphingWebviewFocus && !graphingInputFocused`. Affected commands (17 total):

- `graphing.delete` (backspace)
- `graphing.delete` (delete)
- `graphing.duplicate` (cmd+d)
- `graphing.zoomIn` (oem_plus)
- `graphing.zoomOut` (oem_minus)
- `graphing.group` (cmd+g)
- `graphing.ungroup` (cmd+u)
- `graphing.font` (f8)
- `graphing.bringForward` (pageup)
- `graphing.sendBackward` (pagedown)
- `graphing.alignLeft/Right/Bottom/Top` (ctrl+alt+numpad4/6/2/8)
- `graphing.objectToPath` (shift+cmd+c)
- `graphing.rotateClockwise/Counterclockwise` (cmd+]/[)
- `graphing.rotateClockwiseByTheAngleStep/Counterclockwise` (`]`/`[`)
- `graphing.centerVertical/Horizontal` (cmd+alt+h/t)

## Data flow

```
Bug 1 — user focuses a textarea:
    focusin event → reportInputFocus(true) → postMessage('input-focused', {focused: true})
        → extension: setContext('graphingInputFocused', true)
    User presses Delete:
        VS Code evaluates when-clauses. `graphingWebviewFocus && !graphingInputFocused` = false.
        VS Code does NOT fire `graphing.delete`. Delete goes to the textarea's native behavior.
    User blurs the textarea:
        focusout → setTimeout → activeElement is not editable → reportInputFocus(false)
        → extension: setContext('graphingInputFocused', false)

Bug 2 — user presses Cmd+Z with the SVG editor focused:
    keydown handler: postMessage('text-undo')
    Extension:
        showTextDocument(pset.editor.document) — focus text editor
        executeCommand('undo') — VS Code reverses the last text edit
        panel.reveal(preserveFocus=false) — hand focus back to webview
    The undo edit triggers the existing onDidChangeTextDocument listener,
    which posts the new text to the webview.
    Webview receives 'text' message → canvas rebuilds from the reverted source.
    All formatting (comments, attr order, root attrs) is exactly as it was
    before the last delta edit.
```

## Edge cases

| Case | Behavior |
|---|---|
| User rapidly switches between two textareas | `focusin` on second fires before `focusout` on first; `activeElement` in the setTimeout points to the new textarea; still editable; no false blur report. |
| User dismisses the SVG editor while a textarea has focus | Panel dispose runs; no context cleanup required — `graphingInputFocused` staying `true` is inert because `graphingWebviewFocus` becomes `false`. When the panel opens again, focus starts on the canvas → focusin never fires with an editable target → context flips to `false` naturally. In practice safe. |
| User undoes a change that svgcanvas didn't drive (e.g. user hand-edited the text file) | Text-editor undo reverses their manual edit; extension echo triggers canvas rebuild. Consistent behavior. |
| Undo stack empty | `vscode.commands.executeCommand('undo')` is a no-op; nothing happens; canvas stays as-is. |
| User is in a text editor pane (not the SVG editor) and hits Cmd+Z | Standard VS Code text-editor undo; we're not intercepting anything from that context. |
| User has multiple SVG editors open | Each editor has its own `pset` and its own text editor reference. Undo goes to the correct document. |
| `showTextDocument` fails because the document was closed | Caught by the try/catch; logs to output channel; user sees no undo happen. Acceptable — the document being closed is an unusual state; forcing recovery is out of scope. |
| Focus changes to an element that's editable but hosted in a shadow DOM | `focusin` bubbles across shadow boundaries by default; edge case not expected in this codebase. |

## Files touched

- Modified: `src/renderer/svgeditEntry.ts` — install focus listeners; replace undo/redo keyboard branch and toolbar-callback undo/redo cases with `text-undo`/`text-redo` messages.
- Modified: `src/node/extension.ts` — new `input-focused`, `text-undo`, `text-redo` message cases.
- Modified: `package.json` — append `&& !graphingInputFocused` to 17 keybinding `when` clauses.

No new files, no new dependencies.

## Testing approach

### Unit tests

None. The changes are message-plumbing and one context flag. Behavior is dominated by manual interaction.

### Manual smoke

1. Open the reproducer SVG. Open the SVG editor. Select a `<text>`. Focus the Content textarea. Delete some characters with the Delete key — the characters go away one at a time; the shape stays.
2. Same, but with Backspace — same result.
3. In the textarea, press Cmd+A — the textarea's content is selected (native), not all shapes.
4. In the textarea, type `<tspan x="0">a</tspan>` character by character; nothing intercepts.
5. Blur the textarea (click canvas). Select a shape. Press Delete → shape is deleted (extension keybinding fires again).
6. Repeat the attribute-panel-delta-sync smoke tests (fill / stroke-width / font-family / transform / id). All still work.
7. Change a fill via the panel. Cmd+Z on the canvas — diff shows the source is *back to the original file*, comments and attribute order intact. Diff against the pre-edit backup should be empty.
8. Cmd+Shift+Z — redo — source returns to the edited state.
9. Arrow-key nudge → Cmd+Z → source reverts to pre-nudge state.
10. Text-content edit → Cmd+Z → source reverts.
11. Toolbar undo/redo buttons — same behavior as keyboard.

## Follow-up (out of scope)

- Debounce burst attribute deltas so a slider drag produces one text-editor undo step rather than 60.
- Restore keybinding-per-key granularity if some subset should stay active while typing (e.g. arrow keys for step increment). None seem justified today.
- Mirror the input-focus context down into more keybinding when-clauses if new ones are added in the future — document this convention in `docs/`.
