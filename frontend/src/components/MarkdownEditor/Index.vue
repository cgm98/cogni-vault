<script setup lang="ts">
import './style.css'
import MarkdownPreview from './MarkdownPreview.vue';
import LiveEditor from './LiveEditor.vue';
import { printNote } from './printNote';
import { useConceptStore } from '../../stores/concept.store';
import { useDomainStore } from '../../stores/domain.store';
import { useAreaStore } from '../../stores/area.store';
import { useTopicStore } from '../../stores/topic.store';
import { useCerebroStore } from '../../stores/cerebro.store';
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import {
  X, BookOpen, Clock, FileEdit, Tv, Download, History, Save
} from 'lucide-vue-next';
import type { Concept } from '../../types/concept.types';
import type { FileItem, TabItem, SaveStatus } from '../../types';
import PresentationViewer_Improved from '../PresentationViewer_Improved/Index.vue';
import VersionHistory from '../VersionHistory/Index.vue';



import { noteFacets } from '../../lib/noteFacets';

const props = defineProps<{
  files: FileItem[];
  activeFileId: string | null;
  tabs: TabItem[];
  activeTabId: string | null;
  saveStates?: Record<string, SaveStatus>;
  saveErrors?: Record<string, string>;
  recentlySaved?: Record<string, boolean>;
  prepareHistory?: () => Promise<boolean>;
}>();

const conceptStore = useConceptStore();
const domainStore = useDomainStore();
const areaStore = useAreaStore();
const topicStore = useTopicStore();
const cerebroStore = useCerebroStore();

const emit = defineEmits<{
  (e: 'selectTab', tabId: string): void;
  (e: 'closeTab', tabId: string): void;
  (e: 'updateFileContent', fileId: string, content: string, isImmediate?: boolean): void;
  (e: 'wikiLinkClick', noteName: string): void;
  (e: 'tagClick', tag: string): void;
  (e: 'fileRestored', fileId: string): void;
  (e: 'updateMetadata', fileId: string, patch: Partial<Concept>): void;
}>();

const activeTab = computed(() => props.tabs.find((t) => t.id === props.activeTabId));
const activeFile = computed(() => props.files.find((f) => f.id === (activeTab.value ? activeTab.value.fileId : props.activeFileId)));

const activeFileConcept = computed(() => {
  if (!activeFile.value) return null;
  return conceptStore.concepts.find((c: any) => c.id === activeFile.value?.id) || null;
});

const currentDomainObj = computed(() => domainStore.domains.find(d => d.id === activeFileConcept.value?.domain || d.name === activeFileConcept.value?.domain));
const currentAreaObj = computed(() => areaStore.areas.find(a => a.id === currentDomainObj.value?.area_id));
const currentCerebroObj = computed(() => cerebroStore.cerebros.find(c => c.id === currentAreaObj.value?.cerebro_id));
const currentTopic = computed(() => topicStore.topics.find(t => t.id === activeFileConcept.value?.topic_id));
const availableTopics = computed(() => topicStore.topics.filter(t => t.domain_id === currentDomainObj.value?.id));
const breadcrumbs = computed(() => [currentCerebroObj.value?.name, currentAreaObj.value?.name, currentDomainObj.value?.name, currentTopic.value?.name].filter(Boolean));
const editorMode = ref<'read' | 'source' | 'live'>('live');
const exportError = ref('');
const exporting = ref(false);
const updateMetadata = (patch: Partial<Concept>) => {
  if (activeFile.value) emit('updateMetadata', activeFile.value.id, patch);
};
const changeDomain = (domain: string) => {
  const topic = topicStore.topics.find(t => t.id === activeFileConcept.value?.topic_id);
  updateMetadata({ domain, topic_id: topic?.domain_id === domain ? topic.id : null });
};
const saveNow = () => {
  if (activeFile.value) emit('updateFileContent', activeFile.value.id, activeFile.value.content || '', true);
};
const openHistory = async () => {
  if (!props.prepareHistory || await props.prepareHistory()) isHistoryOpen.value = true;
};


const isPresentationActive = ref(false);

// ── Historial de versiones ──
const isHistoryOpen = ref(false);

