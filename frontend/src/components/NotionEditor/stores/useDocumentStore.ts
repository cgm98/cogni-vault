import { reactive, inject, nextTick, toRaw } from 'vue';
import type { InjectionKey } from 'vue';
import { Block } from '../../../Utils/markdownBlocks';

const generateId = (): string => {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 15);
};

interface CaretPos {
  blockId: string;
  offset: number;
}

interface HistoryEntry {
  blocks: Block[];
  caret: CaretPos | null;
}

// Ventana de agrupación del historial: tipeo continuo = un solo paso de undo
const COALESCE_MS = 600;

const captureCaret = (): CaretPos | null => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.anchorNode) return null;
  const anchorEl = sel.anchorNode instanceof HTMLElement
    ? sel.anchorNode
    : sel.anchorNode.parentElement;
  const el = anchorEl?.closest?.('[id^="block-"]') as HTMLElement | null;
  if (!el) return null;

  const range = sel.getRangeAt(0).cloneRange();
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  return { blockId: el.id.replace(/^block-/, ''), offset: pre.toString().length };
};

const restoreCaret = (caret: CaretPos | null) => {
  if (!caret) return;
  const el = document.getElementById(`block-${caret.blockId}`);
  if (!el) return;
  el.focus();

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let remaining = caret.offset;
  let target: Text | null = null;
  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    const len = textNode.textContent?.length || 0;
    if (remaining <= len) { target = textNode; break; }
    remaining -= len;
  }

  const sel = window.getSelection();
  const range = document.createRange();
  if (target) {
    range.setStart(target, remaining);
  } else {
    range.selectNodeContents(el);
    range.collapse(false);
  }
  range.collapse(true);
  sel?.removeAllRanges();
  sel?.addRange(range);
};

