<script setup lang="ts">
import { useConceptStore } from '../../stores/concept.store';
import { useDomainStore } from '../../stores/domain.store';
import { useAreaStore } from '../../stores/area.store';
import { useTopicStore } from '../../stores/topic.store';
import { useCerebroStore } from '../../stores/cerebro.store';
import type { TemporalFacet } from '../../types/cerebro.types';
import './style.css';
import { noteHierarchy } from '../../lib/noteTree';
import { noteFacets } from '../../lib/noteFacets';
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { FileText, Search, BrainCircuit, PanelLeft, Archive, Plus, ChevronDown, Sparkles } from 'lucide-vue-next';

import Sidebar from '../../components/Sidebar/Index.vue';
import MarkdownEditor from '../../components/MarkdownEditor/Index.vue';
import Copilot from '../../components/Copilot/Index.vue';
import CommandPalette from '../../components/CommandPalette/Index.vue';
import Modal from '../../components/Modal/Index.vue';
import BackupModal from '../../components/BackupModal/Index.vue';
import { ExportService } from '../../services/export.service';
import { isFileLink, isSymbolLink, linkKey } from '../../lib/wikilinks';
import { parseFrontmatter } from '../../lib/frontmatter';
import { useToast } from '../../composables/useToast';
import { useSaveCoordinator } from '../../composables/useSaveCoordinator';
import type { FileItem, FolderItem, TabItem } from '../../types';
import type { Concept, ConceptSummary } from '../../types/concept.types';

const conceptStore = useConceptStore();
const domainStore = useDomainStore();
const areaStore = useAreaStore();
const topicStore = useTopicStore();
const cerebroStore = useCerebroStore();
const route = useRoute();
const router = useRouter();

// Modal para crear nuevo cerebro
const isCreateCerebroModalOpen = ref(false);
const newCerebroName = ref('');
const newCerebroDescription = ref('');
const newCerebroIcon = ref('brain');
const newCerebroColor = ref('#3B82F6');

const isCerebroDropdownOpen = ref(false);
const cerebroDropdownRef = ref<HTMLElement | null>(null);

const handleDocumentClick = (e: MouseEvent) => {
  if (isCerebroDropdownOpen.value && cerebroDropdownRef.value && !cerebroDropdownRef.value.contains(e.target as Node)) {
    isCerebroDropdownOpen.value = false;
  }
};

const handleCreateNewCerebro = async () => {
  if (!newCerebroName.value.trim()) return;
  try {
    await cerebroStore.createCerebro({
      name: newCerebroName.value.trim(),
      description: newCerebroDescription.value.trim() || null,
      icon: newCerebroIcon.value,
      color: newCerebroColor.value
    });
    isCreateCerebroModalOpen.value = false;
    newCerebroName.value = '';
    newCerebroDescription.value = '';
    triggerToast('Cerebro creado exitosamente', 'success');
  } catch (err: any) {
    triggerToast(err.message || 'Error al crear cerebro', 'error');
  }
};

// Deep-links heredados de la bóveda: /notes?id=<concepto> y /notes?new=true|<título>
const applyRouteQuery = async () => {
  const id = route.query.id as string;
  const newParam = route.query.new as string;
  if (id) {
    await handleSelectFile(id);
  } else if (newParam) {
    await handleCreateFile('root', newParam === 'true' ? undefined : newParam);
    router.replace({ query: {} });
  }
};

const loadingNotes = ref(true);
const loadError = ref('');
const loadingFile = ref(false);
const creatingNote = ref(false);
const loadNotes = async () => {
  loadingNotes.value = true;
  loadError.value = '';
  try {
    await Promise.all([
      cerebroStore.fetchCerebros(), conceptStore.fetchConceptSummaries(),
      domainStore.fetchDomains(), areaStore.fetchAreas(), topicStore.fetchTopics()
    ]);
    await applyRouteQuery();
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'No se pudieron cargar las notas';
  } finally { loadingNotes.value = false; }
};
onMounted(() => {
  conceptStore.concepts = [];
  conceptStore.activeConcept = null;
  document.addEventListener('click', handleDocumentClick);
  void loadNotes();
});

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick);
});

watch(() => route.query, () => { applyRouteQuery(); });

