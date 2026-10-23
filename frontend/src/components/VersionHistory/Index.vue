<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { requestJson } from '../../lib/api';
import type { Concept } from '../../types/concept.types';

const props = defineProps<{ conceptId: string }>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'restored', concept: Concept): void;
}>();
interface VersionSummary { id: string; created_at: string }
interface Version extends VersionSummary { title: string; explanation: string }
const versions = ref<VersionSummary[]>([]);
const selected = ref<Version | null>(null);
const loading = ref(true);
const busy = ref(false);
const error = ref('');
const confirmRestore = ref(false);
const base = '/api/concepts/' + encodeURIComponent(props.conceptId) + '/versions';
async function load() {
  loading.value = true;
  error.value = '';
  try { versions.value = await requestJson<VersionSummary[]>(base); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'No se pudo cargar el historial'; }
  finally { loading.value = false; }
}
async function preview(id: string) {
  busy.value = true;
  error.value = '';
  confirmRestore.value = false;
  try { selected.value = await requestJson<Version>(base + '/' + encodeURIComponent(id)); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'No se pudo cargar la versión'; }
  finally { busy.value = false; }
}
async function restore() {
  if (!selected.value || busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const restored = await requestJson<Concept>(base + '/' + encodeURIComponent(selected.value.id) + '/restore', { method: 'POST' });
    emit('restored', restored);
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'No se pudo restaurar la versión'; }
  finally { busy.value = false; }
}
onMounted(load);
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <section role="dialog" aria-modal="true" aria-label="Historial de versiones" class="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-3xl w-full max-h-[90dvh] overflow-y-auto text-slate-100">
        <header class="flex items-center justify-between gap-4 mb-4">
          <h2 class="font-semibold">Historial de versiones</h2>
          <button @click="emit('close')" :disabled="busy" aria-label="Cerrar historial" class="px-2 py-1 rounded hover:bg-slate-800">×</button>
        </header>
        <p v-if="loading" role="status" class="text-sm text-slate-400">Cargando versiones…</p>
        <div v-else-if="error" role="alert" class="text-sm text-red-400 mb-4">{{ error }} <button @click="load" class="underline">Reintentar</button></div>
        <p v-else-if="!versions.length" class="text-sm text-slate-400">Esta nota todavía no tiene versiones guardadas.</p>
        <div v-if="versions.length" class="grid sm:grid-cols-[180px_minmax(0,1fr)] gap-4">
          <div class="flex flex-col gap-2">
            <button v-for="version in versions" :key="version.id" @click="preview(version.id)" :disabled="busy"
              class="rounded-lg border px-3 py-2 text-left text-xs" :class="selected?.id === version.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:bg-slate-800'">
              {{ new Date(version.created_at).toLocaleString('es-PE') }}
            </button>
          </div>
          <div class="min-w-0">
            <template v-if="selected">
              <h3 class="font-medium mb-2">{{ selected.title }}</h3>
              <pre class="whitespace-pre-wrap break-words text-xs leading-6 p-4 rounded-lg bg-slate-950 max-h-80 overflow-y-auto">{{ selected.explanation || '(Nota vacía)' }}</pre>
              <p v-if="confirmRestore" class="text-sm mt-3 text-slate-300">Se reemplazará el título y contenido actuales. El servidor conservará una versión del estado anterior.</p>
              <button v-if="!confirmRestore" @click="confirmRestore = true" :disabled="busy" class="mt-3 px-3 py-2 text-sm rounded-lg bg-indigo-600">Restaurar esta versión</button>
              <div v-else class="flex gap-3 mt-3">
                <button @click="restore" :disabled="busy" class="px-3 py-2 text-sm rounded-lg bg-indigo-600">{{ busy ? 'Restaurando…' : 'Confirmar restauración' }}</button>
                <button @click="confirmRestore = false" :disabled="busy" class="text-sm">Cancelar</button>
              </div>
            </template>
            <p v-else class="text-sm text-slate-400">Selecciona una versión para revisar su contenido.</p>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>