// Una instancia de store POR editor (provide/inject): dos editores montados
// a la vez nunca comparten bloques. `changeTick` señala mutaciones sin
// obligar a nadie a observar el árbol completo en profundidad.
export function createDocumentStore() {
  const store = reactive({
    blocks: [] as Block[],
    activeBlockId: null as string | null,
    history: [] as HistoryEntry[],
    historyIndex: -1,
    changeTick: 0,
    _lastEdit: { blockId: '', time: 0 },
    selectedIds: new Set<string>(),
    selectionAnchor: null as string | null,
    selectionFocus: null as string | null,

    init(initialBlocks: Block[]): void {
      this.blocks = initialBlocks && initialBlocks.length ? initialBlocks : [];
      this.history = [];
      this.historyIndex = -1;
      this._lastEdit = { blockId: '', time: 0 };
      this.saveSnapshot();
    },
    // coalesceKey: id del bloque cuando el cambio es solo de contenido;
    // permite agrupar el tipeo continuo en un único snapshot.
    //
    // El clon en sí no se puede diferir: incluso cuando coalesce, cada
    // snapshot tiene que reflejar el contenido más reciente para que undo
    // no pierda las últimas pulsaciones. structuredClone es más barato que
    // el roundtrip JSON.parse(JSON.stringify(...)) — mismo costo en cada
    // keystroke, menos trabajo por llamada.
    saveSnapshot(coalesceKey?: string): void {
      // structuredClone no puede clonar el Proxy reactivo directamente
      // (DataCloneError) — toRaw() da el array/objetos planos subyacentes.
      const snap = structuredClone(toRaw(this.blocks));
      const caret = captureCaret();
      const now = Date.now();

      const canCoalesce = !!coalesceKey
        && this._lastEdit.blockId === coalesceKey
        && now - this._lastEdit.time < COALESCE_MS
        && this.historyIndex > 0
        && this.historyIndex === this.history.length - 1;

      if (this.historyIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyIndex + 1);
      }

      if (canCoalesce) {
        this.history[this.historyIndex] = { blocks: snap, caret };
      } else {
        this.history.push({ blocks: snap, caret });
        this.historyIndex++;
      }

      this._lastEdit = coalesceKey ? { blockId: coalesceKey, time: now } : { blockId: '', time: 0 };
      this.changeTick++;
    },
    undo(): void {
      if (this.historyIndex > 0) {
        // blur para que el bloque enfocado re-sincronice su innerHTML al aplicar el estado
        (document.activeElement as HTMLElement | null)?.blur?.();
        this.historyIndex--;
        const entry = this.history[this.historyIndex];
        this.blocks = structuredClone(toRaw(entry.blocks));
        this._lastEdit = { blockId: '', time: 0 };
        this.changeTick++;
        nextTick(() => restoreCaret(entry.caret));
      }
    },
    redo(): void {
      if (this.historyIndex < this.history.length - 1) {
        (document.activeElement as HTMLElement | null)?.blur?.();
        this.historyIndex++;
        const entry = this.history[this.historyIndex];
        this.blocks = structuredClone(toRaw(entry.blocks));
        this._lastEdit = { blockId: '', time: 0 };
        this.changeTick++;
        nextTick(() => restoreCaret(entry.caret));
      }
    },
    setActiveBlock(id: string | null): void {
      this.activeBlockId = id;
    },
    _flattenIds(blocks: Block[]): string[] {
      const out: string[] = [];
      for (const b of blocks) {
        out.push(b.id);
        if (b.children) out.push(...this._flattenIds(b.children));
      }
      return out;
    },
    toggleSelect(id: string): void {
      if (this.selectedIds.has(id)) this.selectedIds.delete(id);
      else this.selectedIds.add(id);
      this.selectionAnchor = id;
      this.selectionFocus = id;
    },
    // Rango entre el ancla (fijo, el primer bloque shift-clickeado) y `toId`,
    // en orden de documento (pre-order, igual al que recorre BlockRenderer).
    selectRange(toId: string): void {
      if (!this.selectionAnchor) this.selectionAnchor = this.activeBlockId ?? toId;
      this.selectionFocus = toId;
      const flat = this._flattenIds(this.blocks);
      const anchorIdx = flat.indexOf(this.selectionAnchor);
      const toIdx = flat.indexOf(toId);
      if (anchorIdx === -1 || toIdx === -1) { this.toggleSelect(toId); return; }
      const [start, end] = anchorIdx <= toIdx ? [anchorIdx, toIdx] : [toIdx, anchorIdx];
      this.selectedIds = new Set(flat.slice(start, end + 1));
    },
    // Shift+ArrowUp/Down: mueve el extremo móvil de la selección un bloque,
    // sin foco de teclado real (evita meter el caret en el bloque destino).
    extendSelection(direction: number): void {
      const flat = this._flattenIds(this.blocks);
      if (!flat.length) return;
      if (!this.selectionAnchor) {
        this.selectionAnchor = this.activeBlockId ?? flat[0];
        this.selectionFocus = this.selectionAnchor;
      }
      const curIdx = flat.indexOf(this.selectionFocus ?? this.selectionAnchor);
      const nextIdx = Math.min(Math.max(curIdx + direction, 0), flat.length - 1);
      this.selectionFocus = flat[nextIdx];
      const anchorIdx = flat.indexOf(this.selectionAnchor);
      const [start, end] = anchorIdx <= nextIdx ? [anchorIdx, nextIdx] : [nextIdx, anchorIdx];
      this.selectedIds = new Set(flat.slice(start, end + 1));
    },
    clearSelection(): void {
      this.selectedIds = new Set();
      this.selectionAnchor = null;
      this.selectionFocus = null;
    },
    deleteBlocks(ids: string[]): void {
      for (const id of ids) {
        const arr = this._findParentArray(this.blocks, id);
        if (!arr) continue;
        const idx = arr.findIndex(b => b.id === id);
        if (idx !== -1) arr.splice(idx, 1);
      }
      this.clearSelection();
      this.saveSnapshot();
    },
    duplicateBlocks(ids: string[]): void {
      for (const id of ids) {
        const block = this._findBlock(this.blocks, id);
        const arr = this._findParentArray(this.blocks, id);
        if (!block || !arr) continue;
        const clone = this._cloneWithNewIds(JSON.parse(JSON.stringify(block)), block.parentId ?? null);
        const idx = arr.findIndex(b => b.id === id);
        arr.splice(idx + 1, 0, clone);
      }
      this.saveSnapshot();
    },
    _findParentArray(blocks: Block[], id: string): Block[] | null {
      for (let i = 0; i < blocks.length; i++) {
        if (blocks[i].id === id) return blocks;
        if (blocks[i].children) {
          const res = this._findParentArray(blocks[i].children!, id);
          if (res) return res;
        }
      }
      return null;
    },
    _findBlock(blocks: Block[], id: string): Block | null {
      for (const block of blocks) {
        if (block.id === id) return block;
        if (block.children) {
          const res = this._findBlock(block.children, id);
          if (res) return res;
        }
      }
      return null;
    },
    addBlock(afterId: string | null, type = 'paragraph', content = ''): string {
      const newBlock: Block = { id: generateId(), type, content, parentId: null };
      if (!afterId) {
        this.blocks.push(newBlock);
      } else {
        const arr = this._findParentArray(this.blocks, afterId);
        if (arr) {
          const idx = arr.findIndex(b => b.id === afterId);
          newBlock.parentId = arr[idx].parentId;
          arr.splice(idx + 1, 0, newBlock);
        } else {
          this.blocks.push(newBlock);
        }
      }
      this.saveSnapshot();
      return newBlock.id;
    },
    addChildBlock(parentId: string, type = 'paragraph', content = ''): string {
      const parent = this._findBlock(this.blocks, parentId);
      if (parent) {
        if (!parent.children) parent.children = [];
        const newBlock: Block = { id: generateId(), type, content, parentId };
        parent.children.push(newBlock);
        this.saveSnapshot();
        return newBlock.id;
      }
      return this.addBlock(parentId, type, content);
    },
    insertBlocksAfter(afterId: string, newBlocks: Block[]): void {
      if (!newBlocks.length) return;
      const arr = this._findParentArray(this.blocks, afterId);
      if (!arr) {
        this.blocks.push(...newBlocks);
      } else {
        const idx = arr.findIndex(b => b.id === afterId);
        const parentId = arr[idx].parentId ?? null;
        newBlocks.forEach(b => { b.parentId = parentId; });
        arr.splice(idx + 1, 0, ...newBlocks);
      }
      this.saveSnapshot();
    },
    updateBlock(id: string, patch: Partial<Block>): void {
      const block = this._findBlock(this.blocks, id);
      if (block) {
        Object.assign(block, patch);
        const keys = Object.keys(patch);
        const contentOnly = keys.length === 1 && keys[0] === 'content';
        this.saveSnapshot(contentOnly ? id : undefined);
      }
    },
    deleteBlock(id: string): void {
      const arr = this._findParentArray(this.blocks, id);
      if (arr) {
        const idx = arr.findIndex(b => b.id === id);
        arr.splice(idx, 1);
        this.saveSnapshot();
      }
    },
    _cloneWithNewIds(block: Block, parentId: string | null): Block {
      const clone: Block = { ...block, id: generateId(), parentId };
      if (block.children) {
        clone.children = block.children.map(c => this._cloneWithNewIds(c, clone.id));
      }
      return clone;
    },
    duplicateBlock(id: string): string {
      const block = this._findBlock(this.blocks, id);
      if (!block) return '';
      const clone = this._cloneWithNewIds(JSON.parse(JSON.stringify(block)), block.parentId ?? null);
      this.insertBlocksAfter(id, [clone]);
      return clone.id;
    },
    moveBlock(id: string, newIndex: number, newParentId: string | null = null): void {
      const oldArr = this._findParentArray(this.blocks, id);
      if (!oldArr) return;
      const oldIdx = oldArr.findIndex(b => b.id === id);
      const [block] = oldArr.splice(oldIdx, 1);
      block.parentId = newParentId;

      let newArr: Block[];
      if (newParentId === null) {
        newArr = this.blocks;
      } else {
        const parent = this._findBlock(this.blocks, newParentId);
        if (parent) {
          if (!parent.children) parent.children = [];
          newArr = parent.children;
        } else {
          newArr = this.blocks;
        }
      }

      // Si el bloque se mueve dentro del mismo array hacia una posición posterior,
      // el splice de remoción de arriba ya corrió los índices un lugar a la izquierda.
      const insertIdx = newArr === oldArr && oldIdx < newIndex ? newIndex - 1 : newIndex;
      newArr.splice(insertIdx, 0, block);
      this.saveSnapshot();
    },
    indentBlock(id: string): void {
      const arr = this._findParentArray(this.blocks, id);
      if (arr) {
        const idx = arr.findIndex(b => b.id === id);
        if (idx > 0) {
          const prev = arr[idx - 1];
          const [block] = arr.splice(idx, 1);
          if (!prev.children) prev.children = [];
          block.parentId = prev.id;
          prev.children.push(block);
          this.saveSnapshot();
        }
      }
    },
    addColumn(columnListId: string): void {
      const list = this._findBlock(this.blocks, columnListId);
      if (list && list.type === 'column-list') {
        if (!list.children) list.children = [];
        const colId = generateId();
        list.children.push({
          id: colId, type: 'column', content: '', parentId: columnListId,
          children: [{ id: generateId(), type: 'paragraph', content: '', parentId: colId }]
        });
        this.saveSnapshot();
      }
    },
    outdentBlock(id: string): void {
      const block = this._findBlock(this.blocks, id);
      if (block && block.parentId) {
        const parentArr = this._findParentArray(this.blocks, block.parentId);
        const arr = this._findParentArray(this.blocks, id);
        if (parentArr && arr) {
          const parentIdx = parentArr.findIndex(b => b.id === block.parentId);
          const idx = arr.findIndex(b => b.id === id);
          arr.splice(idx, 1);
          block.parentId = parentArr[parentIdx].parentId;
          parentArr.splice(parentIdx + 1, 0, block);
          this.saveSnapshot();
        }
      }
    }
  });

  return store;
}

export type DocumentStore = ReturnType<typeof createDocumentStore>;

export const DocumentStoreKey: InjectionKey<DocumentStore> = Symbol('cogni-document-store');

// Misma firma que el antiguo store global de Pinia: los componentes hijos no
// cambian su código; la diferencia es que ahora reciben la instancia del
// <NotionEditor> que los contiene.
export function useDocumentStore(): DocumentStore {
  const store = inject(DocumentStoreKey, null);
  if (!store) {
    throw new Error('useDocumentStore() requiere un <NotionEditor> ancestro que provea el store del documento.');
  }
  return store;
}
