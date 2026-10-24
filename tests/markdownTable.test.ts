import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseMarkdownTable,serializeMarkdownTable,pasteTableCells} from '../frontend/src/components/MarkdownEditor/markdownTable';
import {renderMarkdown,inlineMathRanges} from '../frontend/src/lib/markdown';
test('table roundtrip preserves escaped pipes, formulas and alignment',()=>{
 const source=String.raw`| Concepto | Fórmula |
| :--- | ---: |
| A \| B | $\alpha+\beta$ |`;
 const table=parseMarkdownTable(source);
 assert.equal(table.rows[1][0],'A | B');
 assert.deepEqual(table.alignments,['left','right']);
 assert.deepEqual(parseMarkdownTable(serializeMarkdownTable(table)),table);
 assert.match(renderMarkdown(serializeMarkdownTable(table)),/katex/);
});
test('TSV paste expands grid without losing existing cells',()=>{
 const table=parseMarkdownTable('| A | B |\n| --- | --- |\n| first | keep |');
 const result=pasteTableCells(table,1,1,'x\ty\n2\t3\n');
 assert.deepEqual(result.rows,[['A','B',''],['first','x','y'],['','2','3']]);
 assert.equal(table.rows[1][1],'keep');
});
test('math delimiters, escaped currency and fenced LaTex share rendering',()=>{
 assert.equal(inlineMathRanges(String.raw`Cost \$20, $x$ and \(a+b\)`).length,2);
 assert.equal(inlineMathRanges('$$x$$ and $ 20 and $x$2').length,0);
 const source=['~~~latex',String.raw`\begin{aligned}a&=b\\c&=d\end{aligned}`,'~~~'].join('\n');
 const rendered=renderMarkdown(source);
 assert.match(rendered,/katex-display/);assert.doesNotMatch(rendered,/katex-error/);
});
