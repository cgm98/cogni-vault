<template>
  <div
    class="block-container"
    :class="[`type-${block.type}`, { dragging: dragId === block.id, selected: store.selectedIds.has(block.id) }]"
    @mousedown.capture="onContainerMouseDown"
    @dragover="onDragOver($event, block)"
    @drop="onDrop($event, block)"
  >
    <div
      v-if="block.type !== 'column'"
      class="drag-handle"
      draggable="true"
      role="button"
      tabindex="0"
      aria-label="Arrastrar bloque, click para opciones"
      @dragstart="onDragStart($event, block)"
      @dragend="onDragEnd"
      @click="openBlockMenu"
      contenteditable="false"
      title="Arrastrar o click para opciones"
    >
      <GripVertical :size="14" aria-hidden="true" />
    </div>

    <BlockMenu
      v-if="showBlockMenu"
      :x="blockMenuPos.x"
      :y="blockMenuPos.y"
      @duplicate="handleDuplicate"
      @convert="handleConvert"
      @align="handleAlign"
      @delete="handleDeleteFromMenu"
    />

    <!-- Plus block button next to drag handle -->
    <div
      v-if="block.type !== 'column'"
      class="add-block-btn"
      role="button"
      tabindex="0"
      aria-label="Agregar bloque abajo"
      @click="triggerPlusMenu"
      @keydown.enter.prevent="triggerPlusMenu"
      @keydown.space.prevent="triggerPlusMenu"
      contenteditable="false"
      title="Agregar bloque abajo"
    >
      <Plus :size="14" aria-hidden="true" />
    </div>

    <div v-if="block.type === 'column-list'" class="columns-row">
      <BlockRenderer v-for="child in block.children" :key="child.id" :block="child" />
      <button type="button" class="column-add-btn" aria-label="Agregar columna" title="Agregar columna" @click="addColumn">
        <Plus :size="14" aria-hidden="true" />
      </button>
    </div>

    <div v-else-if="block.type === 'column'" class="column-body">
      <div v-if="block.children && block.children.length" class="block-children column-children">
        <BlockRenderer v-for="child in block.children" :key="child.id" :block="child" />
      </div>
      <button v-if="canRemoveColumn" type="button" class="column-remove-btn" aria-label="Eliminar columna" title="Eliminar columna" @click="removeColumn">
        <X :size="12" aria-hidden="true" />
      </button>
    </div>

    <div v-else class="block-content-wrapper">
      <div v-if="block.type === 'checkbox'" class="block-prefix">
        <input type="checkbox" :checked="block.checked" @change="toggleCheck" />
      </div>
      <div v-if="block.type === 'bulleted-list'" class="block-prefix">•</div>
      <div v-if="block.type === 'numbered-list'" class="block-prefix">{{ numberedIndex() }}</div>
      <div
        v-if="block.type === 'toggle' || isCollapsibleHeading"
        class="block-prefix toggle-btn"
        role="button"
        tabindex="0"
        :aria-expanded="!block.collapsed"
        aria-label="Expandir o colapsar"
        :draggable="isDraggable"
        @mousedown="onMouseDown"
        @click="handleButtonClick"
        @keydown.enter.prevent="toggleCollapse"
        @keydown.space.prevent="toggleCollapse"
        @mouseleave="onMouseLeave"
        @dragstart="onDragStart($event, block)"
        @dragend="onDragEndToggle"
        style="position: relative;"
      >
        {{ block.collapsed ? '▶' : '▼' }}

        <!-- Dropdown Menu -->
        <div v-if="showMenu" class="block-menu" role="menu" @click.stop>
          <button type="button" class="menu-item" role="menuitem" @click="handleToggleCollapse">
            <span class="menu-icon" aria-hidden="true">{{ block.collapsed ? '▶' : '▼' }}</span>
            <span>{{ block.collapsed ? 'Expandir' : 'Colapsar' }}</span>
          </button>
          <button type="button" class="menu-item delete" role="menuitem" @click="handleDelete">
            <Trash2 :size="12" class="menu-icon" aria-hidden="true" />
            <span>Eliminar bloque</span>
          </button>
        </div>
      </div>
      
      <CodeBlock 
        v-if="block.type === 'code'" 
        :block="block" 
      />

      <TableBlock 
        v-else-if="block.type === 'table'"
        :block="block"
        :id="`block-${block.id}`"
      />

      <MathBlock
        v-else-if="block.type === 'math'"
        :block="block"
        :id="`block-${block.id}`"
      />

      <div
        v-else-if="block.type === 'image'"
        :id="`block-${block.id}`"
        class="block-image"
        contenteditable="false"
        @click="store.setActiveBlock(block.id)"
      >
        <img v-if="block.src" :src="block.src" :alt="block.content || ''" loading="lazy" />
        <div v-else class="block-image-empty">Imagen sin origen</div>
      </div>

      <div
        v-else
        ref="editorRef"
        :id="`block-${block.id}`"
        class="block-editor"
        :class="[block.type, { checked: block.checked }]"
        :style="{ textAlign: block.align }"
        :contenteditable="block.type !== 'divider'"
        @keydown="onKeydown"
        @input="onInput"
        @focus="store.setActiveBlock(block.id)"
        @blur="onBlur"
        @paste="onPaste"
        :placeholder="getPlaceholder()"
      ></div>
    </div>

    <!-- Inline delete button on the right side -->
    <div
      v-if="block.type !== 'column'"
      class="delete-block-btn"
      role="button"
      tabindex="0"
      aria-label="Eliminar bloque"
      @click="deleteCurrentBlock"
      @keydown.enter.prevent="deleteCurrentBlock"
      @keydown.space.prevent="deleteCurrentBlock"
      contenteditable="false"
      title="Eliminar bloque"
    >
      <Trash2 :size="14" aria-hidden="true" />
    </div>

    <!-- Drop Indicators -->
    <div v-if="dropTargetId === block.id && dropPosition === 'before'" class="drop-indicator before"></div>
    <div v-if="dropTargetId === block.id && dropPosition === 'after'" class="drop-indicator after"></div>
    <div v-if="dropTargetId === block.id && dropPosition === 'inside'" class="drop-indicator inside"></div>

    <!-- Children -->
    <div v-if="!['column-list', 'column'].includes(block.type) && block.children && block.children.length && !block.collapsed" class="block-children">
      <BlockRenderer 
        v-for="child in block.children" 
        :key="child.id" 
        :block="child" 
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { GripVertical, Plus, Trash2, X } from 'lucide-vue-next';
import { useDocumentStore } from '../stores/useDocumentStore';
import { useBlockKeyboard } from '../composables/useBlockKeyboard';
import { useDragReorder } from '../composables/useDragReorder';
import { Block, markdownToBlocks, decorateInline } from '../../../Utils/markdownBlocks';
import { ImageService } from '../../../services/image.service';
import { useToast } from '../../../composables/useToast';
import CodeBlock from './CodeBlock.vue';
import TableBlock from './TableBlock.vue';
import MathBlock from './MathBlock.vue';
import BlockMenu from './BlockMenu.vue';
import './BlockRenderer.css';

