<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-24 p-4"
    @click.self="close"
  >
    <div
      class="bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden max-h-[80vh] text-slate-100 font-sans"
    >
      <!-- Cabecera de Entrada de Búsqueda -->
      <div class="p-3.5 border-b border-slate-800 flex items-center gap-3">
        <Sparkles class="w-5 h-5 text-indigo-400 shrink-0 animate-pulse" />
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          type="text"
          placeholder="Búsqueda híbrida (FTS5 BM25 + sqlite-vec)..."
          class="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          @keydown.down.prevent="navigateResults(1)"
          @keydown.up.prevent="navigateResults(-1)"
          @keydown.enter.prevent="selectHighlighted"
          @keydown.esc.prevent="close"
        />
        <div class="flex items-center gap-2">
          <span v-if="searchStore.loading" class="text-xs text-indigo-400 animate-spin">⟳</span>
          <kbd class="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-400 font-mono">ESC</kbd>
        </div>
      </div>

      <!-- Barra de Ajuste de Equilibrio Alfa (BM25 vs Vectorial) -->
      <div class="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-3">
          <span class="text-slate-400 font-medium">Equilibrio Canal:</span>
          <div class="flex items-center gap-2">
            <span class="text-[11px] text-indigo-400 font-mono">Semántico (0.0)</span>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              v-model.number="searchStore.alpha"
              class="w-24 sm:w-32 accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              @input="triggerSearch"
            />
            <span class="text-[11px] text-emerald-400 font-mono">Léxico (1.0)</span>
          </div>
          <span class="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-mono">
            α = {{ searchStore.alpha.toFixed(2) }}
          </span>
        </div>

        <!-- Filtros por Tipo de Entidad -->
        <div class="flex items-center gap-1.5 overflow-x-auto">
          <button
            v-for="t in availableTypes"
            :key="t.key"
            @click="toggleType(t.key)"
            class="px-2 py-0.5 rounded text-[10px] font-medium transition"
            :class="searchStore.selectedTypes.includes(t.key) ? t.activeClass : 'bg-slate-800/50 text-slate-500 hover:text-slate-300'"
          >
            {{ t.label }}
          </button>
        </div>
      </div>

      <!-- Lista de Resultados Recuperados -->
      <div class="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-slate-800/40">
        <div v-if="searchStore.loading" class="p-8 text-center text-slate-500 text-xs">
          Ejecutando inferencia híbrida y ranking RRF...
        </div>
        <div v-else-if="!searchQuery.trim()" class="p-8 text-center text-slate-500 text-xs">
          Escribe una consulta para recuperar conceptos, fuentes o anclas por afinidad semántica y léxica.
        </div>
        <div v-else-if="searchStore.results.length === 0" class="p-8 text-center text-slate-500 text-xs">
          Sin coincidencias en este espacio de trabajo.
        </div>
        <template v-else>
          <div
            v-for="(item, idx) in searchStore.results"
            :key="item.entity_id"
            @click="handleSelect(item)"
            class="p-2.5 rounded-lg cursor-pointer transition flex flex-col gap-1 text-xs"
            :class="highlightedIndex === idx ? 'bg-indigo-950/60 border border-indigo-500/30' : 'hover:bg-slate-800/60 border border-transparent'"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span
                  class="px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase tracking-wider shrink-0"
                  :class="getTypeBadgeClass(item.entity_type)"
                >
                  {{ item.entity_type }}
                </span>
                <span class="font-medium text-slate-200 truncate">{{ item.title }}</span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span
                  v-if="item.vector_distance !== undefined"
                  class="text-[10px] text-slate-500 font-mono hidden sm:inline"
                  title="Distancia de coseno vec0"
                >
                  dist: {{ item.vector_distance.toFixed(3) }}
                </span>
                <span
                  class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                  :class="item.hybrid_score >= 0.7 ? 'bg-emerald-500/20 text-emerald-300' : item.hybrid_score >= 0.4 ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-800 text-slate-400'"
                >
                  {{ Math.round(item.hybrid_score * 100) }}% RRF
                </span>
              </div>
            </div>

            <!-- Snippet con Contexto -->
            <p class="text-slate-400 text-[11px] line-clamp-2 leading-relaxed">
              {{ item.snippet }}
            </p>
          </div>
        </template>
      </div>

      <!-- Pie del Modal -->
      <div class="px-4 py-2 border-t border-slate-800/80 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-500">
        <span>Total: {{ searchStore.totalResults }} resultados</span>
        <div class="flex items-center gap-3">
          <span><kbd class="font-mono text-slate-400">↑↓</kbd> navegar</span>
          <span><kbd class="font-mono text-slate-400">↵</kbd> abrir nota</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { Sparkles } from 'lucide-vue-next';
import { useSearchStore } from '../../stores/search.store';
import type { SearchResultItem, SearchEntityType } from '../../types/search.types';

const props = defineProps<{
  isOpen: boolean;
  workspaceId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'selectConcept', conceptId: string): void;
}>();

const searchStore = useSearchStore();
const searchQuery = ref('');
const searchInputRef = ref<HTMLInputElement | null>(null);
const highlightedIndex = ref(0);

let debounceTimer: NodeJS.Timeout | null = null;

const availableTypes = [
  { key: 'concept', label: 'Conceptos', activeClass: 'bg-blue-600/30 text-blue-300 border border-blue-500/40' },
  { key: 'anchor', label: 'Evidencias', activeClass: 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40' },
  { key: 'source', label: 'Fuentes', activeClass: 'bg-purple-600/30 text-purple-300 border border-purple-500/40' },
  { key: 'claim', label: 'Claims', activeClass: 'bg-amber-600/30 text-amber-300 border border-amber-500/40' }
];

watch(() => props.isOpen, (open) => {
  if (open) {
    highlightedIndex.value = 0;
    nextTick(() => searchInputRef.value?.focus());
    if (searchQuery.value.trim()) triggerSearch();
  } else {
    searchStore.clear();
    searchQuery.value = '';
  }
});

watch(searchQuery, () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    triggerSearch();
  }, 180);
});

function triggerSearch() {
  if (!props.workspaceId || !searchQuery.value.trim()) {
    searchStore.clear();
    return;
  }
  searchStore.search(props.workspaceId, searchQuery.value.trim());
}

function toggleType(typeKey: string) {
  const idx = searchStore.selectedTypes.indexOf(typeKey);
  if (idx !== -1) {
    if (searchStore.selectedTypes.length > 1) {
      searchStore.selectedTypes.splice(idx, 1);
    }
  } else {
    searchStore.selectedTypes.push(typeKey);
  }
  triggerSearch();
}

function navigateResults(delta: number) {
  if (searchStore.results.length === 0) return;
  highlightedIndex.value = (highlightedIndex.value + delta + searchStore.results.length) % searchStore.results.length;
}

function selectHighlighted() {
  if (searchStore.results.length === 0) return;
  const item = searchStore.results[highlightedIndex.value];
  if (item) handleSelect(item);
}

function handleSelect(item: SearchResultItem) {
  if (item.entity_type === 'concept') {
    emit('selectConcept', item.entity_id);
    close();
  }
}

function getTypeBadgeClass(type: SearchEntityType): string {
  switch (type) {
    case 'concept': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    case 'anchor': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    case 'source': return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
    case 'claim': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    default: return 'bg-slate-800 text-slate-400';
  }
}

function close() {
  emit('close');
}
</script>
