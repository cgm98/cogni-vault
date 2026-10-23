<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { EditorState, Transaction } from '@codemirror/state';
import { EditorView, keymap, drawSelection, placeholder } from '@codemirror/view';
import { history, historyKeymap, defaultKeymap, indentWithTab, undo, redo } from '@codemirror/commands';
import { markdown, markdownKeymap } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { autocompletion, completionKeymap, type CompletionContext } from '@codemirror/autocomplete';
import { GFM } from '@lezer/markdown';
import { liveDecorations, liveModeEffect, focusEffect } from './liveDecorations';
import { wrapSelection } from './liveDocument';
import type { FileItem } from '../../types';
import 'katex/dist/katex.min.css';
const props=defineProps<{fileId:string;content:string;sourceMode?:boolean;files:FileItem[];openFileIds:string[]}>();
const emit=defineEmits<{(e:'change',id:string,content:string):void;(e:'wikiLinkClick',target:string):void}>();
const host=ref<HTMLElement>();
const hasSelection=ref(false);
const sessions=new Map<string,{state:EditorState;scroll:number}>();
let view:EditorView|undefined;
let currentId='';
let restoring=false;
let frame=0;
const external=Transaction.addToHistory.of(false);
const commands=[
  {label:'título',detail:'Encabezado',text:'# '},
  {label:'lista',detail:'Lista de viñetas',text:'- '},
  {label:'tarea',detail:'Casilla',text:'- [ ] '},
  {label:'tabla',detail:'Tabla Markdown',text:'| Columna | Valor |\n| --- | --- |\n|  |  |'},
  {label:'código',detail:'Bloque de código',text:'```text\n\n```'},
  {label:'fórmula',detail:'Fórmula matemática',text:'$$\nx^2\n$$'},
  {label:'mermaid',detail:'Diagrama',text:'```mermaid\nflowchart LR\n  A --> B\n```'}
];
function completions(context:CompletionContext){
  const wiki=context.matchBefore(/\[\[[^\]\n]*/);
  if(wiki) return {from:wiki.from+2,options:props.files.filter(f=>f.id!==props.fileId).map(f=>({label:f.name,type:'text',apply:(editor:EditorView,_completion:unknown,from:number,to:number)=>{const suffix=editor.state.sliceDoc(to,to+2)===']]'?'':']]';editor.dispatch({changes:{from,to,insert:f.name+suffix},selection:{anchor:from+f.name.length+suffix.length}})}}))};
  const slash=context.matchBefore(/\/[\p{L}]*$/u);
  if(!slash || context.state.sliceDoc(context.state.doc.lineAt(slash.from).from,slash.from).trim())return null;
  return {from:slash.from,filter:false,options:commands.filter(c=>c.label.startsWith(slash.text.slice(1).toLowerCase())).map(c=>({label:'/'+c.label,detail:c.detail,type:'keyword',apply:c.text}))};
}
function format(delimiter:string){if(!view)return;view.dispatch(wrapSelection(view.state,delimiter));view.focus();}
function insertLink(){
 if(!view)return;const {from,to}=view.state.selection.main;
 const label=view.state.sliceDoc(from,to)||'enlace';
 const text='['+label+'](https://)';
 view.dispatch({changes:{from,to,insert:text},selection:{anchor:from+label.length+3,head:from+text.length-1}});view.focus();
}
function createState(id:string,content:string){
 return EditorState.create({doc:content,extensions:[
  EditorState.lineSeparator.of(content.includes('\r\n') ? '\r\n' : '\n'),
  markdown({extensions:[GFM]}),history(),drawSelection(),EditorView.lineWrapping,
  syntaxHighlighting(defaultHighlightStyle),placeholder('Escribe tu nota… Usa / para insertar o [[ para enlazar.'),
  liveDecorations,
  autocompletion({override:[completions]}),
  keymap.of([{key:'Mod-k',run:()=>{insertLink();return true}},{key:'Mod-b',run:()=>{format('**');return true}},{key:'Mod-i',run:()=>{format('*');return true}},...completionKeymap,...markdownKeymap,...defaultKeymap,...historyKeymap,indentWithTab]),
  EditorView.contentAttributes.of({'aria-label':'Contenido de la nota',spellcheck:'true'}),
  EditorView.updateListener.of(update=>{
    hasSelection.value=!update.state.selection.main.empty;
    if(update.docChanged&&!restoring)emit('change',id,update.state.sliceDoc());
  }),
  EditorView.domEventHandlers({
    focus:(_event,editor)=>{editor.dispatch({effects:focusEffect.of(true)});},
    blur:(_event,editor)=>{editor.dispatch({effects:focusEffect.of(false)});},
    click:(event)=>{
      if(!(event.ctrlKey||event.metaKey))return false;
      const target=(event.target as HTMLElement).closest<HTMLElement>('[data-note-link]');
      if(target){event.preventDefault();emit('wikiLinkClick',target.dataset.noteLink!);return true;}
      const externalLink=(event.target as HTMLElement).closest<HTMLElement>('[data-external-link]');
      if(externalLink){
        try {const url=new URL(externalLink.dataset.externalLink!,window.location.href);if(['http:','https:','mailto:'].includes(url.protocol)){event.preventDefault();window.open(url.href,'_blank','noopener,noreferrer');return true;}} catch { /* Incomplete links stay editable. */ }
      }
      return false;
    }
  })
 ]});
}
function scrollElement(){return host.value?.closest<HTMLElement>('.main-canvas');}
function remember(){if(view&&currentId)sessions.set(currentId,{state:view.state,scroll:scrollElement()?.scrollTop||0});}
function sync(){
 if(!view)return;
 restoring=true;
 try{
  if(currentId!==props.fileId){
   remember();currentId=props.fileId;
   const cached=sessions.get(currentId);
   view.setState(cached?.state||createState(currentId,props.content));
   cancelAnimationFrame(frame);
   frame=requestAnimationFrame(()=>{const el=scrollElement();if(el)el.scrollTop=cached?.scroll||0;});
  }
  if(view.state.sliceDoc()!==props.content){
   const anchor=Math.min(view.state.selection.main.anchor,props.content.length),head=Math.min(view.state.selection.main.head,props.content.length);
   view.dispatch({changes:{from:0,to:view.state.doc.length,insert:props.content},selection:{anchor,head},annotations:external});
  }
  view.dispatch({effects:[liveModeEffect.of(!props.sourceMode),focusEffect.of(view.hasFocus)]});
 }finally{restoring=false;}
}
onMounted(()=>{currentId=props.fileId;view=new EditorView({state:createState(currentId,props.content),parent:host.value});sync();});
watch(()=>[props.fileId,props.content,props.sourceMode],sync,{flush:'post'});
watch(()=>props.openFileIds,ids=>{for(const id of sessions.keys())if(!ids.includes(id))sessions.delete(id);});
onBeforeUnmount(()=>{cancelAnimationFrame(frame);view?.destroy();sessions.clear();});
</script>
<template>
 <div class="live-editor">
  <div v-if="hasSelection" class="live-format-toolbar" aria-label="Formato de selección" @mousedown.prevent>
   <button type="button" @click="format('**')" title="Negrita (Ctrl+B)"><strong>B</strong></button>
   <button type="button" @click="format('*')" title="Cursiva (Ctrl+I)"><em>I</em></button>
   <button type="button" @click="format('`')" title="Código">Código</button>
   <button type="button" @click="insertLink" title="Enlace (Ctrl+K)">Enlace</button>
   <button type="button" @click="view && undo(view)" title="Deshacer">↶</button>
   <button type="button" @click="view && redo(view)" title="Rehacer">↷</button>
  </div>
  <div ref="host"></div>
 </div>
</template>
<style>
.live-editor{position:relative;min-width:0;min-height:40vh}.live-editor .cm-editor{background:transparent;color:var(--fg);font-size:15px;line-height:1.75}.live-editor .cm-editor.cm-focused{outline:none}.live-editor .cm-scroller{font-family:inherit;overflow:visible}.live-editor .cm-content{padding:12px 0 140px;caret-color:var(--fg);min-height:45vh}.live-editor .cm-line{padding:2px 0}.live-editor .cm-selectionBackground{background:#60a5fa40!important}.live-editor .cm-cursor{border-left-color:var(--fg)}.live-editor .cm-live-h1{font-size:2em;font-weight:700;line-height:1.3;padding:16px 0 10px}.live-editor .cm-live-h2{font-size:1.6em;font-weight:650;padding:14px 0 8px}.live-editor .cm-live-h3{font-size:1.3em;font-weight:650;padding:10px 0 6px}.live-editor .cm-live-h4,.live-editor .cm-live-h5,.live-editor .cm-live-h6{font-weight:650}.cm-live-strong{font-weight:700}.cm-live-em{font-style:italic}.cm-live-strike{text-decoration:line-through}.cm-live-code{font-family:monospace;background:var(--surface);border-radius:4px;padding:1px 3px}.cm-live-link{color:var(--accent,#60a5fa);text-decoration:underline;cursor:pointer}.live-editor .cm-live-quote{border-left:3px solid var(--accent,#60a5fa);padding-left:16px;color:var(--muted)}.cm-live-preview{margin:12px 0;min-width:0;white-space:normal}.cm-edit-block{font-size:11px;color:var(--muted);padding:4px 8px;border:1px solid var(--border);border-radius:5px;margin:6px 0;cursor:pointer}.cm-live-inline p{display:inline;margin:0}.cm-live-inline{cursor:text}.live-format-toolbar{position:sticky;top:0;z-index:5;width:max-content;display:flex;gap:6px;padding:4px;background:var(--surface);border:1px solid var(--border);border-radius:8px}.live-format-toolbar button{padding:4px 8px;color:var(--fg)}.live-editor .cm-tooltip{background:var(--surface);color:var(--fg);border:1px solid var(--border)}.live-editor .cm-tooltip-autocomplete ul li[aria-selected]{background:#2563eb;color:white}.live-editor input[type=checkbox]{margin:0 6px 0 0;cursor:pointer;accent-color:#60a5fa}
.cm-live-code-line{font-family:monospace;background:var(--surface);font-size:13px}.cm-live-inline img{max-width:100%;height:auto}.cm-live-inline p{display:inline}
.live-editor [class*=cm-live-h] span{text-decoration:none!important;color:inherit}
</style>