const props = defineProps<{ block: Block }>();
const store = useDocumentStore();
const { handleKeydown, handleInput } = useBlockKeyboard();
const { onDragStart, onDragOver, onDrop, onDragEnd, draggingId: dragId, dropTargetId, dropPosition } = useDragReorder();

const editorRef = ref<HTMLElement | null>(null);
const isDraggable = ref(false);
const showMenu = ref(false);
let pressTimer: any = null;
let isLongPress = false;

const showBlockMenu = ref(false);
const blockMenuPos = ref({ x: 0, y: 0 });

const openBlockMenu = (e: MouseEvent) => {
  e.stopPropagation();
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  blockMenuPos.value = { x: rect.right + 6, y: rect.top };
  showBlockMenu.value = true;
  setTimeout(() => window.addEventListener('click', closeBlockMenu), 0);
};

const closeBlockMenu = () => {
  showBlockMenu.value = false;
  window.removeEventListener('click', closeBlockMenu);
};

const handleDuplicate = () => {
  store.duplicateBlock(props.block.id);
  closeBlockMenu();
};

const handleConvert = (type: string) => {
  store.updateBlock(props.block.id, { type });
  closeBlockMenu();
};

const handleAlign = (align: 'left' | 'center' | 'right') => {
  store.updateBlock(props.block.id, { align });
  closeBlockMenu();
};

