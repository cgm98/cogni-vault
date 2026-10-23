import MarkdownIt from 'markdown-it';
import { EditorState } from '@codemirror/state';

export interface PreviewBlock { from: number; to: number; source: string; kind: 'mermaid' | 'table' | 'math'; code?: string }
const parser = new MarkdownIt();
// Positions always refer to the original text, never a reserialized document.
export function previewBlocks(source: string): PreviewBlock[] {
  const lines = source.split('\n');
  const offsets = [0];
  for (const line of lines) offsets.push(offsets[offsets.length - 1] + line.length + 1);
  const result: PreviewBlock[] = [];
  const excluded: Array<[number, number]> = [];
  for (const token of parser.parse(source, {})) {
    if (!token.map) continue;
    const [start, end] = token.map;
    if (token.type === 'fence' || token.type === 'code_block') excluded.push([start, end]);
    const kind = token.type === 'table_open' ? 'table' : token.type === 'fence' && token.info.trim().toLowerCase() === 'mermaid' ? 'mermaid' : null;
    if (!kind || token.level !== 0) continue;
    // Do not replace an unfinished fence while the user is typing.
    if (kind === 'mermaid' && !(lines[end - 1] || '').trim().startsWith(token.markup)) continue;
    const from = offsets[start], to = Math.min(source.length, offsets[end] - 1);
    result.push({ from, to, source: source.slice(from, to), kind, code: token.content });
  }
  for (let i = 0; i < lines.length; i++) {
    if (excluded.some(([start, end]) => i >= start && i < end)) continue;
    const line = lines[i].trim();
    const open = line.startsWith('$$') ? '$$' : line.startsWith('\\[') ? '\\[' : '';
    if (!open) continue;
    const close = open === '$$' ? '$$' : '\\]';
    let end = i;
    if (!line.slice(open.length).endsWith(close)) {
      end = lines.findIndex((l, index) => index > i && l.trim().endsWith(close));
      if (end < 0) continue;
    }
    const from = offsets[i], to = offsets[end] + lines[end].length;
    result.push({ from, to, source: source.slice(from, to), kind: 'math' });
    i = end;
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
