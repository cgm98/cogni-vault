<template>
  <div class="notion-code-block" contenteditable="false" :class="{ 'is-editing': isEditing, 'is-wrapped': wordWrap }">
    <div class="code-header">
      <div class="header-left-group">
        <div class="lang-selector-wrapper" ref="dropdownRef">
          <input 
            ref="searchInputRef"
            type="text" 
            :value="searchQuery || getLanguageLabel(block.language)" 
            @input="onSearchInput"
            @focus="showDropdown = true" 
            @keydown="onSearchKeydown"
            placeholder="Buscar lenguaje..." 
            class="lang-search-input"
          />
          <ul v-show="showDropdown" class="lang-dropdown-list">
            <li 
              v-for="lang in filteredLanguages" 
              :key="lang.value" 
              @click="selectLanguage(lang.value)"
              class="lang-dropdown-item"
              :class="{ active: block.language === lang.value }"
            >
              {{ lang.label }}
            </li>
          </ul>
        </div>
        <div class="mode-buttons">
          <button 
            @click.stop="isEditing = false" 
            class="header-action-btn" 
            :class="{ active: !isEditing }"
            title="Ver vista previa"
          >
            <Eye class="btn-icon" />
            <span>Ver</span>
          </button>
          <button 
            @click.stop="enableEdit" 
            class="header-action-btn" 
            :class="{ active: isEditing }"
            title="Editar código"
          >
            <Edit class="btn-icon" />
            <span>Editar</span>
          </button>
        </div>
      </div>
      <div class="header-right-group">
        <span class="code-meta">{{ lineCount }} {{ lineCount === 1 ? 'línea' : 'líneas' }}</span>
        <button
          @click="wordWrap = !wordWrap"
          class="header-action-btn"
          :class="{ active: wordWrap }"
          :title="wordWrap ? 'Desactivar ajuste de línea' : 'Activar ajuste de línea'"
        >
          <WrapText class="btn-icon" />
          <span>Ajustar</span>
        </button>
        <button
          @click="handleExpand"
          class="header-action-btn"
          :title="((block.language === 'mermaid' || block.language === 'abc') && !isEditing) ? 'Expandir diagrama' : 'Expandir código'"
        >
          <Maximize2 class="btn-icon" />
          <span>Expandir</span>
        </button>
        <button 
          v-if="isEditing || (block.language !== 'mermaid' && block.language !== 'abc')"
          @click="formatCode" 
          class="header-action-btn"
          title="Dar formato al código"
        >
          <Sparkles class="btn-icon" />
          <span>Formatear</span>
        </button>
        <button 
          @click="captureContent" 
          class="header-action-btn"
          title="Tomar captura"
        >
          <Camera class="btn-icon" />
          <span>Capturar</span>
        </button>
        <button 
          @click="exportAsMarkdown" 
          class="header-action-btn"
          title="Exportar como .md"
        >
          <Download class="btn-icon" />
          <span>Exportar .md</span>
        </button>
        <button 
          @click="copyCode" 
          class="header-action-btn"
          :title="copied ? '¡Copiado!' : 'Copiar código'"
        >
          <Check class="btn-icon" v-if="copied" />
          <Copy class="btn-icon" v-else />
          <span>{{ copied ? 'Copiado!' : 'Copiar' }}</span>
        </button>
      </div>
    </div>
    <div v-if="!isEditing && block.language === 'mermaid'" class="renderable-preview" @click="enableEdit">
      <MermaidRenderer ref="mermaidRef" :code="block.content || ''" />
    </div>
    <div v-else-if="!isEditing && block.language === 'abc'" class="renderable-preview" @click="enableEdit">
      <AbcRenderer ref="abcRef" :code="block.content || ''" />
    </div>
    <div v-show="isEditing || (block.language !== 'mermaid' && block.language !== 'abc')" class="code-container" @click="enableEdit">
      <div v-if="!wordWrap" class="code-gutter" aria-hidden="true">
        <span v-for="n in lineCount" :key="n">{{ n }}</span>
      </div>
      <div class="code-stack">
        <pre class="code-highlight"><code v-html="highlightedCode"></code></pre>
        <pre class="code-editable-wrapper"><code
          ref="codeRef"
          :id="`block-${block.id}`"
          class="code-editor"
          :contenteditable="isEditing"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          @keydown="onKeydown"
          @input="onInput"
          @focus="store.setActiveBlock(block.id)"
          @paste="onPaste"
          placeholder="Escribe código aquí..."
        ></code></pre>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="isExpanded" class="code-modal-overlay" @click="isExpanded = false">
        <div class="code-modal-container" @click.stop>
          <div class="code-modal-header">
            <h3>Visualizar Código ({{ getLanguageLabel(block.language) }})</h3>
            <div class="code-modal-actions">
              <button class="code-modal-btn" @click="copyCode" :title="copied ? '¡Copiado!' : 'Copiar código'">
                <Check class="btn-icon" v-if="copied" style="width: 14px; height: 14px;" />
                <Copy class="btn-icon" v-else style="width: 14px; height: 14px;" />
                <span>{{ copied ? 'Copiado!' : 'Copiar' }}</span>
              </button>
              <button class="code-modal-close-btn" @click="isExpanded = false" title="Cerrar (Esc)">
                <X class="btn-icon" style="width: 14px; height: 14px;" />
              </button>
            </div>
          </div>
          <div class="code-modal-body">
            <pre class="code-modal-pre"><code v-html="highlightedCode"></code></pre>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import './CodeBlock.css'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useDocumentStore } from '../stores/useDocumentStore';
