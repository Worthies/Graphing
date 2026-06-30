# Connector Lines That Follow Moved Shapes

**Date**: 2026-06-24
**Status**: Approved, pending implementation plan

## Problem

In the SVG editor, when the user moves a shape, `<line>` and `<polyline>` elements whose endpoints visually land on that shape stay put. Users expect connector-style behavior: endpoints "stuck" to shapes follow the shape when it moves. This is standard in Visio, draw.io, OmniGraffle and similar diagram tools.

## Goal

When one or more shapes are moved (drag, arrow-key nudge, or x/y attribute edit), every unselected `<line>` or `<polyline>` whose endpoint sits inside a moving shape's bounding box has that endpoint dragged along by the same delta. Move + endpoint adjustment is a single undo step.

## Non-goals

- `<path>` endpoint following (defer — requires path-data parsing).
- Following shape resize or rotation (defer — needs anchor model beyond v1).
- Explicit anchor metadata (`data-from="id"` etc.) — purely geometric for v1.
- Visual UI hint when an endpoint is "attached".
- `<polygon>` (closed shapes — not connectors).

## Design decisions

| Decision | Choice | Why |
|---|---|---|
| Attachment model | Geometric, no metadata | Works on hand-authored SVGs from the text editor; no schema burden. |
| Detection rule | Endpoint inside `getBBox()` | Fast, robust across shape types; matches how users place arrow tips. |
| Supported lines | `<line>`, `<polyline>` (first + last point) | The 95% case. `<path>` deferred. |
| Triggers | Mouse drag, arrow-key nudge, attribute-panel x/y edits | All three are legitimate move paths the user owns. Resize/rotate deferred. |
| Undo grouping | One combined undo step | Matches user mental model (one action). |

## Architecture

### New module: `src/renderer/connectorFollow.ts`

Pure functions over SVG geometry, no canvas state:

```typescript
interface Attachment {
  element: SVGLineElement | SVGPolylineElement;
  endpointIdx: 0 | 1;          // 0 = first point, 1 = last point
  attachedShapeIdx: number;     // index into the snapshot's shape array
}

interface ShapeSnapshot {
  element: SVGGraphicsElement;
  bbox: { x: number; y: number; width: number; height: number };
}

interface MoveSnapshot {
  shapes: ShapeSnapshot[];
  attachments: Attachment[];
}

// Capture the BEFORE state: which lines have endpoints inside which selected shape.
export function snapshotAttachments(
  svgRoot: SVGSVGElement,
  selectedShapes: SVGGraphicsElement[],
): MoveSnapshot;

// Apply the delta: each attachment's endpoint moves by the same (dx, dy)
// as its attached shape.
export function applyAttachmentDelta(
  snapshot: MoveSnapshot,
  newPositions: Map<SVGGraphicsElement, { x: number; y: number }>,
): void;
```

`snapshotAttachments`:
1. For each selected shape, compute `bbox = element.getBBox()` in user space, then transform to root coordinates so endpoint comparisons are apples-to-apples.
2. Build `Set` of selected element refs (used to skip self-selected lines).
3. `svgRoot.querySelectorAll('line, polyline')` → for each:
   - If it's in the selected set, skip.
   - Read endpoints (x1/y1, x2/y2 for `<line>`; first and last point of `points` for `<polyline>`).
   - For each endpoint: if inside any shape's snapshot bbox, push `{ element, endpointIdx, attachedShapeIdx }`. First match wins (document order).

`applyAttachmentDelta`:
1. For each shape in the snapshot, compute `delta = newPos - snapshot.bbox.{x,y}`.
2. For each attachment: read the endpoint's current value, add the delta of `attachedShapeIdx`, write back via `setAttribute` (so the change is visible in the serialized SVG and svgcanvas's undo).

### Undo batching helper

A small helper in `connectorFollow.ts`:

```typescript
export function withBatchedUndo<T>(
  canvas: SvgCanvasExtended,
  label: string,
  fn: () => T,
): T;
```

Uses `canvas.undoMgr.beginUndoableChange(...)` / `finishUndoableChange()` if available, otherwise wraps the inner mutations into a `BatchCommand` and pushes via `addCommandToHistory`. Implementation detail: pick whichever the bundled svgcanvas exposes; both end up as a single Ctrl+Z step.

### Integration sites

1. **Mouse drag** (`svgeditEntry.ts`)
   - Bind to svgcanvas's pre-move event (`extension_mousedown` after we confirm a selected element was clicked). Call `snapshotAttachments` and stash in a module-local variable.
   - Bind to `'changed'` / `'moved'`. Read each selected shape's new bbox top-left, build the deltas map, call `applyAttachmentDelta` inside `withBatchedUndo`.
   - Clear the stashed snapshot.

