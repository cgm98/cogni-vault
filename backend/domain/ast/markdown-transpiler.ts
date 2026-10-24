import { CanonicalDocumentAst, AstNode, AstMark } from './canonical-ast.types.js';

export function markdownToCanonicalAst(markdown: string): CanonicalDocumentAst {
  const content: AstNode[] = [];
  const lines = markdown.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Líneas vacías
    if (!line.trim()) {
      i++;
      continue;
    }

    // 2. Fórmulas Matemáticas en Bloque ($$ o \[)
    if (line.trim().startsWith('$$') || line.trim().startsWith('\\[')) {
      const isDollars = line.trim().startsWith('$$');
      const closer = isDollars ? '$$' : '\\]';
      const formulaLines: string[] = [];

      let firstContent = line.trim().slice(isDollars ? 2 : 2).trim();
      if (firstContent && firstContent.endsWith(closer) && firstContent.length > closer.length) {
        // En una sola línea: $$a^2 + b^2 = c^2$$
        const expr = firstContent.slice(0, firstContent.length - closer.length).trim();
        content.push({
          type: 'math_block',
          attrs: { latex: expr }
        });
        i++;
        continue;
      }

      if (firstContent) formulaLines.push(firstContent);
      i++;
      while (i < lines.length) {
        const cur = lines[i];
        if (cur.trim().endsWith(closer)) {
          const endContent = cur.trim().slice(0, cur.trim().length - closer.length).trim();
          if (endContent) formulaLines.push(endContent);
          i++;
          break;
        }
        formulaLines.push(cur);
        i++;
      }

      content.push({
        type: 'math_block',
        attrs: { latex: formulaLines.join('\n') }
      });
      continue;
    }

    // 3. Bloques de Código Fenced (``` o ~~~)
    const fenceMatch = line.match(/^(\`\`\`|\~\~\~)([a-zA-Z0-9_\-\+]*)/);
    if (fenceMatch) {
      const fenceChar = fenceMatch[1];
      const lang = fenceMatch[2].toLowerCase().trim();
      const codeLines: string[] = [];
      i++;

      while (i < lines.length) {
        if (lines[i].startsWith(fenceChar)) {
          i++;
          break;
        }
        codeLines.push(lines[i]);
        i++;
      }

      const rawCode = codeLines.join('\n');
      if (lang === 'mermaid') {
        content.push({
          type: 'mermaid_block',
          attrs: { code: rawCode }
        });
      } else {
        content.push({
          type: 'code_block',
          attrs: { language: lang || null },
          text: rawCode
        });
      }
      continue;
    }

    // 4. Encabezados (#..######)
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      content.push({
        type: 'heading',
        attrs: { level },
        content: parseInlineContent(headingMatch[2])
      });
      i++;
      continue;
    }

    // 5. Blockquotes (> ...)
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i].startsWith('>') || (lines[i].trim() && !lines[i].startsWith('#')))) {
        if (lines[i].startsWith('>')) {
          quoteLines.push(lines[i].replace(/^>\s?/, ''));
        } else {
          quoteLines.push(lines[i]);
        }
        i++;
      }
      content.push({
        type: 'blockquote',
        content: markdownToCanonicalAst(quoteLines.join('\n')).content
      });
      continue;
    }

    // 6. Tablas (| ... | ... |)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableRows: AstNode[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        const cur = lines[i].trim();
        // Ignorar fila divisoria |---|---|
        if (!/^[\|\s\-:]+$/.test(cur)) {
          const rawCells = cur.slice(1, -1).split('|').map(c => c.trim());
          const cells: AstNode[] = rawCells.map(c => ({
            type: 'table_cell',
            content: parseInlineContent(c)
          }));
          tableRows.push({
            type: 'table_row',
            content: cells
          });
        }
        i++;
      }
      if (tableRows.length > 0) {
        content.push({
          type: 'table',
          content: tableRows
        });
      }
      continue;
    }

    // 7. Task Lists (- [ ] o - [x])
    const taskMatch = line.match(/^(\-|\*)\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      const taskItems: AstNode[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\-|\*)\s+\[([ xX])\]\s+(.*)$/);
        if (!m) break;
        const checked = m[2].toLowerCase() === 'x';
        taskItems.push({
          type: 'task_item',
          attrs: { checked },
          content: parseInlineContent(m[3])
        });
        i++;
      }
      content.push({
        type: 'task_list',
        content: taskItems
      });
      continue;
    }

    // 8. Listas ordenadas (1. ...)
    if (/^\d+\.\s+/.test(line)) {
      const listItems: AstNode[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^\d+\.\s+/, '');
        listItems.push({
          type: 'list_item',
          content: parseInlineContent(itemText)
        });
        i++;
      }
      content.push({
        type: 'ordered_list',
        content: listItems
      });
      continue;
    }

    // 9. Listas no ordenadas (- o * ...)
    if (/^[\-\*]\s+/.test(line)) {
      const listItems: AstNode[] = [];
      while (i < lines.length && /^[\-\*]\s+/.test(lines[i]) && !lines[i].includes('[ ]') && !lines[i].includes('[x]')) {
        const itemText = lines[i].replace(/^[\-\*]\s+/, '');
        listItems.push({
          type: 'list_item',
          content: parseInlineContent(itemText)
        });
        i++;
      }
      content.push({
        type: 'bullet_list',
        content: listItems
      });
      continue;
    }

    // 10. Párrafo estándar
    const paragraphLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('~~~') &&
      !lines[i].startsWith('$$') &&
      !lines[i].startsWith('\\[') &&
      !lines[i].startsWith('>') &&
      !lines[i].startsWith('|') &&
      !/^[\-\*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i])
    ) {
      paragraphLines.push(lines[i]);
      i++;
    }

    content.push({
      type: 'paragraph',
      content: parseInlineContent(paragraphLines.join('\n'))
    });
  }

  return {
    schema_version: 1,
    type: 'doc',
    content
  };
}

export function canonicalAstToMarkdown(ast: CanonicalDocumentAst): string {
  const blocks: string[] = [];

  for (const node of ast.content) {
    blocks.push(renderBlockNode(node));
  }

  return blocks.filter(Boolean).join('\n\n');
}

function renderBlockNode(node: AstNode): string {
  switch (node.type) {
    case 'heading': {
      const level = node.attrs?.level || 1;
      const prefix = '#'.repeat(level);
      const text = renderInlineContent(node.content || []);
      return `${prefix} ${text}`;
    }
    case 'paragraph': {
      return renderInlineContent(node.content || []);
    }
    case 'mermaid_block': {
      return `\`\`\`mermaid\n${node.attrs?.code || ''}\n\`\`\``;
    }
    case 'code_block': {
      const lang = node.attrs?.language || '';
      return `\`\`\`${lang}\n${node.text || ''}\n\`\`\``;
    }
    case 'math_block': {
      return `$$\n${node.attrs?.latex || ''}\n$$`;
    }
    case 'blockquote': {
      const inner = node.content ? node.content.map(renderBlockNode).join('\n\n') : '';
      return inner.split('\n').map(l => `> ${l}`).join('\n');
    }
    case 'task_list': {
      if (!node.content) return '';
      return node.content.map(item => {
        const mark = item.attrs?.checked ? '[x]' : '[ ]';
        const txt = renderInlineContent(item.content || []);
        return `- ${mark} ${txt}`;
      }).join('\n');
    }
    case 'bullet_list': {
      if (!node.content) return '';
      return node.content.map(item => {
        const txt = renderInlineContent(item.content || []);
        return `- ${txt}`;
      }).join('\n');
    }
    case 'ordered_list': {
      if (!node.content) return '';
      return node.content.map((item, idx) => {
        const txt = renderInlineContent(item.content || []);
        return `${idx + 1}. ${txt}`;
      }).join('\n');
    }
    case 'table': {
      if (!node.content || node.content.length === 0) return '';
      const rows: string[] = [];
      const headerRow = node.content[0];
      const colCount = headerRow.content?.length || 0;

      // Fila de encabezado
      const headerCells = (headerRow.content || []).map(cell => renderInlineContent(cell.content || []));
      rows.push(`| ${headerCells.join(' | ')} |`);

      // Divisor
      const dividerCells = Array(colCount).fill('---');
      rows.push(`| ${dividerCells.join(' | ')} |`);

      // Filas de cuerpo
      for (let i = 1; i < node.content.length; i++) {
        const r = node.content[i];
        const cells = (r.content || []).map(cell => renderInlineContent(cell.content || []));
        rows.push(`| ${cells.join(' | ')} |`);
      }
      return rows.join('\n');
    }
    default:
      return '';
  }
}

