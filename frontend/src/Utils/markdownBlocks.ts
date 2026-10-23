export interface Block {
  id: string;
  type: 'paragraph' | 'heading' | 'code' | 'table' | 'math' | 'bullet' | 'quote' | string;
  content: string;
  level?: number;
  language?: string;
  rows?: string[][];
  parentId?: string | null;
  children?: Block[];
  [key: string]: any;
}

export function markdownToBlocks(markdown: string): Block[] {
  if (!markdown) return [{ id: 'b_1', type: 'paragraph', content: '' }];
  const lines = markdown.split('\n');
  const blocks: Block[] = [];
  let currentParagraph = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#')) {
      if (currentParagraph) {
        blocks.push({ id: `b_${blocks.length}`, type: 'paragraph', content: currentParagraph.trim() });
        currentParagraph = '';
      }
      const match = line.match(/^(#+)\s*(.*)$/);
      blocks.push({
        id: `b_${blocks.length}`,
        type: 'heading',
        level: match ? match[1].length : 1,
        content: match ? match[2] : line
      });
    } else if (line.startsWith('```')) {
      if (currentParagraph) {
        blocks.push({ id: `b_${blocks.length}`, type: 'paragraph', content: currentParagraph.trim() });
        currentParagraph = '';
      }
      const lang = line.replace('```', '').trim();
      let code = '';
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        code += (code ? '\n' : '') + lines[i];
        i++;
      }
      blocks.push({
        id: `b_${blocks.length}`,
        type: 'code',
        language: lang || 'typescript',
        content: code
      });
    } else if (line.startsWith('$$')) {
      if (currentParagraph) {
        blocks.push({ id: `b_${blocks.length}`, type: 'paragraph', content: currentParagraph.trim() });
        currentParagraph = '';
      }
      let math = line.replace(/\$\$/g, '').trim();
      if (!math && i + 1 < lines.length) {
        i++;
        while (i < lines.length && !lines[i].startsWith('$$')) {
          math += (math ? '\n' : '') + lines[i];
          i++;
        }
      }
      blocks.push({
        id: `b_${blocks.length}`,
        type: 'math',
        content: math
      });
    } else if (!line.trim()) {
      if (currentParagraph) {
        blocks.push({ id: `b_${blocks.length}`, type: 'paragraph', content: currentParagraph.trim() });
        currentParagraph = '';
      }
    } else {
      currentParagraph += (currentParagraph ? '\n' : '') + line;
    }
  }

  if (currentParagraph) {
    blocks.push({ id: `b_${blocks.length}`, type: 'paragraph', content: currentParagraph.trim() });
  }

  return blocks.length ? blocks : [{ id: 'b_1', type: 'paragraph', content: '' }];
}

export function blocksToMarkdown(blocks: Block[]): string {
  return blocks.map(b => {
    if (b.type === 'heading') return `${'#'.repeat(b.level || 1)} ${b.content}`;
    if (b.type === 'code') return `\`\`\`${b.language || ''}\n${b.content}\n\`\`\``;
    if (b.type === 'math') return `$$\n${b.content}\n$$`;
    return b.content;
  }).join('\n\n');
}

export function decorateInline(text: string): string {
  return text;
}

export function sanitizeLatex(latex: string): string {
  return latex.trim();
}