import { useBlockKeyboard } from '../composables/useBlockKeyboard';
import { useCodeExport } from '../composables/useCodeExport';
import { useLanguagePicker } from '../composables/useLanguagePicker';
import { Block } from '../../../Utils/markdownBlocks';
import hljs from 'highlight.js';
import MermaidRenderer from '../../MermaidRenderer/Index.vue';
import AbcRenderer from '../../AbcRenderer/Index.vue';
import { Maximize2, Camera, Download, Copy, Check, Eye, Edit, X, Sparkles, WrapText } from 'lucide-vue-next';

const props = defineProps<{ block: Block }>();
const store = useDocumentStore();
const { handleKeydown } = useBlockKeyboard();

const codeRef = ref<HTMLElement | null>(null);
const copied = ref(false);
const isEditing = ref(false);
const isExpanded = ref(false);
const wordWrap = ref(false);

const lineCount = computed(() => (props.block.content || '').split('\n').length);

watch(isEditing, () => {
  isExpanded.value = false;
});

const handleEsc = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    isExpanded.value = false;
  }
};

watch(isExpanded, (val) => {
  if (val) {
    window.addEventListener('keydown', handleEsc);
  } else {
    window.removeEventListener('keydown', handleEsc);
  }
});

const mermaidRef = ref<any>(null);
const abcRef = ref<any>(null);

const expandDiagram = () => {
  if (props.block.language === 'mermaid') {
    mermaidRef.value?.openModal();
  } else if (props.block.language === 'abc') {
    abcRef.value?.openModal();
  }
};

const handleExpand = () => {
  if ((props.block.language === 'mermaid' || props.block.language === 'abc') && !isEditing.value) {
    expandDiagram();
  } else {
    isExpanded.value = true;
  }
};

const highlightedCode = computed(() => {
  const code = props.block.content || '';
  const lang = props.block.language || 'plaintext';

  if (!code) {
    return `<span class="code-placeholder">Escribe código aquí...</span>`;
  }

  try {
    let targetLang = lang;
    if (targetLang === 'mermaid' || targetLang === 'abc') targetLang = 'plaintext';
    if (targetLang === 'react' || targetLang === 'react-native') targetLang = 'javascript';
    if (targetLang === 'vue' || targetLang === 'htmx') targetLang = 'xml';
    if (targetLang === 'laravel') targetLang = 'php';
    if (targetLang === 'postgres') targetLang = 'pgsql';

    if (targetLang && targetLang !== 'plaintext') {
      return hljs.highlight(code, { language: targetLang }).value;
    }
    return hljs.highlightAuto(code).value;
  } catch (e) {
    console.warn("Error highlighting code in blocks", e);
    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
});

const { formatCode, exportAsMarkdown, captureCodeAsImage } = useCodeExport(
  props,
  codeRef,
  highlightedCode,
  (id, patch) => store.updateBlock(id, patch)
);

const {
  searchQuery,
  showDropdown,
  dropdownRef,
  searchInputRef,
  filteredLanguages,
  getLanguageLabel,
  onSearchInput,
  selectLanguage,
  onSearchKeydown
} = useLanguagePicker((lang) => store.updateBlock(props.block.id, { language: lang }));

const captureContent = () => {
  if (props.block.language === 'mermaid' && !isEditing.value) {
    mermaidRef.value?.downloadScreenshot();
  } else if (props.block.language === 'abc' && !isEditing.value) {
    abcRef.value?.downloadScreenshot();
  } else {
    captureCodeAsImage(props.block.content || '');
  }
};

const copyCode = () => {
  navigator.clipboard.writeText(props.block.content || '');
  copied.value = true;
  setTimeout(() => copied.value = false, 2000);
};

const enableEdit = () => {
  isEditing.value = true;
  setTimeout(() => {
    if (codeRef.value) {
      codeRef.value.focus();
    }
  }, 50);
};

const onInput = (e: Event) => {
  const target = e.target as HTMLElement;
  store.updateBlock(props.block.id, { content: target.innerText });
};

const onPaste = (e: ClipboardEvent) => {
  e.preventDefault();
  const text = e.clipboardData?.getData('text/plain') || '';
  document.execCommand('insertText', false, text);
};

// Sangría de la línea donde está el cursor; suma un nivel si la línea abre bloque
const getCurrentLineIndent = (): string => {
  const el = codeRef.value;
  const sel = window.getSelection();
  if (!el || !sel || sel.rangeCount === 0) return '';
  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(true);
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  const tmp = document.createElement('div');
  tmp.appendChild(pre.cloneContents());
  tmp.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  const before = tmp.textContent || '';
  const line = before.slice(before.lastIndexOf('\n') + 1);
  let indent = line.match(/^[ \t]*/)?.[0] || '';
  if (/[{[(]\s*$|:\s*$/.test(line)) indent += '  ';
  return indent;
};

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    if (!e.shiftKey) document.execCommand('insertText', false, '  ');
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      isEditing.value = false;
      const newId = store.addBlock(props.block.id, 'paragraph');
      setTimeout(() => document.getElementById(`block-${newId}`)?.focus(), 0);
      return;
    }
    const indent = getCurrentLineIndent();
    document.execCommand('insertLineBreak');
    if (indent) document.execCommand('insertText', false, indent);
    return;
  }
  if (e.key === 'Escape') {
    isEditing.value = false;
    codeRef.value?.blur();
    return;
  }
  handleKeydown(e, props.block);
};

onMounted(() => {
  if (codeRef.value) {
    codeRef.value.innerText = props.block.content || '';
  }
  if (!props.block.content) {
    isEditing.value = true;
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleEsc);
});

watch(() => props.block.content, (newContent) => {
  if (codeRef.value && document.activeElement !== codeRef.value) {
    if (codeRef.value.innerText !== newContent) {
      codeRef.value.innerText = newContent || '';
    }
  }
});
</script>