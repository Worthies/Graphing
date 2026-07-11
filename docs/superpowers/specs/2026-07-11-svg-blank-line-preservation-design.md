# Preserve Blank Lines Inside Inline `<svg>` Blocks for Markdown Preview

**Date**: 2026-07-11
**Status**: Approved, pending implementation plan

## Problem

The extension already ships a `extendMarkdownIt` hook (`src/node/extension.ts:42-88`) that turns ```svg code fences into HTML blocks and preserves inline `<svg>` content in the markdown preview. It works for compact SVGs but breaks for real-world hand-authored ones that use blank lines to separate logical groups (defs, background, elements, legend, etc.).

Example failing document: `~/src/oss/xokf/docs/wechat-xokf-article/article.md`. Two inline SVGs, ~70 lines each, with blank lines between element groups. Preview shows:
- An empty block where the SVG should be.
- Followed by the raw source of the second half of the SVG, rendered as literal text.

Root cause: markdown-it's block-level HTML parser recognises inline `<svg>` under its **type-7 generic-tag rule**. That rule terminates the HTML block at the first blank line. So a 70-line SVG with 10 blank lines gets fragmented into ~11 separate `html_block` tokens interspersed with `paragraph_open` tokens whose text starts with `<rect ...>` or `<text ...>`. Our `html_block` renderer override only receives the *first* fragment; the rest render through the paragraph pathway, which HTML-escapes the angle brackets. Hence "empty then raw text."

## Goal

An inline `<svg>...</svg>` block in a markdown file renders correctly in VS Code's markdown preview even when the author uses blank lines inside it for readability.

## Non-goals

- Nested `<svg>` inside `<svg>`. Not worth handling; nobody writes them, and the outer block matches the whole nested region anyway.
- Unclosed `<svg>` (no matching `</svg>`). We ignore it; the existing behaviour (broken render, source shown) is fine — the file is malformed.
- Preserving blank lines outside `<svg>` blocks. Only touch content between `<svg>` and `</svg>`.
- Interfering with ```svg code fences. Fences never pass through the block-level HTML parser, so no change needed there.
- Any change to the actual `.svg` file editor, LSP server, or webview code. This is a markdown preview-only fix.

## Design decisions

| Decision | Choice | Why |
|---|---|---|
| Where to intervene | New `md.core.ruler.before("block", ...)` rule in `extendMarkdownIt` | The block parser is what tokenises the source; intercept before it splits the SVG. |
| Rule name | `svg-preserve-blank-lines` | Namespaced, self-describing. |
| Blank-line replacement | Replace each `\n[ \t]*\n` inside an SVG span with `\n<!--_-->\n` | HTML comments are inert; they don't affect SVG rendering or DOM structure and are ignored by our sanitizer. Prevents markdown-it from seeing a blank line. |
| SVG span detection | Regex `/<svg\b[^>]*>[\s\S]*?<\/svg>/gi` on `state.src` | Simple, matches the case-insensitive tag + non-greedy content + closing tag; overlapping/nested `<svg>` are not a concern (see non-goals). |
| Escaping the raw regex characters in the comment | `<!--_-->` uses only ASCII chars — no regex escaping concern | — |
| Sanitizer changes | None | Comments already pass through the existing sanitizer unchanged. |
| Interaction with `` ```svg `` fences | None — fences are code blocks, not scanned by the HTML block parser | The new rule only touches source that already looks like inline HTML. |

## Architecture

### One-line addition in `extendMarkdownIt`

```typescript
md.core.ruler.before("block", "svg-preserve-blank-lines", function (state: any) {
    state.src = state.src.replace(
        /<svg\b[^>]*>[\s\S]*?<\/svg>/gi,
        function (m: string) { return m.replace(/\n[ \t]*\n/g, "\n<!--_-->\n"); }
    );
});
```

Ordering: this must run **before** the block parser. `state.src` is the raw source markdown; the block parser consumes it into tokens. Replacing at the source level is the cheapest possible intervention.

### Testable behaviour

Given input:

```
Prose above.

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <marker id="a"/>
  </defs>

  <rect width="100" height="100" fill="red"/>

  <text x="50" y="50">Hi</text>
</svg>

Prose below.
```

The core rule's output (visible to the block parser) must be:

```
Prose above.

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <marker id="a"/>
  </defs>
<!--_-->
  <rect width="100" height="100" fill="red"/>
<!--_-->
  <text x="50" y="50">Hi</text>
</svg>

