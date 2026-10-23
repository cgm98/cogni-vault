<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Plus, Search, FileText, Folder, FolderOpen, FolderPlus, ChevronRight, ChevronsDownUp } from 'lucide-vue-next';
import type { FileItem, FolderItem } from '../../types';
import { treeRows } from '../../lib/noteTree';
const props = defineProps<{ files?: FileItem[]; folders?: FolderItem[]; activeFileId?: string | null; loading?: boolean; error?: string; creating?: boolean }>();
const emit = defineEmits<{ (e: 'selectFile', id: string): void; (e: 'createFile', folderId?: string): void; (e: 'createFolder', parentId: string, name: string): void }>();
const searchQuery = ref('');
const searchInputRef = ref<HTMLInputElement | null>(null);
const expanded = ref(new Set<string>());
const selectedFolder = ref('root');
const folderName = ref('');
const addingFolder = ref(false);
const selected = computed(() => props.folders?.find(f => f.id === selectedFolder.value));
const canAddNote = computed(() => selected.value?.kind === 'domain' || selected.value?.kind === 'topic');
const childLabel = computed(() => selected.value?.kind === 'area' ? 'dominio' : selected.value?.kind === 'domain' ? 'tema' : 'área');
const rows = computed(() => treeRows(props.folders || [], props.files || [], expanded.value, searchQuery.value));
watch(() => props.folders, (folders, old) => {
  const previous = new Set(old?.map(f => f.id));
  for (const folder of folders || []) if (!previous.has(folder.id) && (!folder.parentId || folder.parentId === 'root')) expanded.value.add(folder.id);
  if (!folders?.some(f => f.id === selectedFolder.value)) selectedFolder.value = 'root';
}, { immediate: true });
watch(() => [props.activeFileId, props.files, props.folders] as const, () => {
  let id = props.files?.find(f => f.id === props.activeFileId)?.folderId;
  const seen = new Set<string>();
  while (id && id !== 'root' && !seen.has(id)) {
    seen.add(id); expanded.value.add(id);
    id = props.folders?.find(f => f.id === id)?.parentId;
  }
}, { immediate: true });
function toggle(folder: FolderItem) {
  selectedFolder.value = folder.id;
  if (expanded.value.has(folder.id)) expanded.value.delete(folder.id); else expanded.value.add(folder.id);
}
function createFolder() {
  if (!folderName.value.trim()) return;
  emit('createFolder', selectedFolder.value, folderName.value.trim());
  expanded.value.add(selectedFolder.value);
  folderName.value = ''; addingFolder.value = false;
}
function openSearch(term = '') { searchQuery.value = term; searchInputRef.value?.focus(); }
defineExpose({ openSearch });
</script>

