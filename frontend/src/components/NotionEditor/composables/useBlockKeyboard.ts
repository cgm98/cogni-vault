import { useDocumentStore } from '../stores/useDocumentStore';
import { Block } from '../../../Utils/markdownBlocks';

export function useBlockKeyboard() {
  const store = useDocumentStore();

  const handleKeydown = (e: KeyboardEvent, block: Block) => {
    if (e.defaultPrevented) return;

    if (e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      // Sin foco de teclado real en el bloque destino: es selección de bloques, no de texto.
      (document.activeElement as HTMLElement | null)?.blur?.();
      store.extendSelection(e.key === 'ArrowDown' ? 1 : -1);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      let type = block.type;
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'quote'].includes(type)) type = 'paragraph';
      if (['bulleted-list', 'numbered-list', 'checkbox'].includes(type) && !block.content.trim()) {
        store.updateBlock(block.id, { type: 'paragraph' });
        return;
      }
      let newId: string;
      if (block.type === 'toggle') {
        store.updateBlock(block.id, { collapsed: false });
        newId = store.addChildBlock(block.id, 'paragraph');
      } else {
        newId = store.addBlock(block.id, type);
      }
      setTimeout(() => document.getElementById(`block-${newId}`)?.focus(), 0);
    }
    
    if (e.key === 'Backspace' && store.activeBlockId === block.id && !block.content) {
      e.preventDefault();
      if (block.type !== 'paragraph') {
        store.updateBlock(block.id, { type: 'paragraph' });
      } else {
        const arr = store._findParentArray(store.blocks, block.id);
        if (arr) {
          const idx = arr.findIndex(b => b.id === block.id);
          if (idx > 0) {
            const prevId = arr[idx - 1].id;
            store.deleteBlock(block.id);
            setTimeout(() => {
              const el = document.getElementById(`block-${prevId}`);
              if (el) {
                el.focus();
                const range = document.createRange();
                range.selectNodeContents(el);
                range.collapse(false);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
              }
            }, 0);
          }
        }
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        store.outdentBlock(block.id);
      } else {
        store.indentBlock(block.id);
      }
      setTimeout(() => document.getElementById(`block-${block.id}`)?.focus(), 0);
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) store.redo();
      else store.undo();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
      e.preventDefault();
      document.execCommand('underline');
    }
  };

  const handleInput = (e: Event, block: Block) => {
    const target = e.target as HTMLElement;
    const text = target.innerText;
    let type = block.type;
    let content = text;
    let changed = false;

    const matchers = [
      { regex: /^######\s/, type: 'h6' },
      { regex: /^#####\s/, type: 'h5' },
      { regex: /^####\s/, type: 'h4' },
      { regex: /^###\s/, type: 'h3' },
      { regex: /^##\s/, type: 'h2' },
      { regex: /^#\s/, type: 'h1' },
      { regex: /^-\s|^\*\s/, type: 'bulleted-list' },
      { regex: /^\d+\.\s/, type: 'numbered-list' },
      { regex: /^\[\]\s|^\[ \]\s/, type: 'checkbox', patch: { checked: false } },
      { regex: /^\[x\]\s/i, type: 'checkbox', patch: { checked: true } },
      { regex: /^>\s/, type: 'quote' },
      { regex: /^```/, type: 'code' },
      { regex: /^\$\$/, type: 'math' },
      { regex: /^---/, type: 'divider' },
      { regex: /^\*\*\*$/, type: 'divider' },
    ];

    if (block.type !== 'code') {
      for (const m of matchers) {
        if (m.regex.test(text)) {
          type = m.type;
          content = text.replace(m.regex, '');
          changed = true;
          if (type === 'divider') {
            store.updateBlock(block.id, { type, content: '' });
            store.addBlock(block.id, 'paragraph');
            return;
          }
          if (type === 'code') {
            // Lo que sigue a ``` es el lenguaje (```js), no contenido
            store.updateBlock(block.id, { type, content: '', language: content.trim() });
            return;
          }
          store.updateBlock(block.id, { type, content, ...(m.patch || {}) });
          target.innerText = content;
          setTimeout(() => {
            const range = document.createRange();
            range.selectNodeContents(target);
            range.collapse(false);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
          }, 0);
          break;
        }
      }
    }
    
    if (!changed) {
      if (!text.startsWith('/')) {
        store.updateBlock(block.id, { content: target.innerHTML });
      }
    }
  };

  return { handleKeydown, handleInput };
}
