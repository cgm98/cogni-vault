export type SearchEntityType = 'concept' | 'source' | 'anchor' | 'claim';

export interface SearchResultItem {
  entity_id: string;
  entity_type: SearchEntityType;
  workspace_id: string;
  title: string;
  snippet: string;
  lexical_rank?: number;
  vector_distance?: number;
  hybrid_score: number;
}

export interface HybridSearchResponse {
  query: string;
  workspace_id: string;
  total_results: number;
  items: SearchResultItem[];
}

export type CandidateOrientation = 'SUPPORTS' | 'REFUTES' | 'INCONCLUSIVE';

export interface EvidenceCandidate {
  anchor_id: string;
  source_id: string;
  source_title: string;
  exact_quote: string;
  confidence_score: number;
  potential_relation: CandidateOrientation;
  candidate_only: true;
}

export interface CandidateSearchResponse {
  status: 'CANDIDATES_FOUND' | 'ABSTAIN';
  reason?: 'INSUFFICIENT_EVIDENCE' | 'NO_MATCH';
  threshold_applied: number;
  statement: string;
  candidates: EvidenceCandidate[];
}
