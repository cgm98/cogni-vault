import {
  Source,
  EvidenceAnchor,
  Claim,
  ClaimEvidence,
  EpistemicRelation,
  CreateSourceDto,
  CreateAnchorDto,
  CreateClaimDto,
  LinkEvidenceDto,
  ReviewClaimDto,
  CreateEpistemicRelationDto
} from '../entities/epistemic.entity.js';

export interface IEpistemicRepository {
  // Fuentes
  createSource(data: CreateSourceDto): Source;
  findSourceById(id: string, workspaceId?: string): Source | undefined;
  findSourceByHash(workspaceId: string, contentHash: string): Source | undefined;
  listSourcesByWorkspace(workspaceId: string): Source[];

  // Anclas de evidencia
  createAnchor(data: CreateAnchorDto): EvidenceAnchor;
  findAnchorById(id: string): EvidenceAnchor | undefined;
  listAnchorsBySource(sourceId: string): EvidenceAnchor[];

  // Afirmaciones
  createClaim(data: CreateClaimDto): Claim;
  findClaimById(id: string): Claim | undefined;
  listClaimsByConcept(conceptId: string): Claim[];
  updateClaimStatus(id: string, data: ReviewClaimDto): Claim;

  // Vinculación Evidencia <-> Afirmación
  linkEvidence(data: LinkEvidenceDto): void;
  unlinkEvidence(claimId: string, anchorId: string): void;
  listEvidenceForClaim(claimId: string): (ClaimEvidence & { anchor: EvidenceAnchor; source: Source })[];

  // Relaciones epistémicas entre afirmaciones
  createRelation(data: CreateEpistemicRelationDto): EpistemicRelation;
  listRelationsForClaim(claimId: string): EpistemicRelation[];
  updateRelationStatus(id: string, status: 'ACCEPTED' | 'REJECTED'): void;

  // Grafo epistémico completo para un concepto
  getConceptEpistemicGraph(conceptId: string): {
    claims: Claim[];
    evidence: { claim_id: string; support_type: string; anchor: EvidenceAnchor; source: Source }[];
    relations: EpistemicRelation[];
  };
}