2. **Arrow-key nudge** (existing handler in `svgeditEntry.ts`)
   - Inline. Before `canvas.moveSelectedElements(dx, dy, true)`: snapshot. After: build deltas (same dx/dy for all selected), apply. Wrap the whole sequence in `withBatchedUndo`.

3. **Attribute-panel x/y edits** (existing `applyStyleToSelection` flow)
   - Capture old x/y before the edit, run the edit, compute delta from new x/y, apply attachments. Wrap in `withBatchedUndo`.

### Data flow (mouse-drag case)

```
mousedown on a selected shape
  → snapshotAttachments(svgRoot, getSelectedElements())
     → for each selected shape: originalBBox = getBBox()
     → for each <line>/<polyline> NOT in selection:
        for each endpoint:
          if inside any originalBBox: record attachment
  → cache snapshot on module-local pendingMove

drag completes (svgcanvas 'changed'/'moved' event)
  → for each selected shape: newTopLeft = currentBBox()
  → withBatchedUndo(canvas, 'move-with-attachments', () => {
       // svgcanvas has already committed the move into the undo manager;
       // we begin an undoable change and append our endpoint edits so
       // beginUndoableChange/finishUndoableChange merges them into one step
       applyAttachmentDelta(snapshot, deltasMap);
     })
  → sendSvgUpdate() (existing — syncs to text editor)
  → pendingMove = null
```

If a pre-move event isn't reliably available, the fallback is to snapshot lazily at the start of `notifyChange` by examining the element transforms, computing pre-move bboxes by subtracting the transform delta. Implementation will start with the pre-event approach and fall back only if it proves unreliable.

## Edge cases

| Case | Behavior |
|---|---|
| Both endpoints of a line attached to the same selected shape | Both move by the same delta → line rigidly translates. ✓ |
| Endpoints attached to two different selected shapes in one drag | Both deltas identical → line still translates rigidly. ✓ |
| Line is itself in the selection | Skipped. svgcanvas already moves the whole line; double-moving the endpoint would corrupt the line. |
| Endpoint inside multiple overlapping shapes | First match in document order. All selected shapes move by the same delta → choice doesn't affect outcome. |
| `<polyline>` with intermediate points | Only first/last entries in `points` are considered. Middle points ignored. |
| Endpoint exactly on bbox edge | Inside (`<=` boundary). Matches user expectation that "touching" counts. |
| Selected shape has no `getBBox()` result (degenerate, e.g. zero-size) | No attachments recorded for it. Safe no-op. |
| Line endpoint is in selected shape but shape is also being moved by the same drag with a transform that we can't decode | Fallback path: re-derive `(dx, dy)` from `oldBBox.{x,y}` vs `newBBox.{x,y}` rather than parsing transform matrices. |

## Testing approach

### Unit tests (Vitest)

`src/renderer/connectorFollow.test.ts`:
- `snapshotAttachments`: endpoint inside, outside, on boundary; line skipped when in selection; polyline first/last detected, middle ignored; multiple selected shapes; empty selection.
- `applyAttachmentDelta`: single shape moved by (dx, dy) — endpoint updated; multiple shapes with different deltas — each endpoint follows its attached shape; polyline `points` round-tripped correctly.

### Manual smoke (recorded in PR description)

1. Open a diagram with `<rect>` A, `<rect>` B, and `<line>` X with endpoints on A and B.
2. Drag A — verify X's endpoint follows; the endpoint on B stays put. Line stretches.
3. Drag both A and B together — both endpoints follow; line translates rigidly.
4. Ctrl+Z — both the rect move and the line endpoint adjustment revert together.
5. Arrow-nudge selected A — same following behavior, same single-step undo.
6. Edit A's `x` in the attribute panel — same following behavior.
7. Open an SVG with `var(--name)` CSS variables and connectors — verify CSS-variable resolution still works and connector following layers on top.

## Files touched

- New: `src/renderer/connectorFollow.ts`
- New: `src/renderer/connectorFollow.test.ts`
- Modified: `src/renderer/svgeditEntry.ts` (three integration sites)
- Modified: `src/renderer/svgcanvas-types.ts` (add `beginUndoableChange` / `finishUndoableChange` / `addCommandToHistory` if missing)

No changes to extension (`src/node/`), packaging, or the text-editor side.

## Open questions for implementation plan

- Confirm svgcanvas event name for pre-move (`extension_mousedown` vs `mousedown` callback). Read the bundled svgcanvas source to pick correctly.
- Confirm the undo API exposed by the bundled svgcanvas — `beginUndoableChange` family vs `BatchCommand`. Pick whichever is available and stable.