const hierarchy = computed(() => noteHierarchy(cerebroStore.cerebros, areaStore.areas, domainStore.domains, topicStore.topics));
const folders = computed(() => hierarchy.value.foldersFor(cerebroStore.activeCerebro?.id));
const allFiles = computed<FileItem[]>(() => conceptStore.summaries.map(summary => {
  const full = conceptStore.concepts.find(c => c.id === summary.id);
  const note = full || summary;
  return {
    id: note.id, name: note.title, ...hierarchy.value.location(note),
    content: full?.explanation ?? '',
    createdAt: note.created_at ? Date.parse(note.created_at) : undefined,
    updatedAt: note.updated_at ? Date.parse(note.updated_at) : undefined,
    temporal_facet: note.temporal_facet
  };
}));
const spaceFiles = computed(() => allFiles.value.filter(file => !cerebroStore.activeCerebro || file.workspaceId === cerebroStore.activeCerebro.id));

const files = computed(() => spaceFiles.value.filter(file => cerebroStore.activeFacet === 'ALL' || file.temporal_facet === cerebroStore.activeFacet));

const activeFileId = ref<string | null>(null);
const tabs = ref<TabItem[]>([]);
const activeTabId = ref<string | null>(null);
const visibleTabs = computed(() => tabs.value.filter(tab => spaceFiles.value.some(file => file.id === tab.fileId)));
watch(() => cerebroStore.activeCerebro?.id, () => {
  ++openRequest;
  loadingFile.value = false;
  const next = visibleTabs.value.find(tab => tab.fileId === activeFileId.value) || visibleTabs.value.at(-1);
  activeTabId.value = next?.id || null;
  activeFileId.value = next?.fileId || null;
});
const showSidebar = ref(window.matchMedia('(min-width: 768px)').matches);
const showCopilot = ref(false);
const isCommandPaletteOpen = ref(false);

const toast = useToast();
const triggerToast = (msg: string, type: 'success' | 'error' = 'success') =>
  type === 'error' ? toast.error(msg) : toast.success(msg);

const handleSelectTab = (tabId: string) => {
  activeTabId.value = tabId;
  const tab = tabs.value.find((t) => t.id === tabId);
  if (tab) {
    activeFileId.value = tab.fileId;
  }
};

const handleGlobalShortcuts = async (e: KeyboardEvent) => {
  try {
    const key = e.key?.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && key === 'p') {
      e.preventDefault();
      isCommandPaletteOpen.value = !isCommandPaletteOpen.value;
    }

    if ((e.ctrlKey || e.metaKey) && (key === 's' || e.code === 'KeyS')) {
      e.preventDefault();
      const currentFileId = activeFileId.value || tabs.value.find((t) => t.id === activeTabId.value)?.fileId;
      if (currentFileId) {
        const file = allFiles.value.find((f) => f.id === currentFileId);
        if (file) {
          await handleUpdateFileContent(file.id, file.content, true);
        }
      }
    }
  } catch (err) {
    console.error('Error global shortcut', err);
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleGlobalShortcuts);
  window.addEventListener('beforeunload', onBeforeUnload);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalShortcuts);
  window.removeEventListener('beforeunload', onBeforeUnload);
});

const ensureConceptLoaded = async (fileId: string) => {
  const cached = conceptStore.concepts.find((c: Concept) => c.id === fileId);
  if (cached) return cached;
  return await conceptStore.fetchConceptById(fileId);
};

let openRequest = 0;
const handleSelectFile = async (fileId: string) => {
  if (!fileId) return;
  const file = allFiles.value.find((f) => f.id === fileId);
  if (!file) return;

  const request = ++openRequest;
  loadingFile.value = true;
  try { await ensureConceptLoaded(fileId); }
  catch (error) {
    triggerToast(error instanceof Error ? error.message : 'No se pudo cargar la nota', 'error');
    return;
  } finally { if (request === openRequest) loadingFile.value = false; }
  if (request !== openRequest) return;

  activeFileId.value = fileId;
  if (window.matchMedia('(max-width: 767px)').matches) showSidebar.value = false;

  const existingTab = tabs.value.find((t) => t.fileId === fileId);
  if (existingTab) {
    activeTabId.value = existingTab.id;
  } else {
    const nextTabId = `tab-${Date.now()}`;
    tabs.value.push({ id: nextTabId, fileId: fileId, mode: 'edit' });
    activeTabId.value = nextTabId;
  }
};

const handleCloseTab = async (tabId: string) => {
  const closingTab = tabs.value.find((t) => t.id === tabId);
  if (closingTab) {
    const status = saveStates.value[closingTab.fileId];
    if (status === 'dirty' || status === 'saving' || status === 'error') {
      const saved = await persistFile(closingTab.fileId, { isRetry: true });
      if (!saved) return;
    }
  }

  tabs.value = tabs.value.filter((t) => t.id !== tabId);

  if (activeTabId.value === tabId) {
    if (visibleTabs.value.length > 0) {
      const lastTab = visibleTabs.value[visibleTabs.value.length - 1];
      activeTabId.value = lastTab.id;
      activeFileId.value = lastTab.fileId;
    } else {
      activeTabId.value = null;
      activeFileId.value = null;
    }
  }
};