// Headings con hijos indentados (Tab) son colapsables igual que un toggle,
// reusando el mismo mecanismo genérico de render (`v-if="... && !block.collapsed"` más abajo).
const isCollapsibleHeading = computed(() =>
  ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(props.block.type) && !!props.block.children?.length
);

const canRemoveColumn = computed(() => {
  const arr = store._findParentArray(store.blocks, props.block.id);
  return !!arr && arr.length > 1;
});
const addColumn = () => store.addColumn(props.block.id);
const removeColumn = () => store.deleteBlock(props.block.id);

const handleDeleteFromMenu = () => {
  store.deleteBlock(props.block.id);
  closeBlockMenu();
};

// Shift+click: extiende la selección de bloques sin mover el caret de texto.
// Click normal con selección activa: la limpia y deja el click seguir su curso normal (foco/edición).
const onContainerMouseDown = (e: MouseEvent) => {
  if (e.shiftKey) {
    e.preventDefault();
    store.selectRange(props.block.id);
  } else if (store.selectedIds.size) {
    store.clearSelection();
  }
};

const onMouseDown = () => {
  isLongPress = false;
  isDraggable.value = false;
  pressTimer = setTimeout(() => {
    isDraggable.value = true;
    isLongPress = true;
  }, 1000);
};

const handleButtonClick = (e: MouseEvent) => {
  e.stopPropagation();
  clearTimeout(pressTimer);
  if (!isLongPress) {
    showMenu.value = !showMenu.value;
    if (showMenu.value) {
      setTimeout(() => {
        window.addEventListener('click', closeMenu);
      }, 0);
    }
  }
  isDraggable.value = false;
};

const closeMenu = () => {
  showMenu.value = false;
  window.removeEventListener('click', closeMenu);
};

const handleToggleCollapse = () => {
  toggleCollapse();
  closeMenu();
};

const handleDelete = () => {
  store.deleteBlock(props.block.id);
  closeMenu();
};

const deleteCurrentBlock = () => {
  store.deleteBlock(props.block.id);
};

const onMouseLeave = () => {
  clearTimeout(pressTimer);
  isDraggable.value = false;
};

const onDragEndToggle = (e: DragEvent) => {
  onDragEnd(e);
  isDraggable.value = false;
};

onUnmounted(() => {
  window.removeEventListener('click', closeMenu);
  window.removeEventListener('click', closeBlockMenu);
});

onMounted(() => {
  if (editorRef.value) {
    editorRef.value.innerHTML = props.block.content || '';
  }
});

watch(() => props.block.content, (newContent) => {
  if (editorRef.value && document.activeElement !== editorRef.value) {
    if (editorRef.value.innerHTML !== newContent) {
      editorRef.value.innerHTML = newContent || '';
    }
  }
});

