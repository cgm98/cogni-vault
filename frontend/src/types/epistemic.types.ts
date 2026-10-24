export interface Source {
  id: string;
  workspace_id: string;
  title: string;
  uri?: string | null;
  content_hash: string;
  mime_type: string;
  metadata?: any;
  created_at: string;
}

export type LocatorType = 'TEXT_OFFSET' | 'DOM_SELECTOR' | 'PDF_PAGE_BBOX' | 'BLOCK_ID';

export interface EvidenceAnchor {
  id: string;
  source_id: string;
  locator_type: LocatorType;
  locator_payload: any;
  exact_quote: string;
  context_before?: string | null;
  context_after?: string | null;
  created_at: string;
}

export type ClaimStatus = 'PROPOSED' | 'VERIFIED' | 'CONTRADICTED' | 'DEPRECATED';
export type EpistemicProvenance = 'HUMAN' | 'MODEL_INFERENCE';

export interface Claim {
  id: string;
  concept_id: string;
  statement: string;
  conditions?: string | null;
  status: ClaimStatus;
  provenance: EpistemicProvenance;
  model_version?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export type SupportType = 'SUPPORTS' | 'REFUTES' | 'INCONCLUSIVE';

export interface ClaimEvidenceLink {
  claim_id: string;
  anchor_id: string;
  support_type: SupportType;
  notes?: string | null;
  created_at: string;
}

export type EpistemicRelationType = 'CAUSES' | 'PREREQUISITE' | 'EXTENDS' | 'ANALOGOUS' | 'CONTRADICTS';
export type RelationReviewStatus = 'PENDING_REVIEW' | 'ACCEPTED' | 'REJECTED';

export interface EpistemicRelation {
  id: string;
  source_claim_id: string;
  target_claim_id: string;
  relation_type: EpistemicRelationType;
  confidence: number;
  status: RelationReviewStatus;
  provenance: EpistemicProvenance;
  created_at: string;
}

export interface EpistemicGraphEvidenceItem {
  claim_id: string;
  anchor: EvidenceAnchor;
  source: Source;
  support_type: SupportType;
  notes?: string | null;
}

export interface ConceptEpistemicGraph {
  concept_id: string;
  claims: Claim[];
  evidence: EpistemicGraphEvidenceItem[];
  relations: EpistemicRelation[];
}