const onVersionRestored = (updated: any) => {
  isHistoryOpen.value = false;
  emit('fileRestored', updated.id);
};

// Listener propio (como CommandPalette): el estado del overlay vive aquí.
// Solo se monta una instancia de MarkdownEditor, no compite con nadie.
const onHistoryShortcut = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
    e.preventDefault();
    if (activeFile.value) { if (isHistoryOpen.value) isHistoryOpen.value = false; else void openHistory(); }
  }
};

onMounted(() => window.addEventListener('keydown', onHistoryShortcut));
onUnmounted(() => window.removeEventListener('keydown', onHistoryShortcut));

const startPresentation = () => {
  if (activeFile.value && activeFile.value.content.trim()) {
    isPresentationActive.value = true;
  }
};

const exportToPDF = async () => {
  if (!activeFile.value || exporting.value) return;
  exporting.value = true; exportError.value = '';
  try { await printNote(activeFile.value.name, activeFile.value.content || ''); }
  catch (error) { exportError.value = error instanceof Error ? error.message : 'No se pudo exportar'; }
  finally { exporting.value = false; }
};
watch(() => activeFile.value?.id, () => {
  isHistoryOpen.value = false;
  isPresentationActive.value = false;
  exportError.value = '';
  closeCtxMenu();
});

// Menú contextual de pestañas (estilo Chrome)
const ctxMenu = ref({ visible: false, x: 0, y: 0, tabId: '' });

const closeCtxMenu = () => {
  ctxMenu.value.visible = false;
  window.removeEventListener('mousedown', closeCtxMenu);
  window.removeEventListener('keydown', onCtxEscape);
};

const onCtxEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape') closeCtxMenu();
};

const openTabContextMenu = (e: MouseEvent, tabId: string) => {
  ctxMenu.value = { visible: true, x: e.clientX, y: e.clientY, tabId };
  setTimeout(() => {
    window.addEventListener('mousedown', closeCtxMenu);
    window.addEventListener('keydown', onCtxEscape);
  }, 0);
};

onUnmounted(closeCtxMenu);

const ctxIndex = computed(() => props.tabs.findIndex(t => t.id === ctxMenu.value.tabId));
const hasRight = computed(() => ctxIndex.value >= 0 && ctxIndex.value < props.tabs.length - 1);
const hasLeft = computed(() => ctxIndex.value > 0);
const hasOthers = computed(() => props.tabs.length > 1);

const closeTabs = (ids: string[]) => {
  ids.forEach(id => emit('closeTab', id));
  closeCtxMenu();
};

const ctxCloseThis = () => closeTabs([ctxMenu.value.tabId]);
const ctxCloseRight = () => closeTabs(props.tabs.slice(ctxIndex.value + 1).map(t => t.id));
const ctxCloseLeft = () => closeTabs(props.tabs.slice(0, ctxIndex.value).map(t => t.id));
const ctxCloseOthers = () => closeTabs(props.tabs.filter(t => t.id !== ctxMenu.value.tabId).map(t => t.id));
const ctxCloseAll = () => closeTabs(props.tabs.map(t => t.id));

const getWordCount = (text: string) => text.trim() ? text.trim().split(/\s+/).length : 0;
const getCharCount = (text: string) => text.length;
const getReadingMinutes = (text: string) => Math.max(1, Math.round(getWordCount(text) / 200));

// ── Indicador de estado de guardado por archivo ──
const saveIndicator = (fileId: string) => {
  const status = props.saveStates?.[fileId];
  if (status === 'dirty') return { cls: 'dirty', symbol: '●', title: 'Cambios sin guardar' };
  if (status === 'saving') return { cls: 'saving', symbol: '●', title: 'Guardando…' };
  if (status === 'error') return { cls: 'error', symbol: '⚠', title: `No se pudo guardar: ${props.saveErrors?.[fileId] || 'error de conexión'}` };
  if (status === 'saved' && props.recentlySaved?.[fileId]) return { cls: 'saved', symbol: '✓', title: 'Guardado' };
  return null;
};

