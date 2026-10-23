<template>
  <div v-if="visible" class="ne-slash-menu" role="menu" aria-label="Mencionar nota o símbolo de código"
    :style="{ top: y + 'px', left: x + 'px' }" @mousedown.prevent>
    <div
      v-for="(item, index) in results"
      :key="item.id"
      role="menuitem"
      :aria-selected="index === selectedIndex"
      :class="['slash-item', { active: index === selectedIndex }]"
      @click="select(item)"
    >
      <span class="icon" aria-hidden="true">{{ item.kind === 'code' ? '⚡' : '@' }}</span>
      <span class="label">{{ item.title }}</span>
      <span v-if="item.subtitle" class="sub" style="font-size: 10px; opacity: 0.6; margin-left: auto;">{{ item.subtitle }}</span>
    </div>
    <div v-if="results.length === 0" class="slash-empty">No hay resultados</div>
  </div>
</template>

<script setup lang="ts">
import './SlashCommandMenu.css'
import { ref, watch, onMounted, onUnmounted } from 'vue';

export interface MentionResult { id: string; title: string; kind?: 'note' | 'code'; subtitle?: string; }

const props = defineProps<{
  visible: boolean;
  x: number;
  y: number;
  results: MentionResult[];
}>();

const emit = defineEmits<{
  (e: 'select', item: MentionResult): void;
  (e: 'close'): void;
}>();

const selectedIndex = ref(0);

watch(() => props.results, () => selectedIndex.value = 0);

const select = (item: MentionResult) => emit('select', item);

const handleKeydown = (e: KeyboardEvent) => {
  if (!props.visible) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    e.stopPropagation();
    selectedIndex.value = (selectedIndex.value + 1) % props.results.length;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    e.stopPropagation();
    selectedIndex.value = (selectedIndex.value - 1 + props.results.length) % props.results.length;
  } else if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    if (props.results.length) select(props.results[selectedIndex.value]);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    emit('close');
  }
};

onMounted(() => document.addEventListener('keydown', handleKeydown, true));
onUnmounted(() => document.removeEventListener('keydown', handleKeydown, true));
</script>
