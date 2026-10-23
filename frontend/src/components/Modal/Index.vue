<template>
  <Teleport to="body">
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @keydown.esc="cancel">
    <div role="dialog" aria-modal="true" :aria-label="title" class="bg-slate-850 border border-slate-700/80 rounded-xl shadow-2xl max-w-lg w-full max-h-[90dvh] overflow-auto text-slate-100">
      <div v-if="title || $slots.header" class="flex items-center justify-between px-6 py-4 border-b border-slate-700/60 bg-slate-800/40">
        <slot name="header">
          <h3 class="font-semibold text-base tracking-wide">{{ title }}</h3>
        </slot>
        <button @click="cancel" class="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-700/50">
          <span class="sr-only">Cerrar</span>
          &times;
        </button>
      </div>
      <div class="p-6">
        <slot><p class="text-sm leading-6 text-slate-300">{{ message }}</p></slot>
      </div>
      <div v-if="$slots.footer || confirmLabel" class="px-6 py-3 border-t border-slate-700/60 bg-slate-800/30 flex justify-end gap-3">
        <slot name="footer">
          <button type="button" class="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm" @click="cancel">Cancelar</button>
          <button type="button" class="px-3 py-2 rounded-lg text-sm text-white" :class="destructive ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'" @click="$emit('confirm')">{{ confirmLabel }}</button>
        </slot>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  isOpen?: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
}>(), { isOpen: true });

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

function cancel() {
  emit('cancel');
  emit('close');
}
</script>
