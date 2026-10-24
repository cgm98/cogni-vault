import { defineStore } from 'pinia';
import { ref } from 'vue';
import { requestJson } from '../lib/api';
import type {
  Source,
  EvidenceAnchor,
  Claim,
  ClaimStatus,
  SupportType,
  ConceptEpistemicGraph
} from '../types/epistemic.types';
import type { CandidateSearchResponse } from '../types/search.types';

export const useEpistemicStore = defineStore('epistemic', () => {
  const activeGraph = ref<ConceptEpistemicGraph | null>(null);
  const sources = ref<Source[]>([]);
  const candidatesResponse = ref<CandidateSearchResponse | null>(null);

  const loadingGraph = ref(false);
  const loadingCandidates = ref(false);
  const error = ref<string | null>(null);

  async function fetchConceptGraph(conceptId: string) {
    if (!conceptId) {
      activeGraph.value = null;
      return;
    }
    loadingGraph.value = true;
    error.value = null;
    try {
      activeGraph.value = await requestJson<ConceptEpistemicGraph>(`/api/concepts/${conceptId}/epistemic-graph`);
    } catch (err: any) {
      error.value = err.message || 'Error al cargar grafo epistémico';
      throw err;
    } finally {
      loadingGraph.value = false;
    }
  }

  async function fetchSources(workspaceId: string) {
    if (!workspaceId) return;
    try {
      sources.value = await requestJson<Source[]>(`/api/workspaces/${workspaceId}/sources`);
    } catch (err: any) {
      console.error('Error al listar fuentes:', err);
    }
  }

  async function createSource(
    workspaceId: string,
    data: { title: string; uri?: string; content_hash?: string; raw_content?: string; mime_type?: string; metadata?: any }
  ) {
    const created = await requestJson<Source>(`/api/workspaces/${workspaceId}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    sources.value.unshift(created);
    return created;
  }

  async function createAnchor(
    sourceId: string,
    data: { locator_type: string; locator_payload: any; exact_quote: string; context_before?: string; context_after?: string }
  ) {
    return await requestJson<EvidenceAnchor>(`/api/sources/${sourceId}/anchors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }

  async function createClaim(
    conceptId: string,
    data: { statement: string; conditions?: string }
  ) {
    const created = await requestJson<Claim>(`/api/concepts/${conceptId}/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    await fetchConceptGraph(conceptId);
    return created;
  }

  async function reviewClaim(claimId: string, status: ClaimStatus) {
    const updated = await requestJson<Claim>(`/api/claims/${claimId}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (activeGraph.value) {
      const idx = activeGraph.value.claims.findIndex(c => c.id === claimId);
      if (idx !== -1) activeGraph.value.claims[idx] = updated;
    }
    return updated;
  }

  async function linkEvidence(
    conceptId: string,
    claimId: string,
    anchorId: string,
    supportType: SupportType,
    notes?: string
  ) {
    await requestJson<{ success: boolean }>(`/api/claims/${claimId}/evidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anchor_id: anchorId, support_type: supportType, notes })
    });
    await fetchConceptGraph(conceptId);
  }

  async function unlinkEvidence(conceptId: string, claimId: string, anchorId: string) {
    await requestJson<{ success: boolean }>(`/api/claims/${claimId}/evidence/${anchorId}`, {
      method: 'DELETE'
    });
    await fetchConceptGraph(conceptId);
  }

  async function findCandidates(
    workspaceId: string,
    statement: string,
    conditions?: string,
    threshold?: number
  ) {
    loadingCandidates.value = true;
    candidatesResponse.value = null;
    try {
      const res = await requestJson<CandidateSearchResponse>(`/api/workspaces/${workspaceId}/claims/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statement, conditions, threshold })
      });
      candidatesResponse.value = res;
      return res;
    } finally {
      loadingCandidates.value = false;
    }
  }

  return {
    activeGraph,
    sources,
    candidatesResponse,
    loadingGraph,
    loadingCandidates,
    error,
    fetchConceptGraph,
    fetchSources,
    createSource,
    createAnchor,
    createClaim,
    reviewClaim,
    linkEvidence,
    unlinkEvidence,
    findCandidates
  };
});
