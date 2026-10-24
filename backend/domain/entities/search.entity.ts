export type SearchEntityType = 'concept' | 'source' | 'anchor' | 'claim';

export interface FtsIndexEntry {
  entity_id: string;
  entity_type: SearchEntityType;
  workspace_id: string;
  title: string;
  content: string;
}

export interface VectorIndexEntry {
  entity_id: string;
  embedding: Float32Array;
}

export interface IndexMetadataEntry {
  entity_id: string;
  entity_type: SearchEntityType;
  workspace_id: string;
  version: number;
  fts_indexed_at?: string;
  vec_indexed_at?: string;
  content_hash?: string;
}

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

export interface SearchOptions {
  limit?: number;
  alpha?: number; // Peso para balancear léxico vs vectorial: [0.0 = solo vector, 1.0 = solo léxico], default 0.5
  entityTypes?: SearchEntityType[];
}

export interface HybridSearchResponse {
  query: string;
  workspace_id: string;
  total_results: number;
  items: SearchResultItem[];
}

export type EvidenceOrientation = 'SUPPORTS' | 'REFUTES' | 'INCONCLUSIVE';

export interface EvidenceCandidate {
  anchor_id: string;
  source_id: string;
  source_title: string;
  exact_quote: string;
  confidence_score: number;
  potential_relation: EvidenceOrientation;
  candidate_only: true;
}

export interface CandidateSearchOptions {
  limit?: number;
  threshold?: number; // Invariante de abstención: theta_min (default 0.35)
}

export interface CandidateSearchResponse {
  status: 'CANDIDATES_FOUND' | 'ABSTAIN';
  reason?: 'INSUFFICIENT_EVIDENCE' | 'NO_MATCH';
  threshold_applied: number;
  statement: string;
  candidates: EvidenceCandidate[];
}
