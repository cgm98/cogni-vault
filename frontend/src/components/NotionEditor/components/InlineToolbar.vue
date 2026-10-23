<template>
  <div v-if="visible" class="inline-toolbar" :style="{ top: y + 'px', left: x + 'px' }">
    <button @click.prevent="format('bold')"><b>B</b></button>
    <button @click.prevent="format('italic')"><i>I</i></button>
    <button @click.prevent="format('strikeThrough')"><s>S</s></button>
    <button @click.prevent="format('underline')"><u>U</u></button>
    <span class="it-divider"></span>
    <button
      v-for="c in palette"
      :key="c"
      class="it-swatch"
      :style="{ background: c }"
      title="Resaltar"
      @mousedown.prevent
      @click.prevent="highlight(c)"
    ></button>
    <label class="it-swatch it-custom" title="Color personalizado" @mousedown="rememberRange">
      <span class="it-custom-preview" :style="{ background: customColor }"></span>
      <input type="color" v-model="customColor" @change="applyCustom" />
    </label>
    <button class="it-clear" title="Quitar resaltado" @mousedown.prevent @click.prevent="highlight('transparent')">✕</button>
    <span class="it-divider"></span>
    <span class="it-label" title="Color de texto">A</span>
    <button
      v-for="c in palette"
      :key="'fg-' + c"
      class="it-swatch"
      :style="{ background: c }"
      title="Color de texto"
      @mousedown.prevent
      @click.prevent="foreColor(c)"
    ></button>
    <label class="it-swatch it-custom" title="Color de texto personalizado" @mousedown="rememberRange">
      <span class="it-custom-preview" :style="{ background: customFgColor }"></span>
      <input type="color" v-model="customFgColor" @change="applyCustomFg" />
    </label>
    <button class="it-clear" title="Quitar color de texto" @mousedown.prevent @click.prevent="foreColor('inherit')">✕</button>
  </div>
</template>

<script setup lang="ts">
import './InlineToolbar.css'
import { ref, onMounted, onUnmounted } from 'vue';

const visible = ref(false);
const x = ref(0);
const y = ref(0);

// Semitransparentes para que el texto siga legible en tema claro y oscuro
const palette = [
  'rgba(250, 204, 21, 0.4)',
  'rgba(74, 222, 128, 0.4)',
  'rgba(96, 165, 250, 0.4)',
  'rgba(244, 114, 182, 0.4)',
  'rgba(248, 113, 113, 0.4)',
  'rgba(192, 132, 252, 0.4)',
];

const customColor = ref(localStorage.getItem('note_hl_color') || '#facc15');
const customFgColor = ref(localStorage.getItem('note_fg_color') || '#facc15');
let savedRange: Range | null = null;

const checkSelection = () => {
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    x.value = rect.left + rect.width / 2 - 130;
    y.value = rect.top - 40;
    visible.value = true;
  } else {
    visible.value = false;
  }
};

const format = (cmd: string) => {
  document.execCommand(cmd, false, '');
  checkSelection();
};

const highlight = (color: string) => {
  document.execCommand('styleWithCSS', false, 'true');
  document.execCommand('hiliteColor', false, color);
  checkSelection();
};

const foreColor = (color: string) => {
  document.execCommand('styleWithCSS', false, 'true');
  document.execCommand('foreColor', false, color);
  checkSelection();
};

// El color picker nativo roba el foco: guardar la selección antes y restaurarla al aplicar
const rememberRange = () => {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange();
};

const applyCustom = () => {
  localStorage.setItem('note_hl_color', customColor.value);
  if (savedRange) {
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(savedRange);
  }
  highlight(customColor.value);
};

const applyCustomFg = () => {
  localStorage.setItem('note_fg_color', customFgColor.value);
  if (savedRange) {
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(savedRange);
  }
  foreColor(customFgColor.value);
};

onMounted(() => document.addEventListener('selectionchange', checkSelection));
onUnmounted(() => document.removeEventListener('selectionchange', checkSelection));
</script>
