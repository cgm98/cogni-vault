<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div class="bg-slate-850 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
      <h3 class="text-lg font-semibold mb-4 text-slate-100">Copia de Seguridad del Vault</h3>
      <div class="space-y-4">
        <button @click="handleExport" class="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors">
          Exportar ZIP completo
        </button>
        <div class="border-t border-slate-700/60 pt-4">
          <label class="block text-sm text-slate-400 mb-2">Importar Vault (.zip)</label>
          <input type="file" accept=".zip" @change="handleImport" class="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-750 file:text-slate-200 hover:file:bg-slate-700" />
        </div>
      </div>
      <div class="mt-6 flex justify-end">
        <button @click="$emit('close')" class="px-4 py-2 bg-slate-750 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
          Cerrar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ExportService } from '../../services/export.service';

defineProps<{
  isOpen?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const handleExport = () => {
  ExportService.exportVault();
};

const handleImport = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    await ExportService.importVault(target.files[0]);
    emit('close');
  }
};
</script>