// ── Estado de guardado por archivo ──
// El autosave nunca falla en silencio: cada nota expone dirty/saving/saved/error,
// un fallo reintenta una vez y, si persiste, se avisa con toast e indicador ⚠.
// Coordinación (coalescing de guardados concurrentes, reintentos) extraída a
// useSaveCoordinator — ver ese archivo para el detalle genérico.
const {
  saveStates, saveErrors, recentlySaved, hasUnsavedChanges,
  clearSaveTracking, markDirty,
  cancelScheduledSave, scheduleSave, persistFile, flushUnsaved
} = useSaveCoordinator({
  exists: (fileId) => !!conceptStore.concepts.find(c => c.id === fileId),
  save: async (fileId) => {
    const concept = conceptStore.concepts.find(c => c.id === fileId);
    if (!concept) return;
    if (!concept.title.trim()) throw new Error('Escribe un título antes de guardar');
    await conceptStore.updateConcept(fileId, {
      title: concept.title, explanation: concept.explanation, domain: concept.domain,
      topic_id: concept.topic_id, temporal_facet: concept.temporal_facet, facet_subtype: concept.facet_subtype
    });
  },
  onSaveSuccess: () => triggerToast('Nota guardada correctamente', 'success'),
  onSaveError: (_id, e) => toast.error(e.message || 'Error al guardar la nota', e.details),
  onRetryExhausted: () => triggerToast('No se pudo guardar la nota automáticamente. Pulsa Ctrl+S para reintentar.', 'error')
});

const handleFileRestored = async (id: string) => {
  clearSaveTracking(id);
  await conceptStore.fetchConceptById(id);
};
const handleUpdateMetadata = (id: string, patch: Partial<Concept>) => {
  const concept = conceptStore.concepts.find(c => c.id === id);
  if (!concept) return;
  Object.assign(concept, patch);
  scheduleSave(id);
};
const prepareHistory = async () => activeFileId.value ? persistFile(activeFileId.value) : false;
const handleUpdateFileContent = async (fileId: string, updatedContent: string, isImmediate = false) => {
  const concept = conceptStore.concepts.find((c: Concept) => c.id === fileId);
  if (concept) {
    if (concept.explanation === updatedContent && !isImmediate) return;
    concept.explanation = updatedContent;
  } else {
    const loaded = await ensureConceptLoaded(fileId);
    if (loaded) loaded.explanation = updatedContent;
  }

  if (isImmediate) {
    markDirty(fileId);
    cancelScheduledSave(fileId);
    await persistFile(fileId, { showToast: true });
  } else {
    scheduleSave(fileId);
  }
};

// ── Guard de salida: nunca abandonar la vista con cambios no persistidos ──
const leaveDialog = ref<{ visible: boolean; resolve: ((v: boolean) => void) | null }>({ visible: false, resolve: null });

const askDiscardConfirmation = () => new Promise<boolean>(resolve => {
  leaveDialog.value = { visible: true, resolve };
});

const resolveLeaveDialog = (leave: boolean) => {
  leaveDialog.value.resolve?.(leave);
  leaveDialog.value = { visible: false, resolve: null };
};

onBeforeRouteLeave(async () => {
  if (!hasUnsavedChanges.value) return true;
  // Primero intentar guardar: en el caso normal el usuario nunca ve un diálogo.
  if (await flushUnsaved()) return true;
  return await askDiscardConfirmation();
});

const onBeforeUnload = (e: BeforeUnloadEvent) => {
  if (hasUnsavedChanges.value) {
    e.preventDefault();
    e.returnValue = '';
  }
};

