<template>
  <div v-if="visible" class="ne-slash-menu" role="menu" aria-label="Insertar bloque"
    :style="{ top: y + 'px', left: x + 'px' }" @mousedown.prevent>
    <div 
      v-for="(cmd, index) in filteredCommands" 
      :key="cmd.id"
      role="menuitem"
      :aria-selected="index === selectedIndex"
      :class="['slash-item', { active: index === selectedIndex }]"
      @click="select(cmd)"
    >
      <span class="icon" aria-hidden="true">{{ cmd.icon }}</span>
      <span class="label">{{ cmd.label }}</span>
    </div>
    <div v-if="filteredCommands.length === 0" class="slash-empty">No hay resultados</div>
  </div>
</template>

<script setup lang="ts">
import './SlashCommandMenu.css'
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  visible: boolean;
  x: number;
  y: number;
  query: string;
}>();

const emit = defineEmits<{
  (e: 'select', cmd: { id: string; label: string; icon: string }): void;
  (e: 'close'): void;
}>();

const commands = [
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
  { id: 'image', label: 'Imagen', icon: '🖼' },
  { id: 'table', label: 'Tabla', icon: '⊞' },
  { id: 'code', label: 'Código', icon: '<>' },
  { id: 'mermaid', label: 'Diagrama Mermaid', icon: '📊' },
  { id: 'abc', label: 'Partitura ABC', icon: '🎵' },
  { id: 'quote', label: 'Cita', icon: '"' },
  { id: 'divider', label: 'Divisor', icon: '—' },
  { id: 'toggle', label: 'Toggle list', icon: '▶' },
  { id: 'math', label: 'Ecuación matemática (LaTeX)', icon: 'f(x)' },
  { id: 'columns-2', label: '2 columnas', icon: '▥' },
  { id: 'columns-3', label: '3 columnas', icon: '▦' },
];

const selectedIndex = ref(0);

const filteredCommands = computed(() => {
  if (!props.query) return commands;
  const q = props.query.toLowerCase();
  return commands.filter(c => c.label.toLowerCase().includes(q));
});

watch(() => props.query, () => selectedIndex.value = 0);

const select = (cmd: typeof commands[0]) => emit('select', cmd);

const handleKeydown = (e: KeyboardEvent) => {
  if (!props.visible) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    e.stopPropagation();
    selectedIndex.value = (selectedIndex.value + 1) % filteredCommands.value.length;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    e.stopPropagation();
    selectedIndex.value = (selectedIndex.value - 1 + filteredCommands.value.length) % filteredCommands.value.length;
  } else if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    if (filteredCommands.value.length) select(filteredCommands.value[selectedIndex.value]);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    emit('close');
  }
};

onMounted(() => document.addEventListener('keydown', handleKeydown, true));
onUnmounted(() => document.removeEventListener('keydown', handleKeydown, true));
</script>