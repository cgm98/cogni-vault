<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm p-4">
    <div class="bg-slate-850 border border-slate-700 rounded-xl shadow-2xl max-w-xl w-full overflow-hidden text-slate-100">
      <div class="p-3 border-b border-slate-700/60 flex items-center gap-3">
        <Search class="w-4 h-4 text-slate-400" />
        <input
          v-model="query"
          type="text"
          placeholder="Escribí un comando o nombre de nota..."
          class="flex-1 bg-transparent text-sm outline-none placeholder-slate-500 text-slate-100"
          autofocus
          @keydown.esc="$emit('close')"
        />
        <kbd class="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">ESC</kbd>
      </div>

      <div class="max-h-72 overflow-y-auto p-2 space-y-1">
        <div
          v-for="file in filteredFiles"
          :key="file.id"
          @click="select(file.id)"
          class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs cursor-pointer hover:bg-blue-600/20 hover:text-blue-400 transition-colors"
        >
          <FileText class="w-4 h-4 text-slate-400" />
          <span class="font-medium text-slate-200">{{ file.name }}</span>
        </div>
        <div v-if="filteredFiles.length === 0" class="text-center py-6 text-xs text-slate-500">
          Sin coincidencias
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Search, FileText } from 'lucide-vue-next';

const props = defineProps<{
  files?: any[];
  isOpen?: boolean;
}>();

const emit = defineEmits<{
  (e: 'selectFile', id: string): void;
  (e: 'close'): void;
}>();

const query = ref('');

const filteredFiles = computed(() => {
  if (!props.files) return [];
  if (!query.value.trim()) return props.files.slice(0, 8);
  const q = query.value.toLowerCase();
  return props.files.filter(f => f.name.toLowerCase().includes(q)).slice(0, 10);
});

function select(id: string) {
  emit('selectFile', id);
  emit('close');
}
</script>
