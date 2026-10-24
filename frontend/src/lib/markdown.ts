import MarkdownIt from 'markdown-it';
import katex from 'katex';
import hljs from 'highlight.js';

export interface MarkdownDiagram { code: string; index: number }
export interface MarkdownResult { html: string; diagrams: MarkdownDiagram[] }
const md = new MarkdownIt({ html: false, linkify: true, breaks: false,
  highlight(code, language) {
    return language && hljs.getLanguage(language) ? hljs.highlight(code, { language, ignoreIllegals: true }).value : '';
  }
});
const escape = md.utils.escapeHtml;
const math = (source: string, displayMode: boolean) => katex.renderToString(source, { displayMode, throwOnError: false, trust: false, strict: 'ignore' });

export function inlineMathAt(source: string, position: number): {from:number;to:number;content:string} | null {
  const escaped = (at: number) => { let n=0; while(at>0 && source[--at] === '\\') n++; return n%2===1; };
  if (escaped(position)) return null;
  const opener = source.startsWith('\\(',position) ? '\\(' : source[position] === '$' && source[position-1] !== '$' && source[position+1] !== '$' ? '$' : '';
  if (!opener) return null;
  const closer = opener === '$' ? '$' : '\\)';
  const start = position + opener.length;
  if (opener === '$' && /\s/.test(source[start] || ' ')) return null;
  let end = source.indexOf(closer,start);
  while(end>=0 && escaped(end)) end=source.indexOf(closer,end+closer.length);
  if(end<0 || !source.slice(start,end).trim() || source.slice(start,end).includes('\n')) return null;
  if(opener==='$' && (/\s/.test(source[end-1]) || /\d/.test(source[end+1] || '') || source[end+1]==='$')) return null;
  return {from:position,to:end+closer.length,content:source.slice(start,end)};
}
export function inlineMathRanges(source: string) {
  const ranges: Array<{from:number;to:number;content:string}> = [];
  for(let i=0;i<source.length;i++) { const match=inlineMathAt(source,i); if(match){ranges.push(match);i=match.to-1;} }
  return ranges;
}
md.inline.ruler.before('escape', 'note_math', (state, silent) => {
  const match=inlineMathAt(state.src,state.pos);
  if(!match)return false;
  if(!silent){const token=state.push('note_math','',0);token.content=match.content;}
  state.pos=match.to;return true;
});
md.renderer.rules.note_math = (tokens, index) => math(tokens[index].content, false);
md.block.ruler.before('fence', 'note_math_block', (state, startLine, endLine, silent) => {
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  const first = state.src.slice(state.bMarks[startLine] + state.tShift[startLine], state.eMarks[startLine]);
  const opener = first.startsWith('$$') ? '$$' : first.startsWith('\\[') ? '\\[' : '';
  if (!opener) return false;
  const closer = opener === '$$' ? '$$' : '\\]';
  const parts: string[] = [];
  let line = startLine;
  let fragment = first.slice(opener.length);
  while (true) {
    const end = fragment.indexOf(closer);
    if (end >= 0 && !fragment.slice(end + closer.length).trim()) {
      parts.push(fragment.slice(0, end)); break;
    }
    parts.push(fragment);
    if (++line >= endLine) return false; // Incomplete math remains ordinary source text.
    fragment = state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
  }
  if (silent) return true;
  const token = state.push('note_math_block', 'div', 0);
  token.block = true; token.content = parts.join('\n'); token.map = [startLine, line + 1];
  state.line = line + 1;
  return true;
}, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
md.renderer.rules.note_math_block = (tokens, index) => '<div class="note-math">' + math(tokens[index].content, true) + '</div>\n';
md.inline.ruler.before('link', 'note_wikilink', (state, silent) => {
  if (state.linkLevel > 0 || !state.src.startsWith('[[', state.pos)) return false;
  const end = state.src.indexOf(']]', state.pos + 2);
  if (end < 0) return false;
  const [target, label] = state.src.slice(state.pos + 2, end).split('|');
  if (!target.trim()) return false;
  if (!silent) { const token = state.push('note_wikilink', '', 0); token.content = label || target; token.meta = { target: target.trim() }; }
  state.pos = end + 2; return true;
});
md.renderer.rules.note_wikilink = (tokens, index) => '<a href="#" data-note-link="' + escape(String(tokens[index].meta?.target || '')) + '">' + escape(tokens[index].content) + '</a>';
const fence = md.renderer.rules.fence!;
md.renderer.rules.fence = (tokens, index, options, env, renderer) => {
  const token = tokens[index];
  if (['math','latex','tex'].includes(token.info.trim().split(/\s+/)[0].toLowerCase())) return '<div class="note-math">' + math(token.content,true) + '</div>\n';
  if (token.info.trim().split(/\s+/)[0].toLowerCase() !== 'mermaid' || !Array.isArray(env.diagrams)) return fence(tokens, index, options, env, renderer);
  const diagram = { index: env.diagrams.length, code: token.content };
  env.diagrams.push(diagram);
  return '<div class="note-diagram" data-mermaid-index="' + diagram.index + '"></div>\n';
};
// Tasks are represented as disabled checkboxes in reading mode, never as editable HTML.
md.core.ruler.after('inline', 'note_tasks', state => {
  for (let i = 2; i < state.tokens.length; i++) {
    const token = state.tokens[i];
    if (token.type !== 'inline' || state.tokens[i - 1].type !== 'paragraph_open' || state.tokens[i - 2].type !== 'list_item_open') continue;
    const first = token.children?.[0];
    const match = first?.type === 'text' && first.content.match(/^\[([ xX])\]\s+/);
    if (!match || !first) continue;
    state.tokens[i - 2].attrJoin('class', 'task-list-item');
    first.content = first.content.slice(match[0].length);
    const checkbox = new state.Token('html_inline', '', 0);
    checkbox.content = '<input type="checkbox" disabled' + (match[1].toLowerCase() === 'x' ? ' checked' : '') + '> ';
    token.children!.unshift(checkbox);
  }
});
// The editor and reading view share tokens and source maps, including math rules.
export function parseMarkdown(source = '') { return md.parse(source, {}); }
export function renderMarkdown(source = ''): string { return md.render(source); }
export function renderMarkdownDocument(source = ''): MarkdownResult {
  const diagrams: MarkdownDiagram[] = [];
  return { html: md.render(source, { diagrams }), diagrams };
}
