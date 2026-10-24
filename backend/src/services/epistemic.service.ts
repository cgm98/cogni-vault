import { IEpistemicRepository } from '../../domain/interfaces/epistemic.repository.interface.js';
import { IOutboxRepository } from '../../domain/interfaces/outbox.repository.interface.js';
import {
  Source,
  EvidenceAnchor,
  Claim,
  EpistemicRelation,
  ClaimStatus,
  CreateSourceDto,
  CreateAnchorDto,
  CreateClaimDto,
  LinkEvidenceDto,
  CreateEpistemicRelationDto
} from '../../domain/entities/epistemic.entity.js';
import { ValidationError, NotFoundError } from '../../domain/errors.js';

export class EpistemicService {
  constructor(
    private readonly epistemicRepository: IEpistemicRepository,
    private readonly outboxRepository: IOutboxRepository
  ) {}

  // --- Fuentes y Evidencia ---
  createSource(data: CreateSourceDto): Source {
    if (!data.title || data.title.trim().length === 0) {
      throw new ValidationError('El título de la fuente es requerido');
    }

    const source = this.epistemicRepository.createSource(data);

    this.outboxRepository.enqueue({
      job_type: 'INDEX_FTS',
      entity_type: 'source',
      entity_id: source.id,
      entity_version: 1,
      payload: JSON.stringify({ hash: source.content_hash, title: source.title })
    });

    return source;
  }

  createAnchor(data: CreateAnchorDto): EvidenceAnchor {
    return this.epistemicRepository.createAnchor(data);
  }

  listSources(workspaceId: string): Source[] {
    return this.epistemicRepository.listSourcesByWorkspace(workspaceId);
  }

  listAnchors(sourceId: string): EvidenceAnchor[] {
    return this.epistemicRepository.listAnchorsBySource(sourceId);
  }

  // --- Afirmaciones Epistémicas ---
  createClaim(data: CreateClaimDto): Claim {
    const claim = this.epistemicRepository.createClaim(data);

    this.outboxRepository.enqueue({
      job_type: 'INDEX_FTS',
      entity_type: 'claim',
      entity_id: claim.id,
      entity_version: 1,
      payload: JSON.stringify({ concept_id: claim.concept_id, statement: claim.statement })
    });

    return claim;
  }

  linkEvidence(data: LinkEvidenceDto): void {
    this.epistemicRepository.linkEvidence(data);

    // Invariante Epistémica: Si se vincula evidencia contradictoria (REFUTES) a una afirmación verificada,
    // se transiciona automáticamente su estado a CONTRADICTED
    if (data.support_type === 'REFUTES') {
      const claim = this.epistemicRepository.findClaimById(data.claim_id);
      if (claim && claim.status === 'VERIFIED') {
        this.epistemicRepository.updateClaimStatus(claim.id, {
          status: 'CONTRADICTED',
          reviewed_by: 'system:evidence_conflict_detector'
        });
      }
    }

    this.outboxRepository.enqueue({
      job_type: 'INDEX_FTS',
      entity_type: 'claim',
      entity_id: data.claim_id,
      entity_version: 1,
      payload: JSON.stringify({ action: 'link_evidence', support_type: data.support_type })
    });
  }

  unlinkEvidence(claimId: string, anchorId: string): void {
    this.epistemicRepository.unlinkEvidence(claimId, anchorId);
  }

  reviewClaim(claimId: string, targetStatus: ClaimStatus, userId: string): Claim {
    const claim = this.epistemicRepository.findClaimById(claimId);
    if (!claim) throw new NotFoundError('Afirmación no encontrada');

    // Invariante: Para verificar una afirmación, DEBE existir al menos una evidencia 'SUPPORTS'
    if (targetStatus === 'VERIFIED') {
      const evidenceList = this.epistemicRepository.listEvidenceForClaim(claimId);
      const hasSupport = evidenceList.some(e => e.support_type === 'SUPPORTS');
      if (!hasSupport) {
        throw new ValidationError('No se puede verificar una afirmación sin al menos un anclaje de evidencia que la respalde (SUPPORTS)');
      }

      const hasRefutation = evidenceList.some(e => e.support_type === 'REFUTES');
      if (hasRefutation) {
        throw new ValidationError('La afirmación tiene evidencia contradictoria vinculada (REFUTES); resuelva el conflicto antes de verificar');
      }
    }

    const updated = this.epistemicRepository.updateClaimStatus(claimId, {
      status: targetStatus,
      reviewed_by: userId
    });

    this.outboxRepository.enqueue({
      job_type: 'INDEX_FTS',
      entity_type: 'claim',
      entity_id: claimId,
      entity_version: 1,
      payload: JSON.stringify({ action: 'review', status: targetStatus, reviewed_by: userId })
    });

    return updated;
  }

  listClaimsByConcept(conceptId: string): Claim[] {
    return this.epistemicRepository.listClaimsByConcept(conceptId);
  }

  listEvidenceForClaim(claimId: string) {
    return this.epistemicRepository.listEvidenceForClaim(claimId);
  }

  // --- Relaciones Epistémicas ---
  createRelation(data: CreateEpistemicRelationDto): EpistemicRelation {
    const relation = this.epistemicRepository.createRelation(data);

    this.outboxRepository.enqueue({
      job_type: 'INDEX_FTS',
      entity_type: 'epistemic_relation',
      entity_id: relation.id,
      entity_version: 1,
      payload: JSON.stringify({ type: relation.relation_type })
    });

    return relation;
  }

  updateRelationStatus(relationId: string, status: 'ACCEPTED' | 'REJECTED'): void {
    this.epistemicRepository.updateRelationStatus(relationId, status);
  }

  // --- Grafo Epistémico ---
  getConceptEpistemicGraph(conceptId: string) {
    return this.epistemicRepository.getConceptEpistemicGraph(conceptId);
  }
}
