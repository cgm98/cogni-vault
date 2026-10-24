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
import 'highlight.js/styles/github-dark.css';
import './document.css';
import './live-editor.css';
const props=defineProps<{fileId:string;content:string;sourceMode?:boolean;active?:boolean;toolbarTarget?:HTMLElement|null;files:FileItem[];openFileIds:string[]}>();
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
function cellSelection() {
 const element=document.activeElement;
 return element instanceof HTMLTextAreaElement && host.value?.contains(element) ? element : null;
}
function format(delimiter:string){
 const cell=cellSelection();
 if(cell){const start=cell.selectionStart,end=cell.selectionEnd;cell.setRangeText(delimiter+cell.value.slice(start,end)+delimiter,start,end,'select');cell.dispatchEvent(new Event('input',{bubbles:true}));cell.focus();return;}
 if(!view)return;view.dispatch(wrapSelection(view.state,delimiter));view.focus();
}
function prefixLine(prefix: string) {
 if (!view || cellSelection()) return;
 const line = view.state.doc.lineAt(view.state.selection.main.head);
 view.dispatch({changes:{from:line.from,insert:prefix},selection:{anchor:view.state.selection.main.head+prefix.length}});
 view.focus();
}
function insertLink(){
 const cell=cellSelection();
 if(cell){const start=cell.selectionStart,end=cell.selectionEnd;cell.setRangeText('['+(cell.value.slice(start,end)||'enlace')+'](https://)',start,end,'select');cell.dispatchEvent(new Event('input',{bubbles:true}));return;}
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
watch(()=>[props.fileId,props.content,props.sourceMode,props.active],()=>{sync();if(props.active !== false)view?.requestMeasure();},{flush:'post'});
watch(()=>props.openFileIds,ids=>{for(const id of sessions.keys())if(!ids.includes(id))sessions.delete(id);});
onBeforeUnmount(()=>{cancelAnimationFrame(frame);view?.destroy();sessions.clear();});
defineExpose({ focus: () => view?.focus() });
</script>
<template>
 <div class="live-editor" :class="{'live-editor-source': sourceMode}">
  <Teleport v-if="toolbarTarget" :to="toolbarTarget">
  <div class="live-format-toolbar" role="toolbar" aria-label="Formato de la nota" @mousedown.prevent>
   <button type="button" @click="prefixLine('## ')" title="Insertar encabezado">H2</button>
   <button type="button" @click="format('**')" title="Negrita (Ctrl+B)"><strong>B</strong></button>
   <button type="button" @click="format('*')" title="Cursiva (Ctrl+I)"><em>I</em></button>
   <button type="button" @click="format('`')" title="Código">Código</button>
   <button type="button" @click="insertLink" title="Enlace (Ctrl+K)">Enlace</button>
   <button type="button" @click="prefixLine('- [ ] ')" title="Insertar tarea">☑</button>
   <button type="button" @click="view && undo(view)" title="Deshacer" aria-label="Deshacer">↶</button>
   <button type="button" @click="view && redo(view)" title="Rehacer" aria-label="Rehacer">↷</button>
   <span class="live-toolbar-hint">{{ hasSelection ? 'Dar formato a la selección' : '/ Insertar' }}</span>
  </div>
  </Teleport>
  <div ref="host"></div>
 </div>
</template>
