import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorState} from '@codemirror/state';
import {history,undo} from '@codemirror/commands';
import {previewBlocks,wrapSelection,selectionTouches} from '../frontend/src/components/MarkdownEditor/liveDocument';
test('preview maps tables, math and Mermaid to exact source ranges without changing Markdown',()=>{
 const doc='# Inicio\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```mermaid\ngraph LR\nA-->B\n```\n\n$$\nx^2\n$$\n';
 const blocks=previewBlocks(doc);
 assert.deepEqual(blocks.map(b=>b.kind),['table','mermaid','math']);
 for(const block of blocks)assert.equal(doc.slice(block.from,block.to),block.source);
 assert.equal(previewBlocks('```mermaid\ngraph LR').length,0);
 assert.deepEqual(previewBlocks('```text\n$$\nx\n$$\n```').map(b=>b.kind),['code']);
});
test('formatting changes only the selection and is reversible with native undo',()=>{
 let state=EditorState.create({doc:'Antes texto después',selection:{anchor:6,head:11},extensions:[history()]});
 const tr=state.update(wrapSelection(state,'**'));state=tr.state;
 assert.equal(state.doc.toString(),'Antes **texto** después');
 assert.equal(state.sliceDoc(state.selection.main.from,state.selection.main.to),'texto');
 undo({state,dispatch:tr=>{state=tr.state;}} as any);
 assert.equal(state.doc.toString(),'Antes texto después');
});
test('active blocks include selections at both boundaries and across blocks',()=>{
 const state=EditorState.create({doc:'0123456789',selection:{anchor:2,head:8}});
 assert.equal(selectionTouches(state,3,5),true);
 assert.equal(selectionTouches(state,8,9),true);
 assert.equal(selectionTouches(state,0,1),false);
});
test('shared parser keeps math out of nested containers, code and table cells', () => {
 const source='> $$\n> x^2\n> $$\n\n| Expresión | Valor |\n|---|---|\n| $$x$$ | 2 |\n\n    $$literal$$\n\n$$\ny^2\n$$';
 const blocks=previewBlocks(source);
 assert.deepEqual(blocks.map(b=>b.kind),['table','code','math']);
 for(let i=1;i<blocks.length;i++)assert.ok(blocks[i-1].to<=blocks[i].from,'preview ranges must not overlap');
 assert.equal(blocks[2].source,'$$\ny^2\n$$');
});
test('unclosed math and fences stay editable as original source', () => {
 assert.deepEqual(previewBlocks('$$\nx^2'),[]);
 assert.deepEqual(previewBlocks('\\[\nx^2'),[]);
 assert.deepEqual(previewBlocks('```typescript\nconst x = 1;'),[]);
});
test('fences close only with a matching fence and preserve exact CRLF source', () => {
 assert.equal(previewBlocks('```js\nconst x = 1;\n```not-a-close').length,0);
 assert.equal(previewBlocks('```mermaid\ngraph LR\n~~~').length,0);
 const source='~~~typescript\r\nconst x = 1;\r\n~~~~\r\n\r\n---';
 const blocks=previewBlocks(source);
 assert.deepEqual(blocks.map(b=>b.kind),['code','rule']);
 for(const block of blocks)assert.equal(block.source,source.slice(block.from,block.to));
});

test('lone carriage returns preserve block ranges and never consume the following table', () => {
  const source = '$$\nx + \rbroken\n$$\n# Following\n\n| A | B |\n| --- | --- |\n| x | y |';
  const blocks = previewBlocks(source);
  assert.equal(blocks[0].source, '$$\nx + \rbroken\n$$');
  assert.equal(blocks[1].kind, 'table');
  assert.equal(blocks[1].source, '| A | B |\n| --- | --- |\n| x | y |');
});
