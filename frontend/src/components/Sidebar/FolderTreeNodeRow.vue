<template>
  <div class="folder-node-row">
    <!-- Fila de la Carpeta -->
    <div
      class="flex items-center justify-between group py-1 px-1.5 rounded hover:bg-slate-800/60 cursor-pointer transition text-slate-300 hover:text-white"
      :style="{ paddingLeft: `${8 + depth * 14}px` }"
      @click="emit('toggle', node.id)"
    >
      <div class="flex items-center gap-1.5 min-w-0 flex-1">
        <ChevronRight
          class="w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform duration-150"
          :class="{ 'rotate-90 text-slate-300': isExpanded }"
        />
        <component
          :is="isExpanded ? FolderOpen : Folder"
          class="w-3.5 h-3.5 shrink-0 text-amber-400"
        />
        <span class="truncate font-medium text-xs">{{ node.name }}</span>
        <span class="text-[10px] text-slate-500 ml-1">({{ totalConceptsCount }})</span>
      </div>

      <!-- Acciones de Carpeta en Hover -->
      <div class="hidden group-hover:flex items-center gap-1 shrink-0 ml-1" @click.stop>
        <button
          @click="emit('createFile', node.id)"
          class="p-0.5 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-700/60 transition"
          title="Nueva nota en esta carpeta"
        >
          <FilePlus class="w-3 h-3" />
        </button>
        <button
          @click="emit('createSubfolder', node.id)"
          class="p-0.5 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-700/60 transition"
          title="Nueva subcarpeta"
        >
          <FolderPlus class="w-3 h-3" />
        </button>
        <button
          @click="emit('openMove', { id: node.id, name: node.name, version: node.version })"
          class="p-0.5 rounded text-slate-400 hover:text-indigo-400 hover:bg-slate-700/60 transition"
          title="Mover carpeta"
        >
          <FolderInput class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Contenido Expandido: Subcarpetas y Notas Hijas -->
    <div v-if="isExpanded">
      <!-- Subcarpetas Recursivas -->
      <FolderTreeNodeRow
        v-for="child in node.children || []"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :expanded-set="expandedSet"
        :active-file-id="activeFileId"
        :filter-query="filterQuery"
        @toggle="(id) => emit('toggle', id)"
        @select-file="(id) => emit('selectFile', id)"
        @create-file="(folderId) => emit('createFile', folderId)"
        @create-subfolder="(parentId) => emit('createSubfolder', parentId)"
        @open-move="(folder) => emit('openMove', folder)"
      />

      <!-- Notas Hijas de esta Carpeta -->
      <div
        v-for="concept in node.concepts || []"
        :key="concept.id"
        @click="emit('selectFile', concept.id)"
        class="flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer transition group"
        :style="{ paddingLeft: `${24 + depth * 14}px` }"
        :class="activeFileId === concept.id ? 'bg-blue-600/20 text-blue-300 font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'"
      >
        <FileText class="w-3.5 h-3.5 shrink-0 opacity-70 group-hover:opacity-100" />
        <span class="truncate flex-1 text-xs">{{ concept.title }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  Folder,
  FolderOpen,
  FolderPlus,
  FilePlus,
  FileText,
  ChevronRight,
  FolderInput
} from 'lucide-vue-next';
import type { FolderTreeNode } from '../../types/folder.types';

const props = defineProps<{
  node: FolderTreeNode;
  depth: number;
  expandedSet: Set<string>;
  activeFileId: string | null;
  filterQuery: string;
}>();

const emit = defineEmits<{
  (e: 'toggle', folderId: string): void;
  (e: 'selectFile', conceptId: string): void;
  (e: 'createFile', folderId: string | null): void;
  (e: 'createSubfolder', parentId: string): void;
  (e: 'openMove', folder: { id: string; name: string; version: number }): void;
}>();

const isExpanded = computed(() => {
  return !!props.filterQuery.trim() || props.expandedSet.has(props.node.id);
});

const totalConceptsCount = computed(() => {
  let count = props.node.concepts?.length || 0;
  function countRec(children: FolderTreeNode[]) {
    for (const child of children) {
      count += (child.concepts?.length || 0);
      if (child.children) countRec(child.children);
    }
  }
  if (props.node.children) countRec(props.node.children);
  return count;
});
</script>
