<template>
  <div class="folder-tree-explorer flex flex-col h-full text-xs select-none">
    <!-- Toolbar de Carpetas -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-slate-800/80 bg-slate-900/40">
      <div class="flex items-center gap-1.5 font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
        <FolderTree class="w-3.5 h-3.5 text-amber-400" />
        <span>Carpetas (N-Niveles)</span>
      </div>
      <div class="flex items-center gap-1">
        <button
          @click="openNewFolderModal(null)"
          class="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Nueva carpeta en la raíz"
        >
          <FolderPlus class="w-3.5 h-3.5" />
        </button>
        <button
          @click="emit('createFile', null)"
          class="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Nueva nota en la raíz"
        >
          <FilePlus class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Buscador / Filtro Rápido -->
    <div class="px-2 py-1.5 border-b border-slate-800/50">
      <div class="relative">
        <Search class="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2" />
        <input
          v-model="filterQuery"
          type="text"
          placeholder="Filtrar notas y carpetas..."
          class="w-full bg-slate-950/70 border border-slate-800 rounded pl-7 pr-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>
    </div>

    <!-- Lista Arbórea con Scroll -->
    <div class="flex-1 overflow-y-auto px-1 py-1.5 space-y-0.5">
      <div v-if="folderStore.loading" class="p-4 text-center text-slate-500">
        Cargando árbol de carpetas...
      </div>
      <div v-else-if="folderStore.error" class="p-3 text-rose-400 text-center">
        {{ folderStore.error }}
      </div>
      <div v-else-if="filteredNodes.length === 0 && filteredRootConcepts.length === 0" class="p-4 text-center text-slate-500">
        {{ filterQuery ? 'Sin coincidencias' : 'Espacio vacío. Crea tu primera carpeta.' }}
      </div>
      <template v-else>
        <!-- Nodos de Carpetas Recursivos -->
        <FolderTreeNodeRow
          v-for="node in filteredNodes"
          :key="node.id"
          :node="node"
          :depth="0"
          :expanded-set="expandedFolders"
          :active-file-id="activeFileId"
          :filter-query="filterQuery"
          @toggle="toggleFolder"
          @select-file="(id) => emit('selectFile', id)"
          @create-file="(folderId) => emit('createFile', folderId)"
          @create-subfolder="(parentId) => openNewFolderModal(parentId)"
          @open-move="(folder) => openMoveModal(folder)"
        />

        <!-- Notas en la Raíz -->
        <div v-if="filteredRootConcepts.length > 0" class="pt-2 border-t border-slate-800/40 mt-2">
          <div class="px-2 py-1 text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
            Notas en Raíz
          </div>
          <button
            v-for="concept in filteredRootConcepts"
            :key="concept.id"
            @click="emit('selectFile', concept.id)"
            class="w-full flex items-center gap-1.5 px-2.5 py-1 rounded text-left transition group"
            :class="activeFileId === concept.id ? 'bg-blue-600/20 text-blue-300 font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'"
          >
            <FileText class="w-3.5 h-3.5 shrink-0 opacity-70 group-hover:opacity-100" />
            <span class="truncate flex-1">{{ concept.title }}</span>
          </button>
        </div>
      </template>
    </div>

    <!-- Modal para Crear Nueva Carpeta -->
    <div v-if="isNewFolderModalOpen" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-slate-900 border border-slate-800 rounded-lg max-w-sm w-full p-4 shadow-xl">
        <h3 class="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <FolderPlus class="w-4 h-4 text-amber-400" />
          <span>{{ targetParentId ? 'Nueva Subcarpeta' : 'Nueva Carpeta Raíz' }}</span>
        </h3>
        <form @submit.prevent="handleCreateFolderSubmit">
          <input
            ref="newFolderInputRef"
            v-model="newFolderName"
            type="text"
            placeholder="Nombre de la carpeta"
            required
            class="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 mb-4"
          />
          <div class="flex justify-end gap-2">
            <button
              type="button"
              @click="isNewFolderModalOpen = false"
              class="px-3 py-1.5 rounded text-xs text-slate-400 hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              :disabled="!newFolderName.trim()"
              class="px-3 py-1.5 rounded text-xs bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50 transition"
            >
              Crear Carpeta
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal para Mover Carpeta con Control de Versión OCC -->
    <div v-if="isMoveModalOpen && folderToMove" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full p-4 shadow-xl">
        <h3 class="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
          <FolderInput class="w-4 h-4 text-indigo-400" />
          <span>Mover Carpeta: "{{ folderToMove.name }}"</span>
        </h3>
        <p class="text-[11px] text-slate-400 mb-4">
          Selecciona la carpeta destino o mueve a la raíz. Se validará contra ciclos ($D &lt; 30$) y versión concurrente (v{{ folderToMove.version }}).
        </p>

        <div class="mb-4">
          <label class="block text-[11px] text-slate-400 mb-1">Destino:</label>
          <select
            v-model="moveTargetParentId"
            class="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option :value="null">📁 [Raíz del Espacio]</option>
            <option
              v-for="target in eligibleMoveTargets"
              :key="target.id"
              :value="target.id"
            >
              {{ '— '.repeat(target.depth) }}📁 {{ target.name }}
            </option>
          </select>
        </div>

        <div class="flex justify-end gap-2">
          <button
            type="button"
            @click="isMoveModalOpen = false"
            class="px-3 py-1.5 rounded text-xs text-slate-400 hover:bg-slate-800 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            @click="handleMoveFolderSubmit"
            class="px-3 py-1.5 rounded text-xs bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition"
          >
            Confirmar Movimiento
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import {
  FolderTree,
  FolderPlus,
  FilePlus,
  FileText,
  Search,
  FolderInput
} from 'lucide-vue-next';
import { useFolderStore } from '../../stores/folder.store';
import type { FolderTreeNode } from '../../types/folder.types';
import FolderTreeNodeRow from './FolderTreeNodeRow.vue';

