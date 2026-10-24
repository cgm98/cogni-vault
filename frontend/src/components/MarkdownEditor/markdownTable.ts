export type Alignment = 'left' | 'center' | 'right' | null;
export interface MarkdownTable { rows: string[][]; alignments: Alignment[] }

export function splitTableRow(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  const source = line.trim();
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\\' && source[i + 1] === '|') { cell += '|'; i++; }
    else if (source[i] === '|') { cells.push(cell.trim()); cell = ''; }
    else cell += source[i];
  }
  cells.push(cell.trim());
  if (source.startsWith('|')) cells.shift();
  if (source.endsWith('|') && !source.endsWith('\\|')) cells.pop();
  return cells;
}

export function parseMarkdownTable(source: string): MarkdownTable {
  const lines = source.trim().split(/\r\n|\r|\n/);
  const header = splitTableRow(lines[0] || '| Columna |');
  const separators = splitTableRow(lines[1] || '');
  const alignments = header.map((_, i): Alignment => {
    const cell = separators[i] || '';
    return cell.startsWith(':') && cell.endsWith(':') ? 'center' : cell.endsWith(':') ? 'right' : cell.startsWith(':') ? 'left' : null;
  });
  const rows = [header, ...lines.slice(2).map(splitTableRow)].map(row => header.map((_, i) => row[i] || ''));
  return { rows, alignments };
}

export function serializeMarkdownTable(table: MarkdownTable): string {
  const row = (cells: string[]) => '| ' + cells.map(cell => cell.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|')).join(' | ') + ' |';
  const separator = table.alignments.map(a => a === 'center' ? ':---:' : a === 'right' ? '---:' : a === 'left' ? ':---' : '---');
  return [row(table.rows[0]), row(separator), ...table.rows.slice(1).map(row)].join('\n');
}

export function pasteTableCells(table: MarkdownTable, row: number, column: number, text: string): MarkdownTable {
  const result = { rows: table.rows.map(r => [...r]), alignments: [...table.alignments] };
  const pasted = text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').map(r => r.split('\t'));
  const width = Math.max(result.alignments.length, column + Math.max(...pasted.map(r => r.length)));
  while (result.alignments.length < width) result.alignments.push(null);
  while (result.rows.length < row + pasted.length) result.rows.push([]);
  for (const cells of result.rows) while (cells.length < width) cells.push('');
  pasted.forEach((cells, r) => cells.forEach((cell, c) => { result.rows[row + r][column + c] = cell; }));
  return result;
}
