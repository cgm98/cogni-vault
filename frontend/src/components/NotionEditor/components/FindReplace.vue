<template>
  <div v-if="state.visible" class="find-replace-bar" role="search" aria-label="Buscar y reemplazar" @keydown.esc="close">
    <div class="fr-row">
      <input
        ref="searchInputRef"
        v-model="state.query"
        type="text"
        placeholder="Buscar..."
        class="fr-input"
        @input="search"
        @keydown.enter.exact.prevent="next"
        @keydown.enter.shift.prevent="prev"
      />
      <span class="fr-count">{{ countLabel }}</span>
      <button type="button" class="fr-btn" title="Anterior (Shift+Enter)" :disabled="!state.matches.length" @click="prev">
        <ChevronUp :size="14" aria-hidden="true" />
      </button>
      <button type="button" class="fr-btn" title="Siguiente (Enter)" :disabled="!state.matches.length" @click="next">
        <ChevronDown :size="14" aria-hidden="true" />
      </button>
      <button type="button" class="fr-btn fr-close" title="Cerrar (Esc)" @click="close">
        <X :size="14" aria-hidden="true" />
      </button>
    </div>
    <div class="fr-row">
      <input
        v-model="state.replaceQuery"
        type="text"
        placeholder="Reemplazar..."
        class="fr-input"
        @keydown.enter.exact.prevent="replaceCurrent"
      />
      <button type="button" class="fr-btn fr-text" :disabled="!state.matches.length" @click="replaceCurrent">Reemplazar</button>
      <button type="button" class="fr-btn fr-text" :disabled="!state.matches.length" @click="replaceAll">Reemplazar todo</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import './FindReplace.css'
import { computed, nextTick, ref } from 'vue';
import { ChevronUp, ChevronDown, X } from 'lucide-vue-next';
import { useFindReplace } from '../composables/useFindReplace';

const { state, search, next, prev, replaceCurrent, replaceAll, open: openInternal, close } = useFindReplace();

const searchInputRef = ref<HTMLInputElement | null>(null);

const countLabel = computed(() => {
  if (!state.query) return '';
  return `${state.matches.length ? state.currentIndex + 1 : 0}/${state.matches.length}`;
});

const open = () => {
  openInternal();
  nextTick(() => searchInputRef.value?.focus());
};

defineExpose({ open });
</script>