watch(() => props.block.type, () => {
  const active = (document.activeElement === editorRef.value);
  if (editorRef.value) {
    editorRef.value.innerHTML = props.block.content || '';
    if (active) {
      editorRef.value.focus();
      const range = document.createRange();
      range.selectNodeContents(editorRef.value);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }
});

const toggleCheck = (e: Event) => {
  const target = e.target as HTMLInputElement;
  store.updateBlock(props.block.id, { checked: target.checked });
};

const toggleCollapse = () => store.updateBlock(props.block.id, { collapsed: !props.block.collapsed });

const triggerPlusMenu = (e: MouseEvent | KeyboardEvent) => {
  store.setActiveBlock(props.block.id);
  const currentTarget = e.currentTarget as HTMLElement;
  const rect = currentTarget.getBoundingClientRect();
  const event = new CustomEvent('show-plus-slash-menu', {
    detail: {
      blockId: props.block.id,
      x: rect.left,
      y: rect.bottom + window.scrollY + 5
    }
  });
  window.dispatchEvent(event);
};

const numberedIndex = (): string => {
  const parentArr = store._findParentArray(store.blocks, props.block.id) || store.blocks || [];
  let index = 1;
  for (const b of parentArr) {
    if (b.id === props.block.id) break;
    // Un bloque de otro tipo corta el tramo: la numeración se reinicia (como Obsidian).
    index = b.type === 'numbered-list' ? index + 1 : 1;
  }
  return `${index}.`;
};

const onKeydown = (e: KeyboardEvent) => handleKeydown(e, props.block);
const onInput = (e: Event) => handleInput(e, props.block);

// Al salir del bloque, resaltar [[wikilinks]] y [texto](url) recién escritos
const onBlur = (e: Event) => {
  const target = e.target as HTMLElement;
  const decorated = decorateInline(target.innerHTML);
  if (decorated !== target.innerHTML) {
    target.innerHTML = decorated;
    store.updateBlock(props.block.id, { content: decorated });
  }
};

const toast = useToast();

// Imágenes pegadas (portapapeles o captura): subir al server e insertar bloques image
const uploadAndInsertImages = async (files: File[]) => {
  try {
    const newBlocks: Block[] = [];
    for (const f of files) {
      const { url } = await ImageService.upload(f);
      newBlocks.push({ id: crypto.randomUUID(), type: 'image', content: '', src: url, parentId: null });
    }
    const isEmpty = !(editorRef.value?.textContent || '').trim();
    if (isEmpty && props.block.type === 'paragraph') {
      const [first, ...rest] = newBlocks;
      store.updateBlock(props.block.id, { type: 'image', src: first.src, content: '' });
      if (rest.length) store.insertBlocksAfter(props.block.id, rest);
    } else {
      store.insertBlocksAfter(props.block.id, newBlocks);
    }
  } catch (err) {
    toast.error((err as any)?.message || 'No se pudo subir la imagen.');
  }
};

const onPaste = (e: ClipboardEvent) => {
  const imageFiles = Array.from(e.clipboardData?.files || []).filter(f => f.type.startsWith('image/'));
  if (imageFiles.length) {
    e.preventDefault();
    uploadAndInsertImages(imageFiles);
    return;
  }

  e.preventDefault();
  const text = e.clipboardData?.getData('text/plain') || '';
  if (!text) return;

  const isEmpty = !(editorRef.value?.textContent || '').trim();

  // Una línea dentro de texto existente: insertar en el caret.
  if (!text.includes('\n') && !isEmpty) {
    document.execCommand('insertText', false, text);
    return;
  }

  // Bloque vacío o multilínea: insertText dejaría <div> por línea;
  // en su lugar se parsea como markdown y se crean bloques reales.
  const parsed = markdownToBlocks(text);
  if (!parsed.length) return;

  if (isEmpty) {
    const [first, ...rest] = parsed;
    if (first.children) {
      first.children.forEach(c => { c.parentId = props.block.id; });
    }
    store.updateBlock(props.block.id, {
      type: first.type,
      content: first.content,
      checked: first.checked,
      language: first.language,
      tableData: first.tableData,
      children: first.children
    });
    if (editorRef.value) editorRef.value.innerHTML = first.content || '';
    if (rest.length) store.insertBlocksAfter(props.block.id, rest);
  } else {
    store.insertBlocksAfter(props.block.id, parsed);
  }
};

const getPlaceholder = () => {
  if (props.block.type === 'h1') return 'Encabezado 1';
  if (props.block.type === 'h2') return 'Encabezado 2';
  if (props.block.type === 'h3') return 'Encabezado 3';
  if (props.block.type === 'h4') return 'Encabezado 4';
  if (props.block.type === 'h5') return 'Encabezado 5';
  if (props.block.type === 'h6') return 'Encabezado 6';
  if (props.block.type === 'code') return 'Escribe código aquí...';
  if (props.block.type === 'toggle') return 'Lista desplegable';
  return "Escribe '/' para comandos...";
};
</script>