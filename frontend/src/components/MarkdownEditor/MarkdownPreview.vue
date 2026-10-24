<script setup lang="ts">
import { ref, shallowRef, watch, nextTick, onBeforeUnmount } from 'vue';
import './document.css';
import DOMPurify from 'dompurify';
import { renderMarkdownDocument } from '../../lib/markdown';
import MermaidRenderer from '../MermaidRenderer/Index.vue';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';
const props = defineProps<{ content: string }>();
const emit = defineEmits<{ (e: 'wikiLinkClick', target: string): void }>();
const root = ref<HTMLElement>();
const html = ref('');
const diagrams = shallowRef<Array<{ index: number; code: string; target: Element }>>([]);
let revision = 0;
watch(() => props.content, async content => {
  const current = ++revision;
  diagrams.value = [];
  const result = renderMarkdownDocument(content);
  html.value = DOMPurify.sanitize(result.html);
  await nextTick();
  if (current !== revision || !root.value) return;
  diagrams.value = result.diagrams.flatMap(diagram => {
    const target = root.value!.querySelector('[data-mermaid-index="' + diagram.index + '"]');
    return target ? [{ ...diagram, target }] : [];
  });
}, { immediate: true, flush: 'post' });
onBeforeUnmount(() => { ++revision; });
function handleClick(event: MouseEvent) {
  const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[data-note-link]');
  if (anchor) { event.preventDefault(); emit('wikiLinkClick', anchor.dataset.noteLink || ''); }
}
</script>
<template>
  <article class="markdown-reading" @click="handleClick">
    <p v-if="!content.trim()" class="markdown-placeholder">Esta nota está vacía. Pulsa Editar para empezar a escribir.</p>
    <div ref="root" v-html="html"></div>
    <Teleport v-for="diagram in diagrams" :key="diagram.index" :to="diagram.target"><MermaidRenderer :code="diagram.code" /></Teleport>
  </article>
</template>
