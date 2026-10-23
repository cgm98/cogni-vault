import type { ComputedRef, Ref } from 'vue';
import { Block } from '../../../Utils/markdownBlocks';

// Formateo y exportación (Markdown / imagen PNG) del contenido de un bloque
// de código. Extraído de CodeBlock.vue: era una de las cuatro
// responsabilidades mezcladas en ese archivo (ver docs de auditoría).
export function useCodeExport(
  props: { block: Block },
  codeRef: Ref<HTMLElement | null>,
  highlightedCode: ComputedRef<string>,
  updateBlock: (id: string, patch: Partial<Block>) => void
) {
  const getNoteTitle = (fallback: string) => {
    const t = document.querySelector<HTMLInputElement>('.concept-modal-title-input')?.value ||
      document.querySelector<HTMLInputElement>('.metadata-title-input')?.value ||
      document.querySelector<HTMLElement>('.tab-item.tab-active .tab-name')?.innerText;
    return t ? t.trim().replace(/[^a-zA-Z0-9-ñÑáéíóúÁÉÍÓÚ\s]/g, '').trim().replace(/\s+/g, '-') : fallback;
  };

  const formatNonStringParts = (text: string) => {
    return text
      .replace(/\s*(=>|===|!==|==|!=|\+=|-=|\*=|\/=|<=|>=|&&|\|\||=|<|>)\s*/g, ' $1 ')
      .replace(/\b(if|for|while|catch|switch)\s*\(/g, '$1 (')
      .replace(/,\s*/g, ', ')
      .replace(/\)\s*\{/g, ') {')
      .replace(/:(?!\/\/)\s*/g, ': ')
      .replace(/\s+/g, ' ');
  };

  const beautifyLine = (line: string, lang: string) => {
    const targetLangs = ['javascript', 'typescript', 'json', 'css', 'c', 'cpp', 'csharp', 'java', 'php', 'rust', 'go', 'sql', 'mysql', 'postgres', 'mariadb', 'plaintext'];
    if (!targetLangs.includes(lang)) {
      return line;
    }

    let formatted = line;

    let comment = '';
    const commentIdx = formatted.indexOf('//');
    if (commentIdx !== -1) {
      comment = formatted.slice(commentIdx);
      formatted = formatted.slice(0, commentIdx);
    }

    const stringRegex = /(["'`])(.*?)\1/g;
    let lastIndex = 0;
    let result = '';
    let match;

    while ((match = stringRegex.exec(formatted)) !== null) {
      const codePart = formatted.slice(lastIndex, match.index);
      result += formatNonStringParts(codePart);
      result += match[0];
      lastIndex = stringRegex.lastIndex;
    }

    const remainingCode = formatted.slice(lastIndex);
    result += formatNonStringParts(remainingCode);

    const leadingSpaces = line.match(/^\s*/)?.[0] || '';
    const trimmedResult = result.trim();

    let finalLine = leadingSpaces + trimmedResult;
    if (comment) {
      finalLine = finalLine.trimEnd() + ' ' + comment;
    }
    return finalLine;
  };

  const formatCode = () => {
    try {
      let content = props.block.content || '';
      if (!content.trim()) return;

      const lang = (props.block.language || 'plaintext').toLowerCase();

      if (lang === 'json') {
        try {
          const parsed = JSON.parse(content);
          const formatted = JSON.stringify(parsed, null, 2);
          updateBlock(props.block.id, { content: formatted });
          if (codeRef.value) codeRef.value.innerText = formatted;
          return;
        } catch (e) {
          // Fallback generic
        }
      }

      const lines = content.split(/\r?\n/);
      let trimmedLines = lines.map(line => line.trimEnd());

      let minIndent = Infinity;
      for (const line of trimmedLines) {
        if (line.trim().length === 0) continue;
        const match = line.match(/^(\s*)/);
        if (match) {
          minIndent = Math.min(minIndent, match[1].length);
        }
      }

      if (minIndent > 0 && minIndent !== Infinity) {
        trimmedLines = trimmedLines.map(line => {
          if (line.trim().length === 0) return '';
          return line.slice(minIndent);
        });
      }

      const indentStep = '  ';
      let indentLevel = 1;
      const isPythonOrYaml = ['python', 'yaml', 'yml'].includes(lang);

      trimmedLines = trimmedLines.map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '';

        if (isPythonOrYaml) {
          const startsWithOutdent = /^(elif|else|except|finally)\b/.test(trimmed);
          if (startsWithOutdent) {
            indentLevel = Math.max(0, indentLevel - 1);
          }

          const formattedLine = indentStep.repeat(indentLevel) + trimmed;

          if (trimmed.endsWith(':')) {
            indentLevel++;
          }

          return formattedLine;
        } else {
          let lineIndent = indentLevel;
          let scanLevel = indentLevel;

          const leadingCloseMatch = trimmed.match(/^[}\s\]]+/);
          if (leadingCloseMatch) {
            const closesCount = (leadingCloseMatch[0].match(/[}\]]/g) || []).length;
            lineIndent = Math.max(0, indentLevel - closesCount);
          }

          for (let i = 0; i < trimmed.length; i++) {
            const char = trimmed[i];
            if (char === '{' || char === '[') {
              scanLevel++;
            } else if (char === '}' || char === ']') {
              scanLevel = Math.max(0, scanLevel - 1);
            }
          }

          const beautified = beautifyLine(trimmed, lang);
          const formattedLine = indentStep.repeat(lineIndent) + beautified;
          indentLevel = scanLevel;
          return formattedLine;
        }
      });

      const result = trimmedLines.join('\n').trim();
      updateBlock(props.block.id, { content: result });
      if (codeRef.value) {
        codeRef.value.innerText = result;
      }
    } catch (e) {
      console.error("Error formatting code", e);
    }
  };

  const exportAsMarkdown = () => {
    const codeContent = props.block.content || '';
    const markdownText = `\`\`\`${props.block.language || 'plaintext'}\n${codeContent}\n\`\`\``;
    const blob = new Blob([markdownText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = getNoteTitle(`codigo-${props.block.language || 'plaintext'}`) + '.md';
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStyleColor = (className: string, isLight: boolean) => {
    const style = window.getComputedStyle(document.documentElement);
    const getVar = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;

    if (className.includes('hljs-comment') || className.includes('hljs-quote') || className.includes('hljs-meta')) {
      return getVar('--c-muted', '#888888');
    }
    if (className.includes('hljs-keyword') || className.includes('hljs-selector-tag') || className.includes('hljs-literal') || className.includes('hljs-section') || className.includes('hljs-link')) {
      return getVar('--c-primary', isLight ? '#7b5cea' : '#a78bfa');
    }
    if (className.includes('hljs-attribute') || className.includes('hljs-number') || className.includes('hljs-symbol') || className.includes('hljs-bullet') || className.includes('hljs-regexp') || className.includes('hljs-variable') || className.includes('hljs-template-variable')) {
      return getVar('--c-secondary', isLight ? '#0ea5e9' : '#38bdf8');
    }
    if (className.includes('hljs-string') || className.includes('hljs-type') || className.includes('hljs-title.class_')) {
      return getVar('--c-warning', isLight ? '#d97706' : '#fbbf24');
    }
    if (className.includes('hljs-title') || className.includes('hljs-name') || className.includes('hljs-attr') || className.includes('hljs-tag') || className.includes('hljs-template-tag')) {
      return getVar('--c-success', isLight ? '#059669' : '#34d399');
    }
    if (className.includes('hljs-built_in') || className.includes('hljs-selector-id') || className.includes('hljs-selector-class') || className.includes('hljs-selector-attr') || className.includes('hljs-selector-pseudo') || className.includes('hljs-addition')) {
      return getVar('--c-accent', isLight ? '#db2777' : '#f472b6');
    }
    if (className.includes('hljs-deletion')) {
      return getVar('--c-danger', isLight ? '#e11d48' : '#fb7185');
    }
    if (className.includes('hljs-punctuation') || className.includes('hljs-operator')) {
      return getVar('--c-fg', isLight ? '#333333' : '#e5e5e5');
    }
    return getVar('--c-fg', isLight ? '#333333' : '#e5e5e5');
  };

  const captureCodeAsImage = (codeText: string) => {
    const lines = codeText.split('\n');
    const fontSize = 14;
    const lineHeight = 20;
    const padding = 24;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.font = '14px Courier New, monospace';
    let maxWidth = 400;
    for (const line of lines) {
      const width = ctx.measureText(line).width;
      if (width > maxWidth) maxWidth = width;
    }

    canvas.width = Math.ceil(maxWidth + padding * 2);
    canvas.height = Math.ceil(lines.length * lineHeight + padding * 2);

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    ctx.fillStyle = isLight ? '#f5f5f5' : '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = isLight ? '#e5e5e5' : '#2d2d2d';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = isLight ? '#333333' : '#d4d4d4';
    ctx.font = '14px Courier New, monospace';
    ctx.textBaseline = 'top';

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = highlightedCode.value;

    let currentX = padding;
    let currentY = padding;

    const drawNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const nodeLines = text.split('\n');
        for (let i = 0; i < nodeLines.length; i++) {
          if (i > 0) {
            currentX = padding;
            currentY += lineHeight;
          }
          const lineText = nodeLines[i];
          if (lineText) {
            ctx.fillText(lineText, currentX, currentY);
            currentX += ctx.measureText(lineText).width;
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const originalColor = ctx.fillStyle;
        const originalFont = ctx.font;

        const color = getStyleColor(el.className, isLight);
        ctx.fillStyle = color;

        if (el.className.includes('hljs-emphasis')) {
          ctx.font = 'italic 14px Courier New, monospace';
        } else if (el.className.includes('hljs-strong')) {
          ctx.font = 'bold 14px Courier New, monospace';
        }

        for (let i = 0; i < el.childNodes.length; i++) {
          drawNode(el.childNodes[i]);
        }

        ctx.fillStyle = originalColor;
        ctx.font = originalFont;
      }
    };

    for (let i = 0; i < tempDiv.childNodes.length; i++) {
      drawNode(tempDiv.childNodes[i]);
    }

    const pngURL = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.href = pngURL;
    const fileName = getNoteTitle('codigo') + '.png';
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return { formatCode, exportAsMarkdown, captureCodeAsImage };
}
