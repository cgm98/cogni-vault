import { parseMarkdown } from '../../lib/markdown';
import { EditorState } from '@codemirror/state';

export interface PreviewBlock { from: number; to: number; source: string; kind: 'mermaid' | 'table' | 'math' | 'code' | 'rule'; code?: string }
// Positions always refer to the original text, never a reserialized document.
export function previewBlocks(source: string): PreviewBlock[] {
  // markdown-it normalizes CRLF and lone CR before producing token line maps.
  const lines = source.split(/\r\n|\r|\n/);
  const offsets = [0];
  for (const match of source.matchAll(/\r\n|\r|\n/g)) offsets.push(match.index! + match[0].length);
  const result: PreviewBlock[] = [];
  for (const token of parseMarkdown(source)) {
    if (!token.map || token.level !== 0) continue;
    const [start, end] = token.map;
    const kind: PreviewBlock['kind'] | null = token.type === 'table_open' ? 'table'
      : token.type === 'note_math_block' ? 'math'
      : token.type === 'hr' ? 'rule'
      : token.type === 'code_block' ? 'code'
      : token.type === 'fence' ? (token.info.trim().split(/\s+/)[0].toLowerCase() === 'mermaid' ? 'mermaid' : ['math','latex','tex'].includes(token.info.trim().split(/\s+/)[0].toLowerCase()) ? 'math' : 'code') : null;
    if (!kind) continue;
    // Do not replace an unfinished fence while the user is typing.
    if (token.type === 'fence') {
      const closing = (lines[end - 1] || '').trim();
      if (end - start < 2 || !new RegExp('^' + token.markup[0] + '{' + token.markup.length + ',}\\s*$').test(closing)) continue;
    }
    const from = offsets[start], to = Math.min(source.length, offsets[end - 1] + lines[end - 1].length);
    result.push({ from, to, source: source.slice(from, to), kind, code: token.content });
  }
  return result.sort((a,b) => a.from - b.from);
}
export function selectionTouches(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some(range => range.from <= to && range.to >= from);
}
export function wrapSelection(state: EditorState, delimiter: string) {
  const { from, to } = state.selection.main;
  const selected = state.sliceDoc(from, to);
  if (from >= delimiter.length && state.sliceDoc(from - delimiter.length, from) === delimiter && state.sliceDoc(to, to + delimiter.length) === delimiter) {
    return { changes: [{ from: from - delimiter.length, to: from, insert: '' }, { from: to, to: to + delimiter.length, insert: '' }], selection: { anchor: from - delimiter.length, head: to - delimiter.length } };
  }
  return { changes: { from, to, insert: delimiter + selected + delimiter }, selection: { anchor: from + delimiter.length, head: to + delimiter.length } };
}
