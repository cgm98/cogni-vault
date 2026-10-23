import { ref, inject } from 'vue';
import type { InjectionKey } from 'vue';
import { useDocumentStore } from '../stores/useDocumentStore';
import { Block } from '../../../Utils/markdownBlocks';

// Un store de drag por <NotionEditor>, igual que el documento (useDocumentStore):
// con refs a nivel de módulo, arrastrar un bloque en el panel izquierdo del modo
// split activaba los indicadores de drop en el panel derecho, y soltar ahí no
// encontraba el bloque en el store equivocado.
export function createDragReorderStore() {
  const draggingId = ref<string | null>(null);
  const dropTargetId = ref<string | null>(null);
  const dropPosition = ref<'before' | 'after' | 'inside' | null>(null);
  return { draggingId, dropTargetId, dropPosition };
}

export type DragReorderStore = ReturnType<typeof createDragReorderStore>;

export const DragReorderStoreKey: InjectionKey<DragReorderStore> = Symbol('cogni-drag-reorder-store');

export function useDragReorder() {
  const store = useDocumentStore();
  const dragStore = inject(DragReorderStoreKey, null);
  if (!dragStore) {
    throw new Error('useDragReorder() requiere un <NotionEditor> ancestro que provea el store de drag & drop.');
  }
  const { draggingId, dropTargetId, dropPosition } = dragStore;

  const onDragStart = (e: DragEvent, block: Block) => {
    draggingId.value = block.id;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
    const container = (e.target as HTMLElement).closest('.block-container');
    if (container) {
      container.classList.add('dragging');
    }
  };

  const onDragOver = (e: DragEvent, block: Block) => {
    if (!draggingId.value || draggingId.value === block.id) return;
    e.preventDefault();
    const currentTarget = e.currentTarget as HTMLElement;
    const rect = currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;

    dropTargetId.value = block.id;
    if (y < rect.height * 0.25) dropPosition.value = 'before';
    else if (y > rect.height * 0.75) dropPosition.value = 'after';
    else dropPosition.value = 'inside';
  };

  const onDrop = (e: DragEvent, block: Block) => {
    e.preventDefault();
    if (!draggingId.value || !dropTargetId.value || draggingId.value === dropTargetId.value) return;

    const targetArr = store._findParentArray(store.blocks, dropTargetId.value);
    if (!targetArr) return;
    const targetIdx = targetArr.findIndex(b => b.id === dropTargetId.value);
    const targetBlock = targetArr[targetIdx];

    if (dropPosition.value === 'before') {
      store.moveBlock(draggingId.value, targetIdx, targetBlock.parentId);
    } else if (dropPosition.value === 'after') {
      store.moveBlock(draggingId.value, targetIdx + 1, targetBlock.parentId);
    } else if (dropPosition.value === 'inside') {
      store.moveBlock(draggingId.value, targetBlock.children?.length || 0, targetBlock.id);
    }

    cleanup();
  };

  const onDragEnd = (e: DragEvent) => {
    const container = (e.target as HTMLElement).closest('.block-container');
    if (container) {
      container.classList.remove('dragging');
    }
    cleanup();
  };

  const cleanup = () => {
    draggingId.value = null;
    dropTargetId.value = null;
    dropPosition.value = null;
  };

  return { onDragStart, onDragOver, onDrop, onDragEnd, draggingId, dropTargetId, dropPosition };
}
