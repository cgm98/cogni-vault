<template>
  <div v-if="store.selectedIds.size > 1" class="selection-toolbar" role="toolbar" aria-label="Acciones sobre bloques seleccionados">
    <span class="selection-count">{{ store.selectedIds.size }} bloques seleccionados</span>
    <button type="button" class="sel-btn" @click="duplicate">
      <Copy :size="14" aria-hidden="true" />
      <span>Duplicar</span>
    </button>
    <button type="button" class="sel-btn danger" @click="remove">
      <Trash2 :size="14" aria-hidden="true" />
      <span>Eliminar</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import './SelectionToolbar.css'
import { Copy, Trash2 } from 'lucide-vue-next';
import { useDocumentStore } from '../stores/useDocumentStore';

const store = useDocumentStore();

const duplicate = () => store.duplicateBlocks(Array.from(store.selectedIds));
const remove = () => store.deleteBlocks(Array.from(store.selectedIds));
</script>