const props = defineProps<{
  workspaceId: string;
  activeFileId: string | null;
}>();

const emit = defineEmits<{
  (e: 'selectFile', conceptId: string): void;
  (e: 'createFile', folderId: string | null): void;
}>();

const folderStore = useFolderStore();
const expandedFolders = ref(new Set<string>());
const filterQuery = ref('');

// Modales
const isNewFolderModalOpen = ref(false);
const newFolderName = ref('');
const targetParentId = ref<string | null>(null);
const newFolderInputRef = ref<HTMLInputElement | null>(null);

const isMoveModalOpen = ref(false);
const folderToMove = ref<{ id: string; name: string; version: number } | null>(null);
const moveTargetParentId = ref<string | null>(null);

function toggleFolder(folderId: string) {
  if (expandedFolders.value.has(folderId)) {
    expandedFolders.value.delete(folderId);
  } else {
    expandedFolders.value.add(folderId);
  }
}

function openNewFolderModal(parentId: string | null) {
  targetParentId.value = parentId;
  newFolderName.value = '';
  isNewFolderModalOpen.value = true;
  nextTick(() => newFolderInputRef.value?.focus());
}

async function handleCreateFolderSubmit() {
  if (!newFolderName.value.trim() || !props.workspaceId) return;
  try {
    const created = await folderStore.createFolder(
      props.workspaceId,
      newFolderName.value.trim(),
      targetParentId.value
    );
    if (targetParentId.value) expandedFolders.value.add(targetParentId.value);
    expandedFolders.value.add(created.id);
    isNewFolderModalOpen.value = false;
  } catch (err: any) {
    alert(err.message || 'Error al crear carpeta');
  }
}

function openMoveModal(folder: { id: string; name: string; version: number }) {
  folderToMove.value = folder;
  moveTargetParentId.value = null;
  isMoveModalOpen.value = true;
}

// Prevenir seleccionar la misma carpeta a mover
const eligibleMoveTargets = computed(() => {
  if (!folderToMove.value) return [];
  return folderStore.flattenedFolders.filter(f => f.id !== folderToMove.value!.id);
});

async function handleMoveFolderSubmit() {
  if (!folderToMove.value || !props.workspaceId) return;
  try {
    await folderStore.moveFolder(
      props.workspaceId,
      folderToMove.value.id,
      moveTargetParentId.value,
      folderToMove.value.version
    );
    isMoveModalOpen.value = false;
  } catch (err: any) {
    alert(err.message || 'Error al mover carpeta');
  }
}

// Filtro local de carpetas y conceptos
const filteredNodes = computed(() => {
  if (!filterQuery.value.trim()) return folderStore.tree;
  const q = filterQuery.value.toLowerCase();

  function matchNode(node: FolderTreeNode): FolderTreeNode | null {
    const matchesName = node.name.toLowerCase().includes(q);
    const matchingConcepts = (node.concepts || []).filter(c => c.title.toLowerCase().includes(q));
    const matchingChildren: FolderTreeNode[] = [];

    for (const child of node.children || []) {
      const matchedChild = matchNode(child);
      if (matchedChild) matchingChildren.push(matchedChild);
    }

    if (matchesName || matchingConcepts.length > 0 || matchingChildren.length > 0) {
      expandedFolders.value.add(node.id);
      return {
        ...node,
        concepts: matchesName ? node.concepts : matchingConcepts,
        children: matchingChildren
      };
    }
    return null;
  }

  const results: FolderTreeNode[] = [];
  for (const rootNode of folderStore.tree) {
    const matched = matchNode(rootNode);
    if (matched) results.push(matched);
  }
  return results;
});

const filteredRootConcepts = computed(() => {
  if (!filterQuery.value.trim()) return folderStore.rootConcepts;
  const q = filterQuery.value.toLowerCase();
  return folderStore.rootConcepts.filter(c => c.title.toLowerCase().includes(q));
});
</script>
