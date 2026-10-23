<template>
  <aside class="notes-copilot w-80 shrink-0 border-l border-slate-800 bg-slate-900/95 flex flex-col h-full shadow-xl">
    <div class="p-3 border-b border-slate-800 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Sparkles class="w-4 h-4 text-purple-400" />
        <span class="text-xs font-semibold text-slate-200">Asistente Copiloto</span>
      </div>
      <button @click="$emit('close')" class="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800">
        &times;
      </button>
    </div>

    <!-- Chat history -->
    <div class="flex-1 overflow-y-auto p-4 space-y-3">
      <div class="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 text-xs text-slate-300">
        ¡Hola! Puedo redactar borradores técnicos, analizar conceptos y sugerir wikilinks para tu vault.
      </div>
    </div>

    <!-- Input -->
    <div class="p-3 border-t border-slate-800 bg-slate-900">
      <div class="flex gap-2">
        <input
          v-model="prompt"
          @keyup.enter="handleSend"
          type="text"
          placeholder="Pregunta o pide un borrador..."
          class="flex-1 min-w-0 bg-slate-800 text-xs rounded-lg px-3 py-2 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
        />
        <button @click="handleSend" class="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors">
          <Send class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Sparkles, Send } from 'lucide-vue-next';

const props = defineProps<{
  files?: any[];
  activeFileId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'updateFileContent', fileId: string, content: string, isImmediate?: boolean): void;
  (e: 'openNote', id: string): void;
  (e: 'close'): void;
}>();

const prompt = ref('');

const handleSend = async () => {
  if (!prompt.value.trim()) return;
  const p = prompt.value;
  prompt.value = '';
  try {
    const res = await fetch('/api/concepts/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: p })
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.explanation && props.activeFileId) {
        emit('updateFileContent', props.activeFileId, data.explanation, true);
      }
    }
  } catch (err) {
    console.error('Error in Copilot draft:', err);
  }
};
</script>