<template>
  <aside class="notes-sidebar file-explorer" aria-label="Explorador de notas">
    <header class="tree-toolbar">
      <button class="tree-heading" @click="selectedFolder = 'root'" title="Seleccionar la raíz">Archivos</button>
      <button @click="expanded.clear()" title="Contraer carpetas" aria-label="Contraer carpetas"><ChevronsDownUp :size="15" /></button>
      <button @click="addingFolder = !addingFolder" :disabled="loading || !!error || selected?.kind === 'topic'" :title="'Crear ' + childLabel" :aria-label="'Crear ' + childLabel"><FolderPlus :size="16" /></button>
      <button @click="emit('createFile', canAddNote ? selectedFolder : 'root')" :disabled="loading || !!error || creating" title="Nueva nota" aria-label="Nueva nota"><Plus :size="17" /></button>
    </header>
    <form v-if="addingFolder" @submit.prevent="createFolder" class="tree-new-folder">
      <label for="new-tree-folder">Nuevo {{ childLabel }} en {{ selected?.name || 'este espacio' }}</label>
      <input id="new-tree-folder" v-model="folderName" placeholder="Nombre" required />
      <button type="submit">Crear</button><button type="button" @click="addingFolder = false">Cancelar</button>
    </form>
    <div class="tree-search"><Search :size="14" /><input ref="searchInputRef" v-model="searchQuery" placeholder="Buscar notas y carpetas…" aria-label="Buscar notas y carpetas" /></div>
    <div class="tree-scroll">
      <p v-if="loading || error" class="tree-empty">{{ loading ? 'Cargando…' : 'No se pudo cargar la organización' }}</p>
      <template v-else>
        <div v-for="row in rows" :key="(row.folder ? 'folder:' : 'file:') + row.id" class="tree-row" :style="{ paddingLeft: (8 + row.depth * 16) + 'px' }">
          <button v-if="row.folder" class="tree-entry tree-folder" :class="{ selected: selectedFolder === row.id }" :aria-expanded="!!searchQuery.trim() || expanded.has(row.id)" :title="row.name" @click="toggle(row.folder)">
            <ChevronRight :size="12" class="tree-chevron" :class="{ open: !!searchQuery.trim() || expanded.has(row.id) }" />
            <component :is="expanded.has(row.id) || searchQuery.trim() ? FolderOpen : Folder" :size="15" />
            <span class="tree-label">{{ row.name }}</span><small>{{ row.count }}</small>
          </button>
          <button v-else class="tree-entry tree-file" :class="{ active: activeFileId === row.id }" :aria-current="activeFileId === row.id ? 'page' : undefined" :title="row.name" @click="emit('selectFile', row.id)"><FileText :size="14" /><span class="tree-label">{{ row.name }}</span></button>
        </div>
        <p v-if="!rows.length" class="tree-empty">{{ searchQuery ? 'Sin coincidencias' : 'Este espacio está vacío. Crea un área para organizar tus notas.' }}</p>
      </template>
    </div>
    <footer class="tree-footer">{{ selected?.name || 'Raíz' }} · {{ files?.length || 0 }} notas</footer>
  </aside>
</template>

<style scoped>
.file-explorer{width:290px;min-width:220px;flex-shrink:0;height:100%;display:flex;flex-direction:column;background:#0f172a;border-right:1px solid #263247;color:#cbd5e1;font-size:12px}
.tree-toolbar{display:flex;align-items:center;gap:4px;padding:10px;border-bottom:1px solid #263247}.tree-toolbar button{padding:5px;border-radius:5px;color:#94a3b8}.tree-toolbar .tree-heading{margin-right:auto;text-transform:uppercase;font-size:11px;font-weight:600;letter-spacing:1px}.tree-toolbar button:hover{background:#1e293b;color:white}button:disabled{opacity:.35}.tree-search{display:flex;align-items:center;gap:7px;margin:10px;padding:7px;background:#1e293b;border:1px solid #334155;border-radius:6px}.tree-search input{width:100%;min-width:0;background:transparent;outline:none}.tree-scroll{flex:1;overflow:auto;padding:0 6px 12px}.tree-row{min-width:0}.tree-entry{display:flex;align-items:center;gap:6px;width:100%;padding:6px 4px;text-align:left;border-radius:5px;min-width:0}.tree-entry svg{flex-shrink:0}.tree-entry:hover{background:#1e293b}.tree-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}.tree-folder>svg:nth-child(2){color:#e2b773}.tree-folder small{font-size:10px;color:#64748b}.tree-chevron{transition:transform .15s}.tree-chevron.open{transform:rotate(90deg)}.tree-file{padding-left:22px}.tree-file.active{background:#1d4ed833;color:#93c5fd}.tree-folder.selected{background:#33415555}.tree-footer{padding:10px;border-top:1px solid #263247;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tree-empty{padding:20px 10px;color:#94a3b8;line-height:1.6}.tree-new-folder{padding:10px;background:#1e293b}.tree-new-folder label{display:block;margin-bottom:6px}.tree-new-folder input{width:100%;background:#0f172a;padding:6px;border:1px solid #475569;border-radius:4px}.tree-new-folder button{padding:7px;color:#93c5fd}button:focus-visible,input:focus-visible{outline:2px solid #60a5fa;outline-offset:1px}
</style>