const noteDestinationOpen = ref(false);
const noteDestination = ref('');
const pendingNoteName = ref<string>();
const pendingNoteContent = ref('');
const noteDestinations = computed(() => folders.value.filter(f => f.kind === 'domain' || f.kind === 'topic').map(f => {
  const names = [f.name];
  let parent = folders.value.find(p => p.id === f.parentId);
  while (parent) { names.unshift(parent.name); parent = folders.value.find(p => p.id === parent!.parentId); }
  return { id: f.id, label: names.join(' / ') };
}));
const confirmNoteDestination = async () => {
  const id = await handleCreateFile(noteDestination.value, pendingNoteName.value, pendingNoteContent.value);
  if (id) noteDestinationOpen.value = false;
};
const handleCreateFile = async (folderId = 'root', defaultName?: string, initialContent = '') => {
  if (creatingNote.value) return;
  if (folderId === 'root') {
    pendingNoteName.value = defaultName;
    pendingNoteContent.value = initialContent;
    noteDestination.value = '';
    noteDestinationOpen.value = true;
    return;
  }
  creatingNote.value = true;
  try {
    const placeholderName = defaultName || `Nota sin título ${files.value.length + 1}`;
    const conceptData: any = {
      title: placeholderName,
      explanation: initialContent
    };

    if (noteFacets.some(facet => facet.id === cerebroStore.activeFacet)) conceptData.temporal_facet = cerebroStore.activeFacet;
    const isTopic = topicStore.topics.find((t: any) => t.id === folderId);
    const isDomain = domainStore.domains.find((d: any) => d.id === folderId);

    if (isTopic) {
      conceptData.topic_id = folderId;
      conceptData.domain = isTopic.domain_id;
    } else if (isDomain) {
      conceptData.domain = folderId;
      conceptData.topic_id = null;
    } else {
      conceptData.domain = '';
    }

    const newConcept = await conceptStore.createConcept(conceptData);
    await domainStore.fetchDomains();
    await handleSelectFile(newConcept.id);
    return newConcept.id;
  } catch (e) {
    triggerToast(e instanceof Error ? e.message : 'No se pudo crear la nota', 'error');
  } finally { creatingNote.value = false; }
};

const handleCreateDailyNote = async () => {
  const today = new Date();
  const title = today.toISOString().slice(0, 10); // YYYY-MM-DD

  const existing = files.value.find((f) => f.name === title);
  if (existing) {
    handleSelectFile(existing.id);
    triggerToast('Nota diaria de hoy abierta', 'success');
    return;
  }

  try {
    const readable = today.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    await handleCreateFile('root', title, '# ' + title + '\n\n> ' + readable + '\n\n## Registro del día\n\n- [ ] ');
  } catch (e: any) {
    console.error(e);
    triggerToast('No se pudo crear la nota diaria', 'error');
  }
};

const handleCreateFolder = async (parentId = 'root', defaultName?: string) => {
  try {
    const placeholderName = defaultName || `Nueva Carpeta ${folders.value.length + 1}`;

    const isArea = areaStore.areas.find((a: any) => a.id === parentId);
    const isDomain = domainStore.domains.find((d: any) => d.id === parentId);

    const workspace = cerebroStore.cerebros.find(c => c.id === parentId);
    if (parentId === 'root' || workspace) {
      const newArea = await areaStore.createArea({
        name: placeholderName,
        cerebro_id: workspace?.id || cerebroStore.activeCerebro?.id || null,
        description: 'Área',
        color: '#3b82f6'
      });
      return newArea.id;
    } else if (isArea) {
      const newDomain = await domainStore.createDomain({
        name: placeholderName,
        description: 'Dominio',
        color: '#10b981',
        area_id: parentId
      });
      return newDomain.id;
    } else if (isDomain) {
      const newTopic = await topicStore.createTopic({
        name: placeholderName,
        description: 'Tema',
        color: '#8b5cf6',
        domain_id: parentId
      });
      return newTopic.id;
    } else {
      triggerToast('Los temas no admiten subcarpetas', 'error');
    }
  } catch (e: any) {
    console.error(e);
    triggerToast(e?.response?.data?.error?.message || 'No se pudo crear la carpeta', 'error');
  }
};

const handleRenameFile = async (fileId: string, newName: string) => {
  try {
    const cached = conceptStore.concepts.find((c: Concept) => c.id === fileId);
    if (!cached) {
      const summary = conceptStore.summaries.find((c: ConceptSummary) => c.id === fileId);
      if (summary) conceptStore.upsertSummary({ ...summary, title: newName });
    }
    await conceptStore.updateConcept(fileId, { title: newName });
  } catch (e) { console.error(e) }
};

const handleRenameFolder = async (folderId: string, newName: string) => {
  try {
    const isArea = areaStore.areas.find((a: any) => a.id === folderId);
    const isDomain = domainStore.domains.find((d: any) => d.id === folderId);
    const isTopic = topicStore.topics.find((t: any) => t.id === folderId);

    if (isArea) {
      await areaStore.updateArea(folderId, { name: newName });
    } else if (isDomain) {
      await domainStore.updateDomain(folderId, { name: newName });
    } else if (isTopic) {
      await topicStore.updateTopic(folderId, { name: newName });
    }
  } catch (e) { console.error(e) }
};

const handleDeleteFile = async (fileId: string) => {
  try {
    await conceptStore.deleteConcept(fileId);
    // La nota ya no existe: descartar su estado de guardado antes de cerrar tabs
    clearSaveTracking(fileId);
    const targetTabs = tabs.value.filter((t) => t.fileId === fileId);
    targetTabs.forEach((tab) => handleCloseTab(tab.id));
  } catch (e) { console.error(e) }
};

