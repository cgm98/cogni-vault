<template>
  <div class="notion-math-block" contenteditable="false" :class="{ 'is-editing': isEditing }">
    <div class="code-header">
      <div class="header-left-group">
        <span class="code-meta">Ecuación LaTeX</span>
        <div class="mode-buttons">
          <button @click.stop="saveMath" class="header-action-btn" :class="{ active: !isEditing }" title="Ver fórmula renderizada">
            <Eye class="btn-icon" />
            <span>Ver</span>
          </button>
          <button @click.stop="editMath" class="header-action-btn" :class="{ active: isEditing }" title="Editar LaTeX">
            <Edit class="btn-icon" />
            <span>Editar</span>
          </button>
        </div>
      </div>
      <div class="header-right-group">
        <button @click="copyLatex" class="header-action-btn" :title="copied ? '¡Copiado!' : 'Copiar LaTeX'">
          <Check class="btn-icon" v-if="copied" />
          <Copy class="btn-icon" v-else />
          <span>{{ copied ? 'Copiado!' : 'Copiar' }}</span>
        </button>
      </div>
    </div>

    <div class="math-body">
      <div v-show="isEditing" class="math-editor-container">
        <textarea
          ref="textareaRef"
          v-model="latexInput"
          class="math-textarea"
          placeholder="Escribe fórmula en LaTeX (ej. e^{i\pi} + 1 = 0)"
          @input="onInput"
          @keydown.enter.ctrl.prevent="saveMath"
          @keydown.esc.prevent="saveMath"
        ></textarea>
        <div class="math-tip">Ctrl + Enter o Esc para ver la fórmula</div>
      </div>

      <div v-show="!isEditing" class="math-preview-container" @click="editMath">
        <div v-if="mathError" class="render-error-banner">
          <span class="render-error-summary">{{ mathError.summary }}</span>
          <details class="render-error-details" @click.stop>
            <summary>Detalle técnico</summary>
            <pre>{{ mathError.raw }}</pre>
          </details>
        </div>
        <div v-if="renderedHtml" class="math-rendered" :class="{ 'render-stale': mathError }" v-html="renderedHtml"></div>
        <div v-else-if="!mathError" class="math-placeholder">Haz clic aquí o en "Editar LaTeX" para ingresar una ecuación matemática</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import './MathBlock.css'
import './CodeBlock.css'
import { ref, onMounted, nextTick, watch } from 'vue';
import { Eye, Edit, Copy, Check } from 'lucide-vue-next';
import { useDocumentStore } from '../stores/useDocumentStore';
import { Block, sanitizeLatex } from '../../../Utils/markdownBlocks';
// @ts-ignore
import katex from 'katex';

const props = defineProps<{ block: Block }>();
const store = useDocumentStore();

const isEditing = ref(false);
const latexInput = ref(props.block.content || '');
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const copied = ref(false);

// Si el LaTeX nuevo no compila, se conserva la última fórmula válida
// y se muestra un aviso: el bloque nunca "pierde" su render.
const renderedHtml = ref('');
const mathError = ref<{ summary: string; raw: string } | null>(null);

const renderLatex = (content: string | undefined) => {
  if (!content) {
    renderedHtml.value = '';
    mathError.value = null;
    return;
  }
  const cleanContent = sanitizeLatex(content);
  try {
    renderedHtml.value = katex.renderToString(cleanContent, {
      displayMode: true,
      throwOnError: true
    });
    mathError.value = null;
  } catch (err: any) {
    mathError.value = {
      summary: 'Hay un error de sintaxis en la fórmula LaTeX.',
      raw: err.message || String(err)
    };
  }
};

watch(() => props.block.content, renderLatex, { immediate: true });

const editMath = () => {
  isEditing.value = true;
  nextTick(() => {
    textareaRef.value?.focus();
  });
};

const onInput = () => {
  store.updateBlock(props.block.id, { content: latexInput.value });
};

const saveMath = () => {
  isEditing.value = false;
};

const copyLatex = () => {
  navigator.clipboard.writeText(props.block.content || '');
  copied.value = true;
  setTimeout(() => copied.value = false, 2000);
};

watch(() => props.block.content, (newContent) => {
  if (latexInput.value !== newContent) {
    latexInput.value = newContent || '';
  }
});

onMounted(() => {
  if (!props.block.content) {
    isEditing.value = true;
    nextTick(() => {
      textareaRef.value?.focus();
    });
  }
});
</script>