Prose below.
```

Blank lines between `Prose above.` / `<svg>` / `Prose below.` are untouched. Blank lines *inside* the SVG span are replaced by comment lines. As a result, markdown-it emits one `html_block` token containing the entire SVG (still valid HTML — the comments are inert), then paragraphs for `Prose above.` and `Prose below.` as normal.

## Edge cases

| Case | Behaviour |
|---|---|
| SVG with no blank lines | Regex still matches; `replace` inside finds nothing to change; no-op. |
| SVG with attribute value containing `>` (e.g. `title=">"`) | `<svg\b[^>]*>` might close prematurely on the escaped `>`. This is not valid HTML anyway; author must use `&gt;` for a literal `>`. Acceptable limitation. |
| Multiple SVGs in one file | Regex is `/g`; each is processed independently. |
| SVG span crosses code fences | Regex would incorrectly match across fences. In practice authors don't put an unclosed `<svg>` inside a code fence and its matching `</svg>` outside it. Documented as an edge case; not handled. |
| SVG contains `<style>` block with CSS `\n\n` | Blank lines inside `<style>` also get replaced with `<!--_-->` comments. CSS parsers ignore HTML comments outside of specific "HTML-safe" contexts, but browsers historically tolerate `<!-- ... -->` inside `<style>` for the legacy comment-hiding pattern. Rendering unaffected in every browser we care about. |
| Non-ASCII whitespace | The `[ \t]*` only matches ASCII space/tab. Chinese full-width space (`　`, U+3000) would prevent match — treated as non-blank, block terminates. Author would fix by removing the character. Acceptable. |
| Windows line endings (`\r\n`) | markdown-it's `normalize` core rule runs before `block` and converts `\r\n` → `\n`. Our new rule runs after `normalize` (because `before("block")` is after `normalize` in the pipeline), so the regex sees only `\n`. Confirmed by markdown-it source. |
| SVG span containing a literal `</svg>` inside a comment | Extremely rare; regex would stop at the first `</svg>` occurrence. Acceptable — SVG authors don't do this. |

## Files touched

- Modified: `src/node/extension.ts` — add one `core.ruler.before("block", ...)` inside the existing `extendMarkdownIt` function, positioned above the existing rules (rules 1–3) for clarity.
- Added: `test/node/markdownItSvg.test.ts` — one unit test using an in-memory markdown-it instance, asserting the token stream after our plugin is applied contains a single `html_block` with the whole SVG content (no fragmentation).

No new dependencies. Version bump 2.9.7 → 2.9.8 at the end.

## Testing approach

### Unit test

`test/node/markdownItSvg.test.ts`:

```typescript
import * as assert from 'assert';
import { extendMarkdownIt } from '../../src/node/extension';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MarkdownIt = require('markdown-it');

describe('extendMarkdownIt: blank-line-preserved SVG', () => {
    it('emits a single html_block token for an SVG with blank lines inside', () => {
        const md = extendMarkdownIt(MarkdownIt({ html: true }));
        const src = [
            'Prose.',
            '',
            '<svg viewBox="0 0 100 100">',
            '  <defs><marker id="a"/></defs>',
            '',
            '  <rect width="100" height="100"/>',
            '',
            '  <text x="50" y="50">Hi</text>',
            '</svg>',
            '',
            'Prose.'
        ].join('\n');
        const tokens = md.parse(src, {});
        const svgBlocks = tokens.filter((t: any) => t.type === 'html_block' && /^<svg\b/i.test(t.content));
        assert.strictEqual(svgBlocks.length, 1, 'expected exactly one html_block for the SVG');
        assert.ok(svgBlocks[0].content.indexOf('</svg>') >= 0, 'html_block must include the closing </svg>');
        assert.ok(svgBlocks[0].content.indexOf('<rect') >= 0, 'html_block must include mid-SVG elements');
        assert.ok(svgBlocks[0].content.indexOf('<text') >= 0, 'html_block must include late-SVG elements');
    });

    it('does not disturb blank lines outside SVG blocks', () => {
        const md = extendMarkdownIt(MarkdownIt({ html: true }));
        const src = 'Para A.\n\nPara B.';
        const tokens = md.parse(src, {});
        const paraOpens = tokens.filter((t: any) => t.type === 'paragraph_open');
        assert.strictEqual(paraOpens.length, 2, 'blank line outside SVG must still separate paragraphs');
    });

    it('is a no-op when no <svg> is present', () => {
        const md = extendMarkdownIt(MarkdownIt({ html: true }));
        const src = '# Heading\n\nParagraph.';
        const rendered = md.render(src);
        assert.ok(rendered.indexOf('<h1>Heading</h1>') >= 0);
        assert.ok(rendered.indexOf('<p>Paragraph.</p>') >= 0);
    });
});
```

Depends on `markdown-it` being available. The existing extension code imports the VS Code-injected instance at runtime and never calls `require('markdown-it')`, so the test's `require` needs the package installed. Check `node_modules/markdown-it` availability during Task 1; if missing, add `markdown-it` as a devDependency and reinstall.

### Manual smoke

1. Reload the VS Code window after install.
2. Open `~/src/oss/xokf/docs/wechat-xokf-article/article.md`.
3. `Cmd+Shift+V` → both SVGs render fully (no empty block, no raw text visible).
4. Regression: other markdown files with no inline SVG render exactly as before.
5. Regression: a markdown file with a ```svg code fence still renders as SVG.

## Follow-up (out of scope)

- Handle `<svg>` inside code fences that use `~~~` fences instead of triple backticks (not currently affected — the same pattern applies).
- Warn or error on unclosed `<svg>` tags.
- Consider a `graphing.markdownPreviewSvg` setting to allow disabling the feature per-workspace.
