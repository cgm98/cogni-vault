import { defineStore } from 'pinia';
import { ref } from 'vue';
import { requestJson } from '../lib/api';
import type { SearchResultItem, HybridSearchResponse } from '../types/search.types';

export const useSearchStore = defineStore('search', () => {
  const query = ref('');
  const results = ref<SearchResultItem[]>([]);
  const totalResults = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const alpha = ref(0.5); // 0.0 = solo vector, 1.0 = solo FTS5
  const selectedTypes = ref<string[]>(['concept', 'anchor', 'source', 'claim']);

  async function search(workspaceId: string, q: string, customAlpha?: number) {
    if (!workspaceId || !q.trim()) {
      results.value = [];
      totalResults.value = 0;
      return;
    }

    loading.value = true;
    error.value = null;
    query.value = q;
    const a = customAlpha !== undefined ? customAlpha : alpha.value;

    try {
      const typesParam = selectedTypes.value.length > 0 ? `&types=${selectedTypes.value.join(',')}` : '';
      const url = `/api/workspaces/${workspaceId}/search?q=${encodeURIComponent(q.trim())}&alpha=${a}${typesParam}`;
      const res = await requestJson<HybridSearchResponse>(url);
      results.value = res.items || [];
      totalResults.value = res.total_results || 0;
    } catch (err: any) {
      error.value = err.message || 'Error en búsqueda híbrida';
      results.value = [];
      totalResults.value = 0;
    } finally {
      loading.value = false;
    }
  }

  function clear() {
    query.value = '';
    results.value = [];
    totalResults.value = 0;
    error.value = null;
  }

  return {
    query,
    results,
    totalResults,
    loading,
    error,
    alpha,
    selectedTypes,
    search,
    clear
  };
});
