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
