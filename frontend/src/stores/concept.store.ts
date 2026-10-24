import { defineStore } from 'pinia';
import { ref } from 'vue';
import { requestJson } from '../lib/api';
import type { Concept, ConceptSummary } from '../types/concept.types';

export const useConceptStore = defineStore('concept', () => {
  const concepts = ref<Concept[]>([]);
  const summaries = ref<ConceptSummary[]>([]);
  const trashedConcepts = ref<Concept[]>([]);
  const activeConcept = ref<Concept | null>(null);
  const isLoading = ref(false);
  const error = ref('');

  function upsertSummary(item: ConceptSummary | Concept) {
    const summary: ConceptSummary = {
      id: item.id, title: item.title, domain: item.domain ?? null,
      workspace_id: item.workspace_id, folder_id: item.folder_id,
      topic_id: item.topic_id, temporal_facet: item.temporal_facet,
      created_at: item.created_at, updated_at: item.updated_at || ''
    };
    const index = summaries.value.findIndex(c => c.id === item.id);
    if (index < 0) summaries.value.push(summary);
    else summaries.value[index] = summary;
  }

  function cache(item: Concept) {
    const index = concepts.value.findIndex(c => c.id === item.id);
    if (index < 0) concepts.value.push(item);
    else Object.assign(concepts.value[index], item);
    upsertSummary(item);
    return concepts.value.find(c => c.id === item.id)!;
  }

  async function fetchConcepts() {
    isLoading.value = true;
    try {
      const items = await requestJson<Concept[]>('/api/concepts');
      if (!Array.isArray(items)) throw new Error('Listado de notas inválido');
      concepts.value = items;
    } finally { isLoading.value = false; }
  }

  async function fetchSummaries() {
    isLoading.value = true;
    error.value = '';
    try {
      const items = await requestJson<ConceptSummary[]>('/api/concepts/summaries');
      if (!Array.isArray(items)) throw new Error('Listado de notas inválido');
      summaries.value = items;
    } catch (cause) {
      summaries.value = [];
      error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar las notas';
      throw cause;
    } finally { isLoading.value = false; }
  }

  async function getConcept(id: string) {
    const item = await requestJson<Concept>('/api/concepts/' + encodeURIComponent(id));
    if (!item?.id || typeof item.explanation !== 'string') throw new Error('Contenido de nota inválido');
    activeConcept.value = cache(item);
    return activeConcept.value;
  }

  async function createConcept(data: Partial<Concept>) {
    const created = await requestJson<Concept>('/api/concepts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    activeConcept.value = cache(created);
    return activeConcept.value;
  }

  async function updateConcept(id: string, data: Partial<Concept>) {
    const current = concepts.value.find(c => c.id === id);
    const before = current ? { ...current } : null;
    const updated = await requestJson<Concept>('/api/concepts/' + encodeURIComponent(id), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    if (!updated?.id || typeof updated.explanation !== 'string') throw new Error('Confirmación de guardado inválida');
    if (current && before) {
      // Only apply acknowledged fields, and never overwrite edits made while awaiting the response.
      for (const key of Object.keys(data) as (keyof Concept)[]) {
        if (current[key] === before[key]) Object.assign(current, { [key]: updated[key] });
      }
      current.updated_at = updated.updated_at;
    } else {
      cache(updated);
    }
    upsertSummary(updated);
    if (activeConcept.value?.id === id) activeConcept.value = current || updated;
    return updated;
  }

  async function deleteConcept(id: string) {
    await requestJson('/api/concepts/' + encodeURIComponent(id), { method: 'DELETE' });
    concepts.value = concepts.value.filter(c => c.id !== id);
    summaries.value = summaries.value.filter(c => c.id !== id);
    if (activeConcept.value?.id === id) activeConcept.value = null;
  }

  async function fetchTrashed() {
    trashedConcepts.value = await requestJson<Concept[]>('/api/concepts/trashed');
  }

  async function restoreConcept(id: string) {
    const restored = await requestJson<Concept>('/api/concepts/' + encodeURIComponent(id) + '/restore', { method: 'POST' });
    cache(restored);
    trashedConcepts.value = trashedConcepts.value.filter(c => c.id !== id);
  }

  async function purgeConcept(id: string) {
    await requestJson('/api/concepts/' + encodeURIComponent(id) + '/purge', { method: 'DELETE' });
    trashedConcepts.value = trashedConcepts.value.filter(c => c.id !== id);
  }

  return {
    concepts, summaries, trashedConcepts, activeConcept, isLoading, error,
    fetchConcepts, fetchAllConcepts: fetchConcepts, fetchSummaries, fetchConceptSummaries: fetchSummaries,
    getConcept, fetchConceptById: getConcept, createConcept, updateConcept, deleteConcept,
    fetchTrashed, restoreConcept, purgeConcept, upsertSummary
  };
});