const activeSaveStatus = computed(() => {
  const fileId = activeFile.value?.id;
  if (!fileId) return null;
  const status = props.saveStates?.[fileId];
  if (status === 'dirty') return { cls: 'dirty', text: 'Sin guardar' };
  if (status === 'saving') return { cls: 'saving', text: 'Guardando…' };
  if (status === 'error') return { cls: 'error', text: '⚠ No guardado' };
  if (status === 'saved') return { cls: 'saved', text: 'Guardado' };
  return null;
});
</script>

<template>
  <div v-if="props.tabs.length === 0" class="editor-empty">
    <BookOpen :size="48" class="mde-empty-icon" />
    <p class="mde-empty-title">Ninguna nota abierta.</p>
    <p class="mde-empty-subtitle">Crea una nota o selecciona una del explorador lateral para empezar.</p>
    <p class="mde-empty-hint"><kbd>Ctrl</kbd> + <kbd>P</kbd> abre la paleta de comandos</p>
  </div>

  <div v-else class="editor-container">
    <div class="tab-bar">
      <div class="tab-list">
        <div
          v-for="tab in props.tabs"
          :key="tab.id"
          @click="emit('selectTab', tab.id)"
          @mousedown.middle.prevent="emit('closeTab', tab.id)"
          @contextmenu.prevent="openTabContextMenu($event, tab.id)"
          class="tab-item"
          :class="{ 'tab-active': props.activeTabId === tab.id }"
        >
          <FileEdit :size="12" class="tab-icon" :class="{ 'icon-active': props.activeTabId === tab.id }" />
          <span class="tab-name">{{ props.files.find(f => f.id === tab.fileId)?.name || 'Archivo Eliminado' }}</span>
          <span v-if="saveIndicator(tab.fileId)" class="tab-save-indicator"
            :class="saveIndicator(tab.fileId)!.cls" :title="saveIndicator(tab.fileId)!.title">
            {{ saveIndicator(tab.fileId)!.symbol }}
          </span>
          <button @click.stop="emit('closeTab', tab.id)" class="tab-close" title="Cerrar pestaña">
            <X :size="11" />
          </button>
        </div>
      </div>

      <div v-if="activeTab" class="tab-actions">
        <div class="editor-mode-switch" aria-label="Modo de la nota">
          <button @click="editorMode = 'live'" :aria-pressed="editorMode === 'live'" title="Editar Markdown con formato en vivo">En vivo</button>
          <button @click="editorMode = 'source'" :aria-pressed="editorMode === 'source'" title="Mostrar todos los símbolos Markdown">Markdown</button>
          <button @click="editorMode = 'read'" :aria-pressed="editorMode === 'read'" title="Solo lectura">Leer</button>
        </div>
        <button @click="saveNow" title="Guardar nota (Ctrl+S)" class="action-btn" :disabled="!activeFile"><Save :size="14" /></button>
        <button @click="startPresentation" title="Modo Presentación (Diapositivas)" class="action-btn" :disabled="!activeFile?.content?.trim()">
          <Tv :size="13" />
        </button>

        <button @click="exportToPDF" title="Exportar Nota a PDF" class="action-btn" :disabled="!activeFile || exporting">
          <Download :size="13" />
        </button>

        <button @click="openHistory" title="Historial de versiones (Ctrl+H)" class="action-btn" :disabled="!activeFile">
          <History :size="13" />
        </button>
      </div>
    </div>

    <div v-if="activeFile" class="editor-content-wrapper">
      <div class="main-canvas">
        <div class="textarea-wrapper">
          <div v-if="activeFileConcept" class="editor-metadata-bar">
            <div class="editor-breadcrumbs" v-if="breadcrumbs.length">
              <span v-for="(name, index) in breadcrumbs" :key="index"><span v-if="index"> / </span>{{ name }}</span>
            </div>
            <label class="sr-only" for="note-title">Título de la nota</label>
            <input id="note-title" :value="activeFileConcept.title"
              @input="updateMetadata({ title: ($event.target as HTMLInputElement).value })"
              @keydown.enter.prevent="saveNow" placeholder="Título de la nota" class="metadata-title-input" />
            <div class="metadata-selectors">
              <label>Faceta
                <select :value="activeFileConcept.temporal_facet || ''" @change="updateMetadata({ temporal_facet: ($event.target as HTMLSelectElement).value as Concept['temporal_facet'] })" class="metadata-select">
                  <option value="" disabled>Sin faceta asignada</option>
                  <option v-for="facet in noteFacets" :key="facet.id" :value="facet.id">{{ facet.label }}</option>
                </select>
              </label>
              <label>Dominio
                <select :value="currentDomainObj?.id || ''" @change="changeDomain(($event.target as HTMLSelectElement).value)" class="metadata-select">
                  <option value="" disabled>Sin dominio asignado</option>
                  <option v-for="domain in domainStore.domains" :key="domain.id" :value="domain.id">{{ domain.name }}</option>
                </select>
              </label>
              <label>Tema
                <select :value="activeFileConcept.topic_id || ''" @change="updateMetadata({ topic_id: ($event.target as HTMLSelectElement).value || null })" class="metadata-select">
                  <option value="">Sin tema asignado</option>
                  <option v-for="topic in availableTopics" :key="topic.id" :value="topic.id">{{ topic.name }}</option>
                </select>
              </label>
            </div>
          </div>
          <div v-if="activeSaveStatus?.cls === 'error'" class="note-save-error" role="alert">
            {{ props.saveErrors?.[activeFile.id] || 'No se pudo guardar la nota. Tus cambios siguen aquí.' }}
            <button @click="saveNow">Reintentar guardado</button>
          </div>
          <p v-if="exportError" class="note-save-error" role="alert">{{ exportError }}</p>
          <div class="note-panes">
            <LiveEditor v-show="editorMode !== 'read'" :file-id="activeFile.id" :content="activeFile.content || ''"
              :source-mode="editorMode === 'source'" :files="files" :open-file-ids="tabs.map(tab => tab.fileId!).filter(Boolean)"
              @change="(id, content) => emit('updateFileContent', id, content)" @wikiLinkClick="target => emit('wikiLinkClick', target)" />
            <MarkdownPreview v-if="editorMode === 'read'" :key="activeFile.id" :content="activeFile.content || ''" @wikiLinkClick="target => emit('wikiLinkClick', target)" />
          </div>
        </div>
      </div>

      <div class="status-bar">
        <div class="status-left">
          <span>{{ getWordCount(activeFile!.content) }} palabras</span>
          <span>{{ getCharCount(activeFile!.content) }} caracteres</span>
          <span>~{{ getReadingMinutes(activeFile!.content) }} min de lectura</span>
        </div>
        <div class="status-right">
          <span v-if="activeSaveStatus" class="status-save" :class="activeSaveStatus.cls">
            {{ activeSaveStatus.text }}
          </span>
          <span class="status-hint">Ctrl+Click abre [[enlaces]]</span>
          <Clock :size="11" class="clock-icon" />
          <span v-if="activeFile.updatedAt">Última mod: {{ new Date(activeFile.updatedAt).toLocaleTimeString("es-ES", { hour: "numeric", minute: "2-digit" }) }}</span>
        </div>
      </div>
    </div>
    <div v-else class="editor-closed">
      Se cerró el archivo activo.
    </div>

    <PresentationViewer_Improved
      v-if="isPresentationActive && activeFile"
      :note-content="activeFile!.content"
      @close="isPresentationActive = false"
    />

    <VersionHistory
      v-if="isHistoryOpen && activeFile"
      :concept-id="activeFile.id"
      @close="isHistoryOpen = false"
      @restored="onVersionRestored"
    />

    <!-- Menú contextual de pestañas -->
    <div
      v-if="ctxMenu.visible"
      class="tab-ctx-menu"
      :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
      @mousedown.stop
    >
      <button class="tab-ctx-item" @click="ctxCloseThis">Cerrar esta nota</button>
      <button class="tab-ctx-item" :disabled="!hasRight" @click="ctxCloseRight">Cerrar a la derecha</button>
      <button class="tab-ctx-item" :disabled="!hasLeft" @click="ctxCloseLeft">Cerrar a la izquierda</button>
      <button class="tab-ctx-item" :disabled="!hasOthers" @click="ctxCloseOthers">Cerrar otras</button>
      <div class="tab-ctx-divider"></div>
      <button class="tab-ctx-item" @click="ctxCloseAll">Cerrar todas</button>
    </div>
  </div>
</template>