const handleDeleteFolder = async (folderId: string) => {
  try {
    const isArea = areaStore.areas.find((a: any) => a.id === folderId);
    const isDomain = domainStore.domains.find((d: any) => d.id === folderId);
    const isTopic = topicStore.topics.find((t: any) => t.id === folderId);

    if (isArea) {
      await areaStore.deleteArea(folderId);
    } else if (isDomain) {
      await domainStore.deleteDomain(folderId);
    } else if (isTopic) {
      await topicStore.deleteTopic(folderId);
    }
  } catch (e) { console.error(e) }
};

const handleMoveFile = async (fileId: string, targetFolderId: string) => {
  try {
    const isTopic = topicStore.topics.find((t: any) => t.id === targetFolderId);
    const isDomain = domainStore.domains.find((d: any) => d.id === targetFolderId);

    if (isTopic) {
      await conceptStore.updateConcept(fileId, {
        topic_id: targetFolderId,
        domain: isTopic.domain_id
      });
    } else if (isDomain) {
      await conceptStore.updateConcept(fileId, {
        topic_id: null,
        domain: targetFolderId
      });
    } else {
      await conceptStore.updateConcept(fileId, {
        topic_id: null,
        domain: ''
      });
    }
  } catch (e) { console.error(e) }
};

// La jerarquía es Área > Dominio > Tema: solo son válidos los movimientos
// dominio→área y tema→dominio.
const handleMoveFolder = async (folderId: string, targetId: string) => {
  try {
    const isDomain = domainStore.domains.find((d: any) => d.id === folderId);
    const isTopic = topicStore.topics.find((t: any) => t.id === folderId);
    const targetIsArea = areaStore.areas.find((a: any) => a.id === targetId);
    const targetIsDomain = domainStore.domains.find((d: any) => d.id === targetId);

    if (isDomain && targetIsArea) {
      await domainStore.updateDomain(folderId, { area_id: targetId });
      triggerToast('Dominio movido', 'success');
    } else if (isTopic && targetIsDomain) {
      await topicStore.updateTopic(folderId, { domain_id: targetId });
      triggerToast('Tema movido', 'success');
    } else {
      triggerToast('Movimiento no válido: los dominios van dentro de áreas y los temas dentro de dominios', 'error');
    }
  } catch (e) { console.error(e) }
};

const sidebarRef = ref<InstanceType<typeof Sidebar> | null>(null);

const handleTagClick = (tag: string) => {
  showSidebar.value = true;
  sidebarRef.value?.openSearch(`#${tag}`);
};

const handleWikiLinkClick = async (noteName: string) => {
  if (!noteName) return;

  // Legacy code references remain in the note but no longer open a graph.
  if (isFileLink(noteName) || isSymbolLink(noteName)) {
    triggerToast('La navegación a archivos y símbolos ya no está disponible', 'error');
    return;
  }

  const target = linkKey(noteName);

  const match = files.value.find((f) => f && f.name && linkKey(f.name) === target);

  if (match) {
    handleSelectFile(match.id);
  } else {
    // Como Obsidian: seguir un enlace inexistente crea la nota al momento
    const newId = await handleCreateFile('root', noteName.trim());
    if (newId) triggerToast(`Nota "${noteName.trim()}" creada`, 'success');
  }
};

// Import masivo: uno o varios .md sueltos, todos al mismo tema (título = frontmatter.title o nombre de archivo)
const handleImportMarkdownFiles = async (folderId: string, fileList: File[]) => {
  const topic = topicStore.topics.find((t: any) => t.id === folderId);
  if (!topic) {
    triggerToast('Solo se puede importar dentro de un tema', 'error');
    return;
  }

  let ok = 0, failed = 0;
  for (const file of fileList) {
    try {
      const raw = await file.text();
      const { data, body } = parseFrontmatter(raw);
      const title = data.title || file.name.replace(/\.md$/i, '');
      await conceptStore.createConcept({
        title,
        explanation: body.trim() || title,
        domain: topic.domain_id,
        topic_id: topic.id
      });
      ok++;
    } catch (e) {
      console.error(e);
      failed++;
    }
  }

  triggerToast(
    failed ? `${ok} nota(s) importada(s), ${failed} fallaron` : `${ok} nota(s) importada(s) en "${topic.name}"`,
    failed ? 'error' : 'success'
  );
};

