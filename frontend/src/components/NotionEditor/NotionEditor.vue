<template>
  <div ref="editorRootRef" class="notion-editor-wrapper" @click="handleEditorClick"
    @input="onEditorInput" @keydown.capture="onRootKeydown">
    <InlineToolbar />
    <SlashCommandMenu :visible="slashMenu.visible" :x="slashMenu.x" :y="slashMenu.y" :query="slashMenu.query"
      @select="handleSlashSelect" @close="closeSlashMenu" />
    <MentionMenu :visible="mentionMenu.visible" :x="mentionMenu.x" :y="mentionMenu.y" :results="mentionResults"
      @select="handleMentionSelect" @close="closeMentionMenu" />
    <SelectionToolbar />
    <FindReplace ref="findReplaceRef" />

    <div class="notion-editor-content">
      <BlockRenderer v-for="block in store.blocks" :key="block.id" :block="block" />

      <div class="phantom-area"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, provide } from 'vue';
import { createDocumentStore, DocumentStoreKey } from './stores/useDocumentStore';
import { createDragReorderStore, DragReorderStoreKey } from './composables/useDragReorder';
import { Block, markdownToBlocks, blocksToMarkdown } from '../../Utils/markdownBlocks';
import { ImageService } from '../../services/image.service';
import { useConceptStore } from '../../stores/concept.store';
import { WIKILINK_RE } from '../../lib/wikilinks';
import BlockRenderer from './components/BlockRenderer.vue';
import InlineToolbar from './components/InlineToolbar.vue';
import SlashCommandMenu from './components/SlashCommandMenu.vue';
import MentionMenu from './components/MentionMenu.vue';
import SelectionToolbar from './components/SelectionToolbar.vue';
import FindReplace from './components/FindReplace.vue';

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'wikiLinkClick', target: string): void;
  (e: 'tagClick', tag: string): void;
}>();

// Cada editor crea y provee su propio store: dos editores montados a la vez
// (tabs, split) nunca comparten estado.
const store = createDocumentStore();
provide(DocumentStoreKey, store);

// Mismo criterio para el drag & drop de bloques (ver useDragReorder.ts).
const dragStore = createDragReorderStore();
provide(DragReorderStoreKey, dragStore);

const editorRootRef = ref<HTMLElement | null>(null);
const findReplaceRef = ref<any>(null);
const slashMenu = ref({ visible: false, x: 0, y: 0, query: '' });
let lastSlashNode: Node | null = null;

const conceptStore = useConceptStore();
const mentionMenu = ref({ visible: false, x: 0, y: 0, query: '' });
let lastMentionNode: Node | null = null;

const mentionResults = computed(() => {
  const q = mentionMenu.value.query.trim().toLowerCase();
  const source = conceptStore.summaries;
  const notes = (q ? source.filter(c => c.title.toLowerCase().includes(q)) : source)
    .slice(0, 15)
    .map(c => ({ id: c.id, title: c.title, kind: 'note' as const, subtitle: 'Nota' }));

  return notes;
});

// Publish edits before tab switches or route guards can read the draft.
// Hydration is read-only: opening a note must never rewrite its Markdown.
let hydrating = false;
const flushSerialize = () => {
  if (hydrating) return;
  const markdown = blocksToMarkdown(store.blocks);
  if (markdown !== props.modelValue) emit('update:modelValue', markdown);
};
watch(() => store.changeTick, flushSerialize, { flush: 'sync' });
const hydrate = () => {
  hydrating = true;
  try {
    store.init(markdownToBlocks(props.modelValue));
    ensureInitialBlock();
  } finally { hydrating = false; }
};

// Saving is handled by NotesView; edits are already synchronized above.
const onRootKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 'f') {
    e.preventDefault();
    findReplaceRef.value?.open();
    return;
  }

  // Con selección múltiple activa, Delete/Backspace/Escape actúan sobre el
  // conjunto en vez de la lógica normal de edición de un bloque.
  if (store.selectedIds.size > 1) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      store.deleteBlocks(Array.from(store.selectedIds));
    } else if (e.key === 'Escape') {
      store.clearSelection();
    }
  }
};

// Cambios EXTERNOS del contenido (Copilot, recarga del concepto): re-init
// solo si el usuario no está escribiendo aquí — nunca pisar el caret.
watch(() => props.modelValue, () => {
  const root = editorRootRef.value;
  if (root && root.contains(document.activeElement)) return;
  const currentMarkdown = blocksToMarkdown(store.blocks);
  if (currentMarkdown !== props.modelValue) {
    hydrate();
  }
});

onMounted(() => {
  hydrate();

  // click en document: necesario para detectar clics FUERA del editor
  document.addEventListener('click', handleGlobalClick);
  // @ts-ignore
  window.addEventListener('show-plus-slash-menu', handlePlusSlashMenu);
});

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick);
  // @ts-ignore
  window.removeEventListener('show-plus-slash-menu', handlePlusSlashMenu);
});

