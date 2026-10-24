export type ClaimStatus = 'PROPOSED' | 'VERIFIED' | 'CONTRADICTED' | 'DEPRECATED';
export type ProvenanceType = 'HUMAN' | 'MODEL_INFERENCE';
export type SupportType = 'SUPPORTS' | 'REFUTES' | 'INCONCLUSIVE';
export type EpistemicRelationType = 'CAUSES' | 'PREREQUISITE' | 'EXTENDS' | 'ANALOGOUS' | 'CONTRADICTS';
export type ReviewStatus = 'PENDING_REVIEW' | 'ACCEPTED' | 'REJECTED';
export type LocatorType = 'TEXT_OFFSET' | 'DOM_SELECTOR' | 'PDF_PAGE_BBOX' | 'BLOCK_ID';

export interface Source {
  id: string;
  workspace_id: string;
  title: string;
  uri: string | null;
  content_hash: string;
  mime_type: string;
  metadata: string | null;
  created_at: string;
}

export interface EvidenceAnchor {
  id: string;
  source_id: string;
  locator_type: LocatorType;
  locator_payload: string; // JSON string
  exact_quote: string;
  context_before: string | null;
  context_after: string | null;
  created_at: string;
}

export interface Claim {
  id: string;
  concept_id: string;
  statement: string;
  conditions: string | null;
  status: ClaimStatus;
  provenance: ProvenanceType;
  model_version: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ClaimEvidence {
  claim_id: string;
  anchor_id: string;
  support_type: SupportType;
  notes: string | null;
  created_at: string;
}

export interface EpistemicRelation {
  id: string;
  source_claim_id: string;
  target_claim_id: string;
  relation_type: EpistemicRelationType;
  confidence: number;
  status: ReviewStatus;
  provenance: ProvenanceType;
  created_at: string;
}

export interface CreateSourceDto {
  workspace_id: string;
  title: string;
  uri?: string | null;
  content_hash?: string;
  raw_content?: string; // Para calcular hash SHA-256 automáticamente si no se provee
  mime_type?: string;
  metadata?: Record<string, any> | string | null;
}

export interface CreateAnchorDto {
  source_id: string;
  locator_type: LocatorType;
  locator_payload: Record<string, any> | string;
  exact_quote: string;
  context_before?: string | null;
  context_after?: string | null;
}

export interface CreateClaimDto {
  concept_id: string;
  statement: string;
  conditions?: string | null;
  provenance?: ProvenanceType;
  model_version?: string | null;
}

export interface LinkEvidenceDto {
  claim_id: string;
  anchor_id: string;
  support_type: SupportType;
  notes?: string | null;
}

export interface ReviewClaimDto {
  status: ClaimStatus;
  reviewed_by: string;
}

export interface CreateEpistemicRelationDto {
  source_claim_id: string;
  target_claim_id: string;
  relation_type: EpistemicRelationType;
  confidence?: number;
  provenance?: ProvenanceType;
}