const handleExportVault = () => {
  try {
    const payload = {
      exportedAt: new Date().toISOString(),
      folders: folders.value,
      files: files.value
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `boveda-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    triggerToast('Bóveda exportada como JSON', 'success');
  } catch (e) {
    console.error(e);
    triggerToast('Error al exportar la bóveda', 'error');
  }
};

const isBackupModalOpen = ref(false);
const isExportingAll = ref(false);
const exportingAreaId = ref<string | null>(null);

const handleDownloadVaultZip = async () => {
  isExportingAll.value = true;
  try {
    const filename = await ExportService.triggerNotesZipDownload();
    triggerToast(`Bóveda descargada: ${filename}`, 'success');
  } catch (e: any) {
    console.error('Error al exportar boveda ZIP:', e);
    triggerToast('Error al generar el archivo .zip de la bóveda', 'error');
  } finally {
    isExportingAll.value = false;
  }
};

const handleDownloadAreaZip = async (areaId: string, areaName?: string) => {
  if (!areaId) return;
  exportingAreaId.value = areaId;
  try {
    const targetArea = areaStore.areas.find((a: any) => a.id === areaId);
    const name = areaName || targetArea?.name || 'area';
    const filename = await ExportService.triggerNotesZipDownload(areaId, name);
    triggerToast(`Área "${name}" descargada: ${filename}`, 'success');
  } catch (e: any) {
    console.error('Error al exportar area ZIP:', e);
    triggerToast('Error al generar el archivo .zip del área', 'error');
  } finally {
    exportingAreaId.value = null;
  }
};

const handleTriggerAction = (action: string) => {
  switch (action) {
    case 'openBackupModal':
      isBackupModalOpen.value = true;
      break;
    case 'exportVaultZip':
      handleDownloadVaultZip();
      break;
    case 'toggleSidebar':
      showSidebar.value = !showSidebar.value;
      break;
    case 'toggleCopilot':
      showCopilot.value = !showCopilot.value;
      break;
    case 'createDailyNote':
      handleCreateDailyNote();
      break;
    case 'exportVault':
      handleExportVault();
      break;
    default:
      console.warn('Acción desconocida:', action);
  }
};
</script>

<template>
  <div class="notes-container">
    <div class="notes-header">
      <div class="header-left">
        <button class="sidebar-toggle-btn" @click="showSidebar = !showSidebar" title="Alternar barra lateral">
          <PanelLeft :size="14" />
        </button>

        <!-- Selector de Cerebros (Nivel 0) -->
        <div ref="cerebroDropdownRef" class="cerebro-selector-dropdown-wrapper">
          <button @click.stop="isCerebroDropdownOpen = !isCerebroDropdownOpen" class="cerebro-current-btn"
            :style="{ borderColor: cerebroStore.activeCerebro?.color || '#6366f1' }"
            title="Seleccionar Espacio / Cerebro de Conocimiento">
            <span class="cerebro-icon-indicator"
              :style="{ backgroundColor: cerebroStore.activeCerebro?.color || '#6366f1' }"></span>
            <span class="cerebro-current-name">{{ cerebroStore.activeCerebro?.name || '🌐 Todos los Espacios' }}</span>
            <ChevronDown :size="12" class="cerebro-arrow" :class="{ 'rotated': isCerebroDropdownOpen }" />
          </button>

          <!-- Dropdown Menu de Cerebros -->
          <div v-if="isCerebroDropdownOpen" class="cerebro-dropdown-menu">
            <div class="cerebro-dropdown-header">
              <span>Espacios de Pensamiento</span>
            </div>
            <div @click="cerebroStore.setActiveCerebro('ALL'); isCerebroDropdownOpen = false"
              class="cerebro-dropdown-item" :class="{ 'active': !cerebroStore.activeCerebro }">
              <span class="cerebro-item-dot" style="background-color: #6366f1"></span>
              <div class="cerebro-item-info">
                <span class="cerebro-item-name">🌐 Todos los Espacios</span>
                <span class="cerebro-item-desc">Visión unificada de todos los cerebros</span>
              </div>
            </div>
            <div class="cerebro-dropdown-divider"></div>
            <div v-for="c in cerebroStore.cerebros" :key="c.id"
              @click="cerebroStore.setActiveCerebro(c.id); isCerebroDropdownOpen = false" class="cerebro-dropdown-item"
              :class="{ 'active': cerebroStore.activeCerebro?.id === c.id }">
              <span class="cerebro-item-dot" :style="{ backgroundColor: c.color }"></span>
              <div class="cerebro-item-info">
                <span class="cerebro-item-name">{{ c.name }}</span>
                <span class="cerebro-item-desc">{{ c.description || 'Espacio de trabajo' }}</span>
              </div>
            </div>
            <div class="cerebro-dropdown-divider"></div>
            <button @click="isCreateCerebroModalOpen = true; isCerebroDropdownOpen = false" class="cerebro-create-btn">
              <Plus :size="13" />
              <span>Nuevo Cerebro...</span>
            </button>
          </div>
        </div>
      </div>

      <div class="facet-pills-bar" aria-label="Facetas de las notas">
        <button class="facet-pill-btn" :class="{ active: cerebroStore.activeFacet === 'ALL' }" :aria-pressed="cerebroStore.activeFacet === 'ALL'" @click="cerebroStore.setActiveFacet('ALL')">Todas <span class="facet-pill-count">{{ spaceFiles.length }}</span></button>
        <button v-for="facet in noteFacets" :key="facet.id" class="facet-pill-btn" :class="[facet.className, { active: cerebroStore.activeFacet === facet.id }]" :aria-pressed="cerebroStore.activeFacet === facet.id" @click="cerebroStore.setActiveFacet(facet.id)">
          {{ facet.label }} <span class="facet-pill-count">{{ spaceFiles.filter(file => file.temporal_facet === facet.id).length }}</span>
        </button>
      </div>
      <div class="header-right">
        <div class="keyboard-hint">
          <span>Comandos:</span>
          <kbd class="nv-kbd-key">Ctrl</kbd>
          <span>+</span>
          <kbd class="nv-kbd-key">P</kbd>
        </div>

        <button @click="isBackupModalOpen = true" class="palette-btn" title="Descargar Backup de Notas (.zip)">
          <Archive :size="13" />
          <span>Backup</span>
        </button>

        <button @click="isCommandPaletteOpen = true" class="palette-btn" title="Abrir paleta de comandos (Ctrl+P)">
          <Search :size="12" />
          <span>Paleta</span>
        </button>

        <button @click="showCopilot = !showCopilot" class="copilot-btn"
          :class="showCopilot ? 'copilot-active' : 'copilot-inactive'" title="Mostrar / Ocultar Chat Copiloto">
          <BrainCircuit :size="14" />
        </button>
      </div>
    </div>

    <div v-if="loadingNotes" class="notes-notice" role="status">Cargando notas…</div>
    <div v-else-if="loadError" class="notes-notice notes-notice-error" role="alert">
      {{ loadError }} <button @click="loadNotes">Reintentar</button>
    </div>
    <div v-else class="notes-list-summary">{{ files.length }} notas <span v-if="loadingFile" role="status"> · Abriendo nota…</span></div>

    <div class="notes-main">
      <Sidebar ref="sidebarRef" v-show="showSidebar" :files="loadingNotes || loadError ? [] : files" :loading="loadingNotes" :error="loadError" :creating="creatingNote" :folders="folders" :activeFileId="activeFileId"
        :activeFacet="cerebroStore.activeFacet" @selectFile="handleSelectFile" @createFile="handleCreateFile"
        @createFolder="handleCreateFolder" @renameFile="handleRenameFile" @renameFolder="handleRenameFolder"
        @deleteFile="handleDeleteFile" @deleteFolder="handleDeleteFolder" @moveFile="handleMoveFile"
        @moveFolder="handleMoveFolder" @exportVault="handleExportVault" @exportVaultZip="handleDownloadVaultZip"
        @exportArea="(areaId: string, areaName?: string) => handleDownloadAreaZip(areaId, areaName)"
        @exportAreaZip="(areaId: string) => handleDownloadAreaZip(areaId)" @createDailyNote="handleCreateDailyNote"
        @importMarkdownFiles="handleImportMarkdownFiles" />

      <div class="inner-content">
        <MarkdownEditor :files="allFiles" :prepareHistory="prepareHistory" :activeFileId="activeFileId" :tabs="visibleTabs" :activeTabId="activeTabId"
          :saveStates="saveStates" :saveErrors="saveErrors" :recentlySaved="recentlySaved" @selectTab="handleSelectTab"
          @closeTab="handleCloseTab" @updateFileContent="handleUpdateFileContent" @wikiLinkClick="handleWikiLinkClick"
          @tagClick="handleTagClick" @fileRestored="handleFileRestored" @updateMetadata="handleUpdateMetadata" />
      </div>

      <Copilot v-if="showCopilot" :files="files" :activeFileId="activeFileId"
        @updateFileContent="handleUpdateFileContent" @openNote="handleSelectFile" @close="showCopilot = false" />
    </div>

    <CommandPalette :files="files" :isOpen="isCommandPaletteOpen" @close="isCommandPaletteOpen = false"
      @selectFile="handleSelectFile" @createFile="(name?: string) => handleCreateFile('root', name)"
      @triggerAction="handleTriggerAction" />

    <BackupModal :isOpen="isBackupModalOpen" :areas="areaStore.areas" :domains="domainStore.domains"
      :topics="topicStore.topics" :files="files" :isExportingAll="isExportingAll" :exportingAreaId="exportingAreaId"
      @close="isBackupModalOpen = false" @exportVault="handleDownloadVaultZip"
      @exportArea="({ areaId, areaName }) => handleDownloadAreaZip(areaId, areaName)" />

    <div v-if="noteDestinationOpen" class="cerebro-modal-backdrop" @click.self="noteDestinationOpen = false">
      <form class="cerebro-modal-card" @submit.prevent="confirmNoteDestination">
        <div class="cerebro-modal-header"><h3>Nueva nota · Elegir carpeta</h3></div>
        <div class="cerebro-modal-body">
          <p v-if="!noteDestinations.length">Primero crea un área y un dominio desde el explorador de archivos de este espacio.</p>
          <template v-else><label for="note-destination">Dominio o tema en el workspace actual</label>
          <select id="note-destination" v-model="noteDestination" class="cerebro-select" required>
            <option disabled value="">Selecciona una carpeta</option>
            <option v-for="folder in noteDestinations" :key="folder.id" :value="folder.id">{{ folder.label }}</option>
          </select></template>
        </div>
        <div class="cerebro-modal-footer"><button type="button" class="cerebro-btn-cancel" @click="noteDestinationOpen = false">Cancelar</button><button type="submit" class="cerebro-btn-submit" :disabled="!noteDestination || creatingNote">Crear nota</button></div>
      </form>
    </div>
    <!-- Modal para Crear Nuevo Cerebro -->
    <div v-if="isCreateCerebroModalOpen" class="cerebro-modal-backdrop" @click.self="isCreateCerebroModalOpen = false">
      <div class="cerebro-modal-card">
        <div class="cerebro-modal-header">
          <div class="cerebro-modal-title-row">
            <span class="cerebro-modal-icon">🧠</span>
            <h3>Crear Nuevo Cerebro</h3>
          </div>
          <button class="cerebro-modal-close" @click="isCreateCerebroModalOpen = false">✕</button>
        </div>
        <div class="cerebro-modal-body">
          <p class="cerebro-modal-desc">
            Un cerebro es un espacio de pensamiento aislado (ej. <em>Ingeniería de Software</em> vs. <em>Ciencias
              Médicas</em>).
          </p>
          <div class="cerebro-form-group">
            <label>Nombre del Cerebro</label>
            <input v-model="newCerebroName" type="text" placeholder="Ej: Neurociencia & Biología" class="cerebro-input"
              @keydown.enter="handleCreateNewCerebro" />
          </div>
          <div class="cerebro-form-group">
            <label>Descripción / Misión Operativa</label>
            <textarea v-model="newCerebroDescription" rows="2"
              placeholder="Propósito y alcance de este espacio de conocimiento..." class="cerebro-textarea"></textarea>
          </div>
          <div class="cerebro-form-row">
            <div class="cerebro-form-group">
              <label>Color Temático</label>
              <input v-model="newCerebroColor" type="color" class="cerebro-color-input" />
            </div>
            <div class="cerebro-form-group flex-1">
              <label>Ícono</label>
              <select v-model="newCerebroIcon" class="cerebro-select">
                <option value="brain">🧠 Cerebro</option>
                <option value="code">💻 Código & Sistemas</option>
                <option value="activity">🩺 Medicina & Salud</option>
                <option value="book">📚 Literatura & Estudio</option>
                <option value="briefcase">💼 Negocios & Proyectos</option>
                <option value="terminal">⚡ Terminal & DevOps</option>
              </select>
            </div>
          </div>
        </div>
        <div class="cerebro-modal-footer">
          <button class="cerebro-btn-cancel" @click="isCreateCerebroModalOpen = false">Cancelar</button>
          <button class="cerebro-btn-submit" @click="handleCreateNewCerebro" :disabled="!newCerebroName.trim()">
            Crear Espacio
          </button>
        </div>
      </div>
    </div>

    <div class="notes-toast-stack" aria-live="polite">
      <div v-for="item in toast.toasts.value" :key="item.id" class="notes-toast" :class="item.type">{{ item.text }}</div>
    </div>
    <!-- Confirmación de descarte: solo aparece si el guardado automático falló -->
    <Modal v-if="leaveDialog.visible" title="Cambios sin guardar"
      message="Hay notas que no se pudieron guardar en el servidor. Si continúas, esos cambios se perderán."
      confirmLabel="Descartar y continuar" :destructive="true" @confirm="resolveLeaveDialog(true)"
      @cancel="resolveLeaveDialog(false)" />
  </div>
</template>

