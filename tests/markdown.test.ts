import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, renderMarkdownDocument } from '../frontend/src/lib/markdown';

test('Markdown renders headings, nested lists, tables, tasks and escaped code', () => {
 const html=renderMarkdown('# Título\n\n1. Uno\n   - Anidado\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n- [x] Hecho\n\n```html\n<div>Seguro</div>\n```');
 for(const tag of ['<h1>','<ol>','<ul>','<table>','type="checkbox" disabled checked','&lt;']) assert.ok(html.includes(tag),tag);
});
test('Mermaid tokens preserve nested layout and reference definitions across diagrams', () => {
 const source='[Referencia][id]\n\n> ```mermaid\n> graph TD\n> A-->B\n> ```\n\n~~~mermaid\nsequenceDiagram\nA->>B: Hola\n~~~\n\n[id]: https://example.org';
 const result=renderMarkdownDocument(source);
 assert.equal(result.diagrams.length,2);
 assert.match(result.diagrams[0].code,/A-->B/);
 assert.match(result.html,/<blockquote>\s*<div class="note-diagram"/);
 assert.match(result.html,/href="https:\/\/example.org"/);
 assert.match(renderMarkdown('```\nmermaid\n```'),/<code>mermaid/);
});
test('math renders outside fences and malformed delimiters preserve original text', () => {
 assert.match(renderMarkdown('Inline $x^2$ and \\(y\\)\n\n$$\na^2+b^2=c^2\n$$'),/katex-display/);
 assert.match(renderMarkdown('\\[x+1\\]'),/katex-display/);
 assert.doesNotMatch(renderMarkdown('```text\n$x$\n$$\na\n$$\n```'),/class="katex/);
 assert.match(renderMarkdown('$$\nunfinished'),/unfinished/);
 assert.doesNotMatch(renderMarkdown('Precio $5 y $10'),/class="katex/);
});
test('raw HTML and unsafe URLs cannot execute; wikilinks retain aliases', () => {
 const html=renderMarkdown('<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n[[Destino|Etiqueta]]');
 assert.doesNotMatch(html,/<script>|href="javascript:/);
 assert.match(html,/data-note-link="Destino">Etiqueta/);
 assert.doesNotMatch(renderMarkdown('`[[Destino]]`'),/data-note-link/);
});