const ensureInitialBlock = () => {
  if (store.blocks.length === 0) {
    store.addBlock(null, 'paragraph');
  }
};

const handlePlusSlashMenu = (e: Event) => {
  const customEvent = e as CustomEvent<{ blockId: string; x: number; y: number }>;
  const { blockId, x, y } = customEvent.detail;
  // Con varios editores montados, solo responde el dueño del bloque
  if (!store._findBlock(store.blocks, blockId)) return;
  const newBlockId = store.addBlock(blockId, 'paragraph', '');
  store.setActiveBlock(newBlockId);

  setTimeout(() => {
    slashMenu.value = {
      visible: true,
      x: x + 15,
      y: y + 25,
      query: ''
    };
    lastSlashNode = null;
    document.getElementById(`block-${newBlockId}`)?.focus();
  }, 50);
};

const handleGlobalClick = (e: MouseEvent) => {
  const editorEl = editorRootRef.value;
  const target = e.target as HTMLElement;
  if (editorEl && !editorEl.contains(target)) {
    closeSlashMenu();
    if (store.selectedIds.size) store.clearSelection();
    if (store.activeBlockId) {
      const block = store._findBlock(store.blocks, store.activeBlockId);
      if (block && block.type === 'paragraph' && (!block.content || block.content.trim() === '' || block.content.trim() === '/')) {
        const parentArr = store._findParentArray(store.blocks, block.id);
        if (parentArr && (parentArr.length > 1 || block.parentId !== null)) {
          store.deleteBlock(block.id);
          store.setActiveBlock(null);
        }
      }
    }
  }
};

// Ctrl/Cmd+Click sobre un [[wikilink]] abre la nota enlazada (como Obsidian en modo fuente)
const findWikiLinkAtPoint = (e: MouseEvent): string | null => {
  const el = e.target as HTMLElement;
  if (!el.closest?.('.block-editor')) return null;

  let node: Node | null = null;
  let offset = 0;
  const doc = document as any;
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(e.clientX, e.clientY);
    if (pos) { node = pos.offsetNode; offset = pos.offset; }
  } else if (doc.caretRangeFromPoint) {
    const range = doc.caretRangeFromPoint(e.clientX, e.clientY);
    if (range) { node = range.startContainer; offset = range.startOffset; }
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;

  const text = node.textContent || '';
  WIKILINK_RE.lastIndex = 0;
  let m;
  while ((m = WIKILINK_RE.exec(text)) !== null) {
    if (offset >= m.index && offset <= m.index + m[0].length) {
      return m[1].trim();
    }
  }
  return null;
};

