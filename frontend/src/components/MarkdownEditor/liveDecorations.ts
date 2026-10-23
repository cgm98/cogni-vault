import { StateField, StateEffect, type Range } from '@codemirror/state';
import { EditorView, Decoration, WidgetType, type DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { createApp, type App } from 'vue';
import DOMPurify from 'dompurify';
import MermaidRenderer from '../MermaidRenderer/Index.vue';
import { renderMarkdown } from '../../lib/markdown';
import { previewBlocks, selectionTouches } from './liveDocument';

const blockCache = new WeakMap<import('@codemirror/state').Text, ReturnType<typeof previewBlocks>>();
export const liveModeEffect = StateEffect.define<boolean>();
export const focusEffect = StateEffect.define<boolean>();
const widgetApps = new WeakMap<HTMLElement, App>();
class PreviewWidget extends WidgetType {
  constructor(readonly source: string, readonly from: number, readonly kind: string, readonly code = '', readonly inline = false) { super(); }
  eq(other: PreviewWidget) { return this.source === other.source && this.from === other.from && this.kind === other.kind && this.inline === other.inline; }
  toDOM(view: EditorView) {
    const dom = document.createElement(this.inline ? 'span' : 'div');
    dom.className = this.inline ? 'cm-live-inline' : 'cm-live-preview markdown-reading';
    if (this.kind === 'mermaid') { const app = createApp(MermaidRenderer, { code: this.code }); app.mount(dom); widgetApps.set(dom, app); }
    else dom.innerHTML = DOMPurify.sanitize(renderMarkdown(this.source));
    const reveal = () => { view.dispatch({ selection: { anchor: this.from }, scrollIntoView: true }); view.focus(); };
    if (!this.inline) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'cm-edit-block'; button.textContent = 'Editar ' + (this.kind === 'mermaid' ? 'diagrama' : this.kind === 'table' ? 'tabla' : 'fórmula'); button.onclick = reveal; dom.append(button);
    } else { dom.onclick = reveal; dom.title = 'Editar fórmula'; }
    return dom;
  }
  destroy(dom: HTMLElement) { widgetApps.get(dom)?.unmount(); widgetApps.delete(dom); }
  ignoreEvent() { return true; }
}
class TaskWidget extends WidgetType {
  constructor(readonly from: number, readonly checked: boolean) { super(); }
  eq(other: TaskWidget) { return other.from === this.from && other.checked === this.checked; }
  toDOM(view: EditorView) {
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = this.checked; input.setAttribute('aria-label', this.checked ? 'Marcar tarea pendiente' : 'Completar tarea');
    input.onchange = () => view.dispatch({ changes: { from: this.from + 1, to: this.from + 2, insert: input.checked ? 'x' : ' ' } });
    return input;
  }
  ignoreEvent() { return true; }
}
export const liveDecorations = StateField.define<{ decorations: DecorationSet; enabled: boolean; focused: boolean }>({
  create(state) { return { decorations: build(state, false), enabled: true, focused: false }; },
  update(value, tr) {
    let { enabled, focused } = value;
    for (const effect of tr.effects) {
      if (effect.is(liveModeEffect)) enabled = effect.value;
      if (effect.is(focusEffect)) focused = effect.value;
    }
    if (!tr.docChanged && !tr.selection && !tr.effects.length && syntaxTree(tr.state) === syntaxTree(tr.startState)) return value;
    return { enabled, focused, decorations: enabled ? build(tr.state, focused) : Decoration.none };
  },
  provide: field => EditorView.decorations.from(field, value => value.decorations)
});
function build(state: import('@codemirror/state').EditorState, focused: boolean): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  const source = state.doc.toString();
  let blocks = blockCache.get(state.doc);
  if (!blocks) { blocks = previewBlocks(source); blockCache.set(state.doc, blocks); }
  const hidden: Array<[number, number]> = [];
  const add = (from: number, to: number, decoration: Decoration) => { if (to > from) ranges.push(decoration.range(from, to)); };
  for (const block of blocks) {
    const widget = new PreviewWidget(block.source, block.from, block.kind, block.code);
    if (focused && selectionTouches(state, block.from, block.to)) {
      // Keep the source editable and the preview below it while editing the block.
      ranges.push(Decoration.widget({ widget, block: true, side: 1 }).range(block.to));
    } else {
      add(block.from, block.to, Decoration.replace({ widget, block: true }));
      hidden.push([block.from, block.to]);
    }
  }
  const isHidden = (from: number, to: number) => hidden.some(([a,b]) => from >= a && to <= b);
  const active = (from: number, to: number) => focused && selectionTouches(state, from, to);
  const code: Array<[number, number]> = [];
  syntaxTree(state).iterate({ enter(node) {
    const { from, to, name } = node;
    if (isHidden(from,to)) return false;
    if (['FencedCode','CodeBlock','InlineCode'].includes(name)) code.push([from,to]);
    if (/^ATXHeading[1-6]$/.test(name)) ranges.push(Decoration.line({ class: 'cm-live-h' + name.slice(-1) }).range(state.doc.lineAt(from).from));
    if (name === 'StrongEmphasis') add(from,to,Decoration.mark({class:'cm-live-strong'}));
    if (name === 'Emphasis') add(from,to,Decoration.mark({class:'cm-live-em'}));
    if (name === 'Strikethrough') add(from,to,Decoration.mark({class:'cm-live-strike'}));
    if (name === 'InlineCode') add(from,to,Decoration.mark({class:'cm-live-code'}));
    if (name === 'Link') {
      const url = node.node.getChild('URL');
      add(from,to,Decoration.mark({class:'cm-live-link',attributes:url ? {'data-external-link':state.sliceDoc(url.from,url.to)} : {}}));
    }
    if ((name === 'LinkMark' || name === 'URL') && node.node.parent?.name === 'Link' && !active(node.node.parent.from,node.node.parent.to)) add(from,to,Decoration.replace({}));
    if (name === 'Image' && !active(from,to)) { add(from,to,Decoration.replace({widget:new PreviewWidget(state.sliceDoc(from,to),from,'image','',true)})); return false; }
    if (name === 'FencedCode' && !blocks.some(block => block.from === from)) {
      for(let number=state.doc.lineAt(from).number;number<=state.doc.lineAt(to).number;number++) ranges.push(Decoration.line({class:'cm-live-code-line'}).range(state.doc.line(number).from));
      if(!active(from,to)) {
        const first=state.doc.lineAt(from),last=state.doc.lineAt(to);
        add(first.from,first.to,Decoration.replace({}));
        if(last.from>first.from && /^\s*(`{3,}|~{3,})\s*$/.test(last.text))add(last.from,last.to,Decoration.replace({}));
      }
    }
    if (name === 'Blockquote') {
      for (let number=state.doc.lineAt(from).number; number<=state.doc.lineAt(to).number; number++) ranges.push(Decoration.line({class:'cm-live-quote'}).range(state.doc.line(number).from));
    }
    if (['HeaderMark','EmphasisMark','CodeMark','StrikethroughMark','QuoteMark'].includes(name)) {
      const parent = node.node.parent;
      if (parent && !active(parent.from,parent.to) && !['FencedCode','CodeBlock'].includes(parent.name)) add(from,to,Decoration.replace({}));
    }
    if (name === 'TaskMarker' && !active(state.doc.lineAt(from).from,state.doc.lineAt(to).to)) add(from,to,Decoration.replace({widget:new TaskWidget(from,source.slice(from,to).toLowerCase()==='[x]')}));
  }});
  // Additional note syntax absent from CommonMark; never interpret it inside code.
  const outsideCode = (from: number,to: number) => !isHidden(from,to) && !code.some(([a,b]) => from < b && to > a) && !blocks.some(b=>from>=b.from&&to<=b.to);
  for (const match of source.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
    const from=match.index!,to=from+match[0].length;
    if (!outsideCode(from,to)) continue;
    add(from,to,Decoration.mark({class:'cm-live-link',attributes:{'data-note-link':match[1].split('|')[0]}}));
    if (!active(from,to)) { const alias = match[1].indexOf('|'); add(from,from+2+(alias >= 0 ? alias+1 : 0),Decoration.replace({})); add(to-2,to,Decoration.replace({})); }
  }
  for (const match of source.matchAll(/(?<![\\$])\$(?![\s$])([^\n$]*?\S)\$(?!\d)/g)) {
    const from=match.index!,to=from+match[0].length;
    if (outsideCode(from,to) && !active(from,to)) add(from,to,Decoration.replace({widget:new PreviewWidget(match[0],from,'math','',true)}));
  }
  return Decoration.set(ranges,true);
}
