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

md.inline.ruler.before('escape', 'note_math', (state, silent) => {
  const rest = state.src.slice(state.pos);
  const opener = rest.startsWith('\\(') ? '\\(' : rest.startsWith('$') && !rest.startsWith('$$') ? '$' : '';
  if (!opener) return false;
  const closer = opener === '$' ? '$' : '\\)';
  const start = state.pos + opener.length;
  if (opener === '$' && /\s/.test(state.src[start] || ' ')) return false;
  let end = state.src.indexOf(closer, start);
  while (end > 0 && state.src[end - 1] === '\\') end = state.src.indexOf(closer, end + closer.length);
  if (end < 0 || state.src.slice(start, end).includes('\n')) return false;
  if (opener === '$' && (/\s/.test(state.src[end - 1]) || /\d/.test(state.src[end + 1] || ''))) return false;
  if (!silent) { const token = state.push('note_math', '', 0); token.content = state.src.slice(start, end); }
  state.pos = end + closer.length;
  return true;
});
md.renderer.rules.note_math = (tokens, index) => math(tokens[index].content, false);
md.block.ruler.before('fence', 'note_math_block', (state, startLine, endLine, silent) => {
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
    first.content = first.content.slice(match[0].length);
    const checkbox = new state.Token('html_inline', '', 0);
    checkbox.content = '<input type="checkbox" disabled' + (match[1].toLowerCase() === 'x' ? ' checked' : '') + '> ';
    token.children!.unshift(checkbox);
  }
});
export function renderMarkdown(source = ''): string { return md.render(source); }
export function renderMarkdownDocument(source = ''): MarkdownResult {
  const diagrams: MarkdownDiagram[] = [];
  return { html: md.render(source, { diagrams }), diagrams };
}
