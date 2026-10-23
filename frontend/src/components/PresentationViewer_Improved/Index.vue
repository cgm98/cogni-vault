<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 bg-slate-950 p-8 flex flex-col justify-between">
    <div class="flex justify-end">
      <button @click="$emit('close')" class="text-slate-400 hover:text-white text-lg">&times; Cerrar</button>
    </div>
    <div class="max-w-4xl mx-auto flex-1 flex items-center justify-center">
      <div class="prose prose-invert lg:prose-xl" v-html="content"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isOpen?: boolean;
  content?: string;
}>();

defineEmits<{
  (e: 'close'): void;
}>();
</script>
