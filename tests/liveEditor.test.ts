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
 assert.equal(previewBlocks('```text\n$$\nx\n$$\n```').length,0);
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
