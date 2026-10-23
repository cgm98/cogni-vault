<template>
  <div class="block-ctx-menu" role="menu" aria-label="Opciones de bloque"
    :style="{ top: y + 'px', left: x + 'px' }" @mousedown.prevent>
    <button type="button" class="menu-item" role="menuitem" @click="$emit('duplicate')">
      <Copy :size="14" class="menu-icon" aria-hidden="true" />
      <span>Duplicar</span>
    </button>

    <div class="menu-divider"></div>
    <div class="menu-label">Convertir a</div>
    <button
      v-for="t in convertTypes"
      :key="t.id"
      type="button"
      class="menu-item"
      role="menuitem"
      @click="$emit('convert', t.id)"
    >
      <span class="menu-icon" aria-hidden="true">{{ t.icon }}</span>
      <span>{{ t.label }}</span>
    </button>

    <div class="menu-divider"></div>
    <div class="menu-align-row">
      <button type="button" class="menu-align-btn" title="Alinear a la izquierda" aria-label="Alinear a la izquierda" @click="$emit('align', 'left')">
        <AlignLeft :size="14" aria-hidden="true" />
      </button>
      <button type="button" class="menu-align-btn" title="Centrar" aria-label="Centrar" @click="$emit('align', 'center')">
        <AlignCenter :size="14" aria-hidden="true" />
      </button>
      <button type="button" class="menu-align-btn" title="Alinear a la derecha" aria-label="Alinear a la derecha" @click="$emit('align', 'right')">
        <AlignRight :size="14" aria-hidden="true" />
      </button>
    </div>

    <div class="menu-divider"></div>
    <button type="button" class="menu-item delete" role="menuitem" @click="$emit('delete')">
      <Trash2 :size="14" class="menu-icon" aria-hidden="true" />
      <span>Eliminar bloque</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import './BlockMenu.css'
import { Copy, Trash2, AlignLeft, AlignCenter, AlignRight } from 'lucide-vue-next';

defineEmits<{
  (e: 'duplicate'): void;
  (e: 'convert', type: string): void;
  (e: 'align', align: 'left' | 'center' | 'right'): void;
  (e: 'delete'): void;
}>();

defineProps<{ x: number; y: number }>();

// Tipos de destino con conversión directa de `content` (string). Se excluyen
// image/table/math/code/mermaid/abc/divider: tienen forma de datos propia
// (tableData, src, language) que no sale de convertir un tipo a otro.
const convertTypes = [
  { id: 'paragraph', label: 'Texto', icon: '¶' },
  { id: 'h1', label: 'Heading 1', icon: 'H1' },
  { id: 'h2', label: 'Heading 2', icon: 'H2' },
  { id: 'h3', label: 'Heading 3', icon: 'H3' },
  { id: 'h4', label: 'Heading 4', icon: 'H4' },
  { id: 'h5', label: 'Heading 5', icon: 'H5' },
  { id: 'h6', label: 'Heading 6', icon: 'H6' },
  { id: 'bulleted-list', label: 'Lista', icon: '•' },
  { id: 'numbered-list', label: 'Lista numerada', icon: '1.' },
  { id: 'checkbox', label: 'To-do', icon: '[]' },
  { id: 'quote', label: 'Cita', icon: '"' },
  { id: 'toggle', label: 'Toggle list', icon: '▶' },
];
</script>
