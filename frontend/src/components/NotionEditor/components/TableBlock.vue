<template>
  <div class="notion-table-block" contenteditable="false">
    <div class="table-toolbar">
      <button 
        @click="removeColumn" 
        class="toolbar-icon-btn" 
        :disabled="cols <= 1"
        title="Eliminar Columna"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M12 3v18" />
          <path d="m15 10-6 4" />
          <path d="m9 10 6 4" />
        </svg>
      </button>

      <button 
        @click="removeRow" 
        class="toolbar-icon-btn" 
        :disabled="rows <= 1"
        title="Eliminar Fila"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M3 12h18" />
          <path d="m10 15 4-6" />
          <path d="m10 9 4 6" />
        </svg>
      </button>
    </div>

    <div class="table-container-rel">
      <div class="table-wrapper">
        <table class="notion-table">
          <tbody>
            <tr 
              v-for="(row, rIdx) in tableData" 
              :key="rIdx"
              :class="{ 'header-row-bg': headerRow && rIdx === 0 }"
            >
              <td 
                v-for="(cell, cIdx) in row" 
                :key="cIdx"
                :class="{ 
                  'header-col-bg': headerCol && cIdx === 0,
                  'header-cell-font': (headerRow && rIdx === 0) || (headerCol && cIdx === 0)
                }"
              >
                <div
                  class="table-cell"
                  contenteditable="true"
                  @input="updateCell($event, rIdx, cIdx)"
                  @keydown="handleCellKeydown($event, rIdx, cIdx)"
                  @paste="onCellPaste"
                  v-html="sanitizeCell(cell)"
                ></div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <button 
        class="add-col-trigger" 
        @click="addColumn" 
        title="Añadir Columna"
      >
        <span class="plus-icon">+</span>
      </button>

      <button 
        class="add-row-trigger" 
        @click="addRow" 
        title="Añadir Fila"
      >
        <span class="plus-icon">+</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import './TableBlock.css'
import { computed, onMounted } from 'vue';
import DOMPurify from 'dompurify';
import { useDocumentStore } from '../stores/useDocumentStore';
import { Block } from '../../../Utils/markdownBlocks';

const props = defineProps<{ block: Block }>();
const store = useDocumentStore();

// Defensa en profundidad: cierra el vector de entrada (paste, ver onCellPaste)
// y también el de salida, por si tableData llega con HTML crudo desde otro
// origen (import futuro, edición directa de datos, etc.) — igual que useMarkdown.ts.
const sanitizeCell = (cell: string) => DOMPurify.sanitize(cell || '');

const tableData = computed((): string[][] => props.block.tableData || [['', ''], ['', '']]);
const rows = computed(() => tableData.value.length);
const cols = computed(() => tableData.value[0]?.length || 0);

const headerRow = computed(() => !!props.block.headerRow);
const headerCol = computed(() => !!props.block.headerCol);

onMounted(() => {
  if (!props.block.tableData) {
    store.updateBlock(props.block.id, {
      tableData: [
        ['', ''],
        ['', '']
      ],
      headerRow: true,
      headerCol: false
    });
  }
});

// Igual que BlockRenderer.onPaste: solo texto plano. Sin esto, pegar HTML
// (p.ej. copiado de una web maliciosa) queda persistido en tableData y se
// re-ejecuta cada vez que la nota se abre, porque la celda se pinta con v-html.
const onCellPaste = (e: ClipboardEvent) => {
  e.preventDefault();
  const text = e.clipboardData?.getData('text/plain') || '';
  document.execCommand('insertText', false, text);
};

const updateCell = (e: Event, rIdx: number, cIdx: number) => {
  const target = e.target as HTMLElement;
  const data = JSON.parse(JSON.stringify(tableData.value));
  data[rIdx][cIdx] = target.innerHTML;
  store.updateBlock(props.block.id, { tableData: data });
};

const addRow = () => {
  const data = JSON.parse(JSON.stringify(tableData.value));
  data.push(Array(cols.value).fill(''));
  store.updateBlock(props.block.id, { tableData: data });
};

const removeRow = () => {
  if (rows.value > 1) {
    const data = JSON.parse(JSON.stringify(tableData.value));
    data.pop();
    store.updateBlock(props.block.id, { tableData: data });
  }
};

const addColumn = () => {
  const data = JSON.parse(JSON.stringify(tableData.value));
  data.forEach((row: string[]) => row.push(''));
  store.updateBlock(props.block.id, { tableData: data });
};

const removeColumn = () => {
  if (cols.value > 1) {
    const data = JSON.parse(JSON.stringify(tableData.value));
    data.forEach((row: string[]) => row.pop());
    store.updateBlock(props.block.id, { tableData: data });
  }
};

const handleCellKeydown = (e: KeyboardEvent, rIdx: number, cIdx: number) => {
  if (e.key !== 'Tab') return;
  e.preventDefault();

  if (e.shiftKey) {
    if (rIdx === 0 && cIdx === 0) return;
    const prevC = cIdx === 0 ? cols.value - 1 : cIdx - 1;
    const prevR = cIdx === 0 ? rIdx - 1 : rIdx;
    focusCell(prevR, prevC);
    return;
  }

  const isLastCell = rIdx === rows.value - 1 && cIdx === cols.value - 1;
  if (isLastCell) {
    addRow();
    setTimeout(() => {
      focusCell(rIdx + 1, 0);
    }, 50);
  } else {
    const nextC = (cIdx + 1) % cols.value;
    const nextR = nextC === 0 ? rIdx + 1 : rIdx;
    focusCell(nextR, nextC);
  }
};

const focusCell = (r: number, c: number) => {
  const tableEl = document.getElementById(`block-${props.block.id}`) || document.querySelector('.notion-table');
  const cells = tableEl?.querySelectorAll('.table-cell');
  if (cells) {
    const index = r * cols.value + c;
    const cellEl = cells[index] as HTMLElement | undefined;
    cellEl?.focus();
  }
};
</script>
