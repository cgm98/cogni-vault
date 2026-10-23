<template>
  <div class="my-4 p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl">
    <div class="text-xs font-mono text-slate-400 whitespace-pre">{{ code }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  code?: string;
}>();
</script>
