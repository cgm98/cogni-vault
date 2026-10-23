<script setup lang="ts">
import { ref, shallowRef, watch, nextTick, onBeforeUnmount } from 'vue';
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
    <p v-if="!content.trim()" class="markdown-placeholder">Esta nota está vacía. Pulsa Editar para escribir.</p>
    <div ref="root" v-html="html"></div>
    <Teleport v-for="diagram in diagrams" :key="diagram.index" :to="diagram.target"><MermaidRenderer :code="diagram.code" /></Teleport>
  </article>
</template>
<style>
.markdown-reading{font-size:15px;line-height:1.75;overflow-wrap:anywhere;color:var(--fg);min-width:0}.markdown-reading h1,.markdown-reading h2,.markdown-reading h3,.markdown-reading h4{font-weight:650;line-height:1.3;margin:1.4em 0 .65em}.markdown-reading h1{font-size:2em}.markdown-reading h2{font-size:1.55em;border-bottom:1px solid var(--border);padding-bottom:.3em}.markdown-reading h3{font-size:1.25em}.markdown-reading p{margin:.8em 0}.markdown-reading ul{list-style:disc}.markdown-reading ol{list-style:decimal}.markdown-reading ul,.markdown-reading ol{padding-left:1.7em;margin:.7em 0}.markdown-reading li>p{margin:.2em 0}.markdown-reading blockquote{border-left:3px solid var(--accent,#60a5fa);padding:0 1em;margin:1em 0;color:var(--muted)}.markdown-reading pre{overflow:auto;max-width:100%;padding:16px;background:#0d1117;color:#e6edf3;border-radius:8px;font-size:13px;line-height:1.6;white-space:pre}.markdown-reading code{font-family:monospace}.markdown-reading :not(pre)>code{padding:2px 5px;background:var(--surface);border-radius:4px;font-size:.9em}.markdown-reading table{display:block;max-width:100%;overflow:auto;border-collapse:collapse;margin:1em 0}.markdown-reading th,.markdown-reading td{padding:8px 12px;border:1px solid var(--border);text-align:left}.markdown-reading th{font-weight:600;background:var(--surface)}.markdown-reading img{max-width:100%;height:auto}.markdown-reading a{color:var(--accent,#60a5fa);text-decoration:underline}.markdown-reading hr{border:0;border-top:1px solid var(--border);margin:2em 0}.markdown-reading .katex-display{overflow-x:auto;overflow-y:hidden;padding:8px 0}.markdown-placeholder{color:var(--muted)}
</style>
