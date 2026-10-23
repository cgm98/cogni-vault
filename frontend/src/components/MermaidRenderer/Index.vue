<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { renderMermaid } from '../../lib/mermaid';
const props = defineProps<{ code?: string }>();
const svg = ref('');
const error = ref('');
const loading = ref(false);
const dialog = ref<HTMLDialogElement>();
let revision = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
watch(() => props.code, code => {
  const request = ++revision;
  clearTimeout(timer);
  svg.value = ''; error.value = ''; loading.value = !!code?.trim();
  if (!code?.trim()) return;
  timer = setTimeout(async () => {
    try {
      const result = await renderMermaid(code);
      if (request === revision) svg.value = result;
    } catch (reason) {
      if (request === revision) error.value = reason instanceof Error ? reason.message : 'No se pudo renderizar el diagrama';
    } finally { if (request === revision) loading.value = false; }
  }, 150);
}, { immediate: true });
onBeforeUnmount(() => { ++revision; clearTimeout(timer); dialog.value?.close(); });
function openModal() { if (svg.value) dialog.value?.showModal(); }
function downloadScreenshot() {
  if (!svg.value) return;
  const url = URL.createObjectURL(new Blob([svg.value], { type: 'image/svg+xml;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'diagrama.svg'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
defineExpose({ openModal, downloadScreenshot });
</script>
<template>
  <figure class="mermaid-figure" @click.stop :aria-busy="loading">
    <div v-if="loading" class="mermaid-message" role="status">Renderizando diagrama…</div>
    <div v-else-if="error" class="mermaid-error" role="alert">
      <strong>No se pudo dibujar este diagrama</strong><pre>{{ error }}</pre>
      <details><summary>Ver código Mermaid</summary><pre>{{ code }}</pre></details>
    </div>
    <template v-else-if="svg">
      <div class="mermaid-canvas" role="img" aria-label="Diagrama Mermaid" v-html="svg"></div>
      <figcaption class="mermaid-actions"><button type="button" @click="openModal">Ampliar</button><button type="button" @click="downloadScreenshot">Descargar SVG</button></figcaption>
    </template>
    <p v-else class="mermaid-message">El bloque Mermaid está vacío.</p>
    <Teleport to="body"><dialog ref="dialog" class="mermaid-dialog" @click="($event.target === dialog) && dialog?.close()">
      <button type="button" class="mermaid-close" @click="dialog?.close()">Cerrar</button>
      <div class="mermaid-canvas" role="img" aria-label="Diagrama ampliado" v-html="svg"></div>
    </dialog></Teleport>
  </figure>
</template>
<style scoped>
.mermaid-figure{margin:16px 0;border:1px solid var(--border,#334155);border-radius:10px;overflow:hidden;min-width:0}.mermaid-canvas{background:#fff;color:#172033;padding:20px;overflow:auto;text-align:center}.mermaid-canvas :deep(svg){display:block;max-width:100%;height:auto;margin:auto}.mermaid-actions{display:flex;justify-content:flex-end;gap:12px;padding:8px 12px;background:var(--surface,#1e293b)}.mermaid-actions button,.mermaid-close{font:inherit;font-size:12px;padding:5px 10px;border:1px solid var(--border,#64748b);border-radius:5px;color:var(--fg,#e2e8f0);background:var(--surface,#1e293b);cursor:pointer}.mermaid-message,.mermaid-error{padding:16px;color:var(--muted,#94a3b8)}.mermaid-error strong{color:var(--danger,#ef4444)}.mermaid-error pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.mermaid-dialog{position:fixed;inset:0;margin:auto;width:90vw;max-width:1400px;max-height:90vh;padding:16px;background:var(--surface,#1e293b);border:1px solid var(--border,#334155);border-radius:12px;overflow:auto}.mermaid-dialog::backdrop{background:#000a}.mermaid-close{display:block;margin:0 0 12px auto}.mermaid-dialog .mermaid-canvas :deep(svg){max-width:none;min-width:50%}
</style>
