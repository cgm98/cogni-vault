<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import DOMPurify from 'dompurify';
import { renderMarkdown } from '../../lib/markdown';
import { parseMarkdownTable, serializeMarkdownTable, pasteTableCells, type Alignment } from './markdownTable';
const props = defineProps<{ source: string }>();
const emit = defineEmits<{ (e: 'change', source: string): void; (e: 'undo'): void; (e: 'redo'): void }>();
const table = ref(parseMarkdownTable(props.source));
const active = ref({ row: 0, column: 0 });
const editing = ref(false);
const root = ref<HTMLElement>();
watch(() => props.source, source => {
  if (source === serializeMarkdownTable(table.value)) return;
  table.value = parseMarkdownTable(source);
  active.value.row = Math.min(active.value.row, table.value.rows.length - 1);
  active.value.column = Math.min(active.value.column, table.value.alignments.length - 1);
});
const preview = (value: string) => DOMPurify.sanitize(renderMarkdown(value));
function commit() { emit('change', serializeMarkdownTable(table.value)); }
async function select(row: number, column: number) {
  active.value = { row, column }; editing.value = true;
  await nextTick(); root.value?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
}
function addRow() {
  const index = active.value.row + 1;
  table.value.rows.splice(index, 0, table.value.alignments.map(() => ''));
  commit(); void select(index, active.value.column);
}
function addColumn() {
  const index = active.value.column + 1;
  table.value.alignments.splice(index, 0, null);
  table.value.rows.forEach(row => row.splice(index, 0, ''));
  commit(); void select(active.value.row, index);
}
function removeRow() {
  if (!active.value.row) return;
  table.value.rows.splice(active.value.row, 1);
  active.value.row = Math.min(active.value.row, table.value.rows.length - 1); commit();
}
function removeColumn() {
  if (table.value.alignments.length === 1) return;
  table.value.alignments.splice(active.value.column, 1);
  table.value.rows.forEach(row => row.splice(active.value.column, 1));
  active.value.column = Math.min(active.value.column, table.value.alignments.length - 1); commit();
}
function align(event: Event) { table.value.alignments[active.value.column] = (event.target as HTMLSelectElement).value as Alignment; commit(); }
function key(event: KeyboardEvent, row: number, column: number) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault(); event.stopPropagation(); event.shiftKey ? emit('redo') : emit('undo'); return;
  }
  if (event.key === 'Escape') { event.preventDefault(); editing.value = false; return; }
  if (event.key !== 'Tab' && event.key !== 'Enter') return;
  event.preventDefault(); event.stopPropagation();
  const width = table.value.alignments.length;
  let index = row * width + column + (event.key === 'Enter' ? width : event.shiftKey ? -1 : 1);
  index = Math.max(0, index);
  if (index >= table.value.rows.length * width) { table.value.rows.push(table.value.alignments.map(() => '')); commit(); }
  void select(Math.floor(index / width), index % width);
}
function paste(event: ClipboardEvent, row: number, column: number) {
  const text = event.clipboardData?.getData('text/plain') || '';
  if (!/[\t\n]/.test(text)) return;
  event.preventDefault(); table.value = pasteTableCells(table.value, row, column, text); commit();
}
</script>
<template>
  <div ref="root" class="editable-table">
    <div class="table-controls" role="toolbar" aria-label="Editar tabla">
      <button type="button" @click="addRow">+ Fila</button>
      <button type="button" @click="addColumn">+ Columna</button>
      <button type="button" :disabled="active.row === 0" @click="removeRow">Quitar fila</button>
      <button type="button" :disabled="table.alignments.length === 1" @click="removeColumn">Quitar columna</button>
      <select aria-label="Alineación de columna" :value="table.alignments[active.column] || 'left'" @change="align">
        <option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option>
      </select>
    </div>
    <div class="table-scroll"><table aria-label="Tabla editable"><tbody>
      <tr v-for="(row, r) in table.rows" :key="r">
        <component :is="r === 0 ? 'th' : 'td'" v-for="(cell, c) in row" :key="c" :style="{textAlign: table.alignments[c] || 'left'}">
          <textarea v-if="editing && active.row === r && active.column === c" v-model="row[c]" rows="1"
            :aria-label="`Fila ${r + 1}, columna ${c + 1}`" @input="commit" @keydown="key($event,r,c)" @paste="paste($event,r,c)" @blur="active.row === r && active.column === c && (editing = false)" />
          <button v-else type="button" class="table-cell" :aria-label="`Editar fila ${r + 1}, columna ${c + 1}: ${cell || 'Vacía'}`" @click="select(r,c)">
            <span v-if="cell" class="markdown-reading" v-html="preview(cell)"></span><span v-else class="empty-cell">Escribir…</span>
          </button>
        </component>
      </tr>
    </tbody></table></div>
    <div class="table-hint">Clic para editar · Tab: siguiente celda · Enter: siguiente fila · Pega celdas desde una hoja de cálculo</div>
  </div>
</template>
<style scoped>
.editable-table{margin:12px 0 20px;min-width:0;white-space:normal;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--bg)}
.table-controls{display:flex;flex-wrap:wrap;gap:4px;padding:6px;background:var(--surface);border-bottom:1px solid var(--border)}
.table-controls button,.table-controls select{font-size:11px;padding:4px 7px;color:var(--muted);border-radius:4px;background:transparent}.table-controls button:hover{background:var(--border);color:var(--fg)}.table-controls button:disabled{opacity:.35}.table-scroll{overflow:auto}table{width:100%;border-collapse:collapse}th,td{min-width:140px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);padding:0;vertical-align:top}th{background:var(--surface);font-weight:600}.table-cell{display:block;width:100%;min-height:42px;padding:9px 12px;text-align:inherit;cursor:text}.table-cell:hover{background:color-mix(in srgb,var(--primary) 8%,transparent)}.table-cell :deep(p){margin:0;font-size:14px}.table-cell :deep(.katex){font-size:1.05em}.empty-cell{color:var(--muted);font-size:12px;opacity:.6}textarea{display:block;width:100%;min-height:42px;resize:none;field-sizing:content;padding:9px 12px;background:var(--bg);color:var(--fg);font:14px/1.6 var(--font-sans);outline:2px solid var(--primary);outline-offset:-2px}.table-hint{padding:7px 10px;color:var(--muted);font-size:10px}
</style>