function parseInlineContent(text: string): AstNode[] {
  const nodes: AstNode[] = [];
  let remaining = text;

  // Regex para tokens inline prioritarios:
  // 1. Wikilinks [[target|alias]] o [[target]]
  // 2. Math inline $...$
  // 3. Inline code `...`
  // 4. Bold **...**
  // 5. Italic *...*
  const inlinePattern = /(\[\[([^\]\|]+)(?:\|([^\]]+))?\]\]|\$([^\$\n]+)\$|\`([^\`]+)\`|\*\*([^\*]+)\*\*|\*([^\*]+)\*)/;

  while (remaining.length > 0) {
    const match = remaining.match(inlinePattern);
    if (!match || match.index === undefined) {
      nodes.push({ type: 'text', text: remaining });
      break;
    }

    if (match.index > 0) {
      nodes.push({ type: 'text', text: remaining.slice(0, match.index) });
    }

    const matchedStr = match[0];

    if (matchedStr.startsWith('[[')) {
      // Wikilink
      const target = match[2];
      const alias = match[3] || null;
      nodes.push({
        type: 'wikilink',
        attrs: { target, alias }
      });
    } else if (matchedStr.startsWith('$')) {
      // Inline math
      const latex = match[4];
      nodes.push({
        type: 'math_inline',
        attrs: { latex }
      });
    } else if (matchedStr.startsWith('`')) {
      // Inline code
      const codeText = match[5];
      nodes.push({
        type: 'text',
        text: codeText,
        marks: [{ type: 'code' }]
      });
    } else if (matchedStr.startsWith('**')) {
      // Bold
      const boldText = match[6];
      nodes.push({
        type: 'text',
        text: boldText,
        marks: [{ type: 'bold' }]
      });
    } else if (matchedStr.startsWith('*')) {
      // Italic
      const italicText = match[7];
      nodes.push({
        type: 'text',
        text: italicText,
        marks: [{ type: 'italic' }]
      });
    }

    remaining = remaining.slice(match.index + matchedStr.length);
  }

  return nodes;
}

function renderInlineContent(nodes: AstNode[]): string {
  return nodes.map(node => {
    if (node.type === 'wikilink') {
      const target = node.attrs?.target || '';
      const alias = node.attrs?.alias;
      return alias ? `[[${target}|${alias}]]` : `[[${target}]]`;
    }
    if (node.type === 'math_inline') {
      return `$${node.attrs?.latex || ''}$`;
    }
    if (node.type === 'text') {
      let txt = node.text || '';
      if (node.marks) {
        for (const mark of node.marks) {
          if (mark.type === 'code') txt = `\`${txt}\``;
          if (mark.type === 'bold') txt = `**${txt}**`;
          if (mark.type === 'italic') txt = `*${txt}*`;
        }
      }
      return txt;
    }
    return '';
  }).join('');
}