const handleEditorClick = (e: MouseEvent) => {
  if (e.ctrlKey || e.metaKey) {
    const anchor = (e.target as HTMLElement).closest?.('a.md-link') as HTMLAnchorElement | null;
    if (anchor?.href) {
      e.preventDefault();
      window.open(anchor.href, '_blank', 'noopener');
      return;
    }
    const tagEl = (e.target as HTMLElement).closest?.('.tag-link') as HTMLElement | null;
    if (tagEl) {
      e.preventDefault();
      emit('tagClick', (tagEl.textContent || '').replace(/^#/, '').trim());
      return;
    }
    const wikiTarget = findWikiLinkAtPoint(e);
    if (wikiTarget) {
      e.preventDefault();
      emit('wikiLinkClick', wikiTarget);
      return;
    }
  }

  const target = e.target as HTMLElement;
  if (target.classList.contains('phantom-area') || target.classList.contains('notion-editor-wrapper')) {
    const lastBlock = store.blocks[store.blocks.length - 1];
    if (lastBlock) {
      if (lastBlock.content && lastBlock.content.trim() !== '') {
        const id = store.addBlock(null, 'paragraph');
        setTimeout(() => document.getElementById(`block-${id}`)?.focus(), 0);
      } else {
        document.getElementById(`block-${lastBlock.id}`)?.focus();
      }
    }
  }
};

const onEditorInput = () => {
  checkSlashCommand();
  checkMentionTrigger();
};

const checkSlashCommand = () => {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const node = sel.focusNode;
  if (!node) return;
  const text = node.textContent || '';

  const slashIdx = text.lastIndexOf('/');
  if (slashIdx >= 0 && (slashIdx === 0 || text[slashIdx - 1] === ' ')) {
    const range = sel.getRangeAt(0).cloneRange();
    range.setStart(node, slashIdx);
    const rect = range.getBoundingClientRect();

    slashMenu.value = {
      visible: true,
      x: rect.left,
      y: rect.bottom + window.scrollY + 5,
      query: text.slice(slashIdx + 1)
    };
    lastSlashNode = node;
    closeMentionMenu();
  } else {
    closeSlashMenu();
  }
};

// Mismo patrón que checkSlashCommand, pero disparado por '@' en vez de '/'
// y con summaries de notas como fuente: el vault completo no debe cargarse en RAM
// solo para autocompletar menciones.
const checkMentionTrigger = () => {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const node = sel.focusNode;
  if (!node) return;
  const text = node.textContent || '';

  const atIdx = text.lastIndexOf('@');
  if (atIdx >= 0 && (atIdx === 0 || text[atIdx - 1] === ' ')) {
    const range = sel.getRangeAt(0).cloneRange();
    range.setStart(node, atIdx);
    const rect = range.getBoundingClientRect();

    mentionMenu.value = {
      visible: true,
      x: rect.left,
      y: rect.bottom + window.scrollY + 5,
      query: text.slice(atIdx + 1)
    };
    lastMentionNode = node;
    closeSlashMenu();
  } else {
    closeMentionMenu();
  }
};

const closeMentionMenu = () => {
  mentionMenu.value.visible = false;
  mentionMenu.value.query = '';
};

// Igual que handleSlashSelect: limpia el texto del trigger e inserta [[Título]],
// dejando que decorateInline (BlockRenderer.vue, onBlur) lo pinte al salir del bloque.
const handleMentionSelect = (concept: { id: string; title: string }) => {
  if (!store.activeBlockId || !lastMentionNode) { closeMentionMenu(); return; }

  const text = lastMentionNode.textContent || '';
  const atIdx = text.lastIndexOf('@');
  const before = text.slice(0, atIdx);
  const after = text.slice(atIdx + 1 + mentionMenu.value.query.length);
  lastMentionNode.textContent = `${before}[[${concept.title}]]${after}`;

  const blockId = store.activeBlockId;
  closeMentionMenu();

  setTimeout(() => {
    const el = document.getElementById(`block-${blockId}`);
    if (!el) return;
    store.updateBlock(blockId, { content: el.innerHTML });
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, 100);
};

const handleSlashSelect = (cmd: { id: string; label: string }) => {
  if (!store.activeBlockId) return;

  let cleanContent = '';
  if (lastSlashNode) {
    const text = lastSlashNode.textContent || '';
    const slashIdx = text.lastIndexOf('/');
    cleanContent = text.slice(0, slashIdx);
    lastSlashNode.textContent = cleanContent;
  }

  if (cmd.id === 'image') {
    const blockId = store.activeBlockId;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const { url } = await ImageService.upload(file);
      store.updateBlock(blockId, { type: 'image', src: url, content: cleanContent.trim() });
    };
    input.click();
    closeSlashMenu();
    return;
  }

  const updateData: Partial<Block> = { type: cmd.id, content: cleanContent };
  if (cmd.id === 'mermaid') {
    updateData.type = 'code';
    updateData.language = 'mermaid';
    updateData.content = 'graph TD\n  A --> B';
  } else if (cmd.id === 'abc') {
    updateData.type = 'code';
    updateData.language = 'abc';
    updateData.content = 'X: 1\nT: Cooley\'s\nM: 4/4\nK: Edor\n|:D2|EB{c}BA B2EB|B2EB dBAG|FDAD BDAD|FDAD dAFD|';
  } else if (cmd.id === 'table') {
    updateData.tableData = [['', ''], ['', '']];
  } else if (cmd.id === 'columns-2' || cmd.id === 'columns-3') {
    const n = cmd.id === 'columns-2' ? 2 : 3;
    const columnListId = store.activeBlockId;
    updateData.type = 'column-list';
    updateData.content = '';
    updateData.children = Array.from({ length: n }, () => {
      const colId = crypto.randomUUID();
      return {
        id: colId, type: 'column', content: '', parentId: columnListId,
        children: [{ id: crypto.randomUUID(), type: 'paragraph', content: '', parentId: colId }]
      };
    });
  }

  store.updateBlock(store.activeBlockId, updateData);
  closeSlashMenu();

  if (['table', 'math', 'mermaid', 'abc', 'columns-2', 'columns-3'].includes(cmd.id)) {
    const newId = store.addBlock(store.activeBlockId, 'paragraph');
    setTimeout(() => {
      document.getElementById(`block-${newId}`)?.focus();
    }, 100);
  } else {
    setTimeout(() => {
      const el = document.getElementById(`block-${store.activeBlockId}`);
      if (el) {
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }, 100);
  }
};

const closeSlashMenu = () => {
  slashMenu.value.visible = false;
  slashMenu.value.query = '';
};
</script>

<style scoped>
.notion-editor-wrapper {
  font-family: var(--note-font-family, var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif));
  font-size: var(--note-font-size, 15px);
  line-height: var(--note-line-height, 1.6);
  color: var(--note-text-color, var(--fg, #ffffff));
  background-color: var(--note-bg-color, transparent);
  padding: var(--note-padding, 24px) 0;
  width: 100%;
  max-width: var(--note-max-width, 800px);
  margin: 0 auto;
  min-height: 300px;
  cursor: text;
}

.notion-editor-content {
  display: flex;
  flex-direction: column;
}

.phantom-area {
  min-height: 120px;
  margin-top: 8px;
  cursor: text;
}
</style>
