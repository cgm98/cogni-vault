import crypto from 'crypto';
import { sqlite } from '../../src/db.js';
import { IEpistemicRepository } from '../../domain/interfaces/epistemic.repository.interface.js';
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
} from '../../domain/entities/epistemic.entity.js';
import { NotFoundError, ValidationError, ConflictError } from '../../domain/errors.js';

export class EpistemicRepository implements IEpistemicRepository {
  // --- Fuentes ---
  createSource(data: CreateSourceDto): Source {
    let hash = data.content_hash;
    if (!hash) {
      if (data.raw_content !== undefined) {
        hash = crypto.createHash('sha256').update(data.raw_content).digest('hex');
      } else {
        throw new ValidationError('Se requiere content_hash o raw_content para registrar una fuente inmutable');
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const metadataStr = typeof data.metadata === 'object' && data.metadata !== null 
      ? JSON.stringify(data.metadata) 
      : (data.metadata || null);

    sqlite.prepare(`
      INSERT INTO sources (id, workspace_id, title, uri, content_hash, mime_type, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.workspace_id,
      data.title.trim(),
      data.uri ?? null,
      hash,
      data.mime_type || 'text/plain',
      metadataStr,
      now
    );

    return this.findSourceById(id, data.workspace_id)!;
  }

  findSourceById(id: string, workspaceId?: string): Source | undefined {
    if (workspaceId) {
      return sqlite.prepare(`
        SELECT * FROM sources WHERE id = ? AND workspace_id = ?
      `).get(id, workspaceId) as Source | undefined;
    }
    return sqlite.prepare(`
      SELECT * FROM sources WHERE id = ?
    `).get(id) as Source | undefined;
  }

  findSourceByHash(workspaceId: string, contentHash: string): Source | undefined {
    return sqlite.prepare(`
      SELECT * FROM sources WHERE workspace_id = ? AND content_hash = ?
    `).get(workspaceId, contentHash) as Source | undefined;
  }

  listSourcesByWorkspace(workspaceId: string): Source[] {
    return sqlite.prepare(`
      SELECT * FROM sources WHERE workspace_id = ? ORDER BY created_at DESC
    `).all(workspaceId) as Source[];
  }

  // --- Anclas de Evidencia ---
  createAnchor(data: CreateAnchorDto): EvidenceAnchor {
    const source = this.findSourceById(data.source_id);
    if (!source) throw new NotFoundError('Fuente no encontrada');

    if (!data.exact_quote || data.exact_quote.trim().length === 0) {
      throw new ValidationError('El ancla de evidencia requiere una cita textual exacta (exact_quote)');
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const payloadStr = typeof data.locator_payload === 'object' 
      ? JSON.stringify(data.locator_payload) 
      : String(data.locator_payload);

    sqlite.prepare(`
      INSERT INTO evidence_anchors (id, source_id, locator_type, locator_payload, exact_quote, context_before, context_after, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.source_id,
      data.locator_type,
      payloadStr,
      data.exact_quote.trim(),
      data.context_before ?? null,
      data.context_after ?? null,
      now
    );

    return this.findAnchorById(id)!;
  }

  findAnchorById(id: string): EvidenceAnchor | undefined {
    return sqlite.prepare(`
      SELECT * FROM evidence_anchors WHERE id = ?
    `).get(id) as EvidenceAnchor | undefined;
  }

  listAnchorsBySource(sourceId: string): EvidenceAnchor[] {
    return sqlite.prepare(`
      SELECT * FROM evidence_anchors WHERE source_id = ? ORDER BY created_at ASC
    `).all(sourceId) as EvidenceAnchor[];
  }

  // --- Afirmaciones (Claims) ---
  createClaim(data: CreateClaimDto): Claim {
    const concept = sqlite.prepare(`
      SELECT id FROM concepts WHERE id = ? AND deleted_at IS NULL
    `).get(data.concept_id);
    if (!concept) throw new NotFoundError('Nota conceptual no encontrada');

    if (!data.statement || data.statement.trim().length === 0) {
      throw new ValidationError('El enunciado de la afirmación (statement) no puede estar vacío');
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    sqlite.prepare(`
      INSERT INTO claims (id, concept_id, statement, conditions, status, provenance, model_version, created_at)
      VALUES (?, ?, ?, ?, 'PROPOSED', ?, ?, ?)
    `).run(
      id,
      data.concept_id,
      data.statement.trim(),
      data.conditions ?? null,
      data.provenance || 'HUMAN',
      data.model_version ?? null,
      now
    );

    return this.findClaimById(id)!;
  }

  findClaimById(id: string): Claim | undefined {
    return sqlite.prepare(`
      SELECT * FROM claims WHERE id = ?
    `).get(id) as Claim | undefined;
  }

  listClaimsByConcept(conceptId: string): Claim[] {
    return sqlite.prepare(`
      SELECT * FROM claims WHERE concept_id = ? ORDER BY created_at ASC
    `).all(conceptId) as Claim[];
  }

  updateClaimStatus(id: string, data: ReviewClaimDto): Claim {
    const claim = this.findClaimById(id);
    if (!claim) throw new NotFoundError('Afirmación no encontrada');

    const now = new Date().toISOString();
    sqlite.prepare(`
      UPDATE claims
      SET status = ?, reviewed_by = ?, reviewed_at = ?
      WHERE id = ?
    `).run(data.status, data.reviewed_by, now, id);

    return this.findClaimById(id)!;
  }

  // --- Vinculación Evidencia <-> Afirmación ---
  linkEvidence(data: LinkEvidenceDto): void {
    const claim = this.findClaimById(data.claim_id);
    if (!claim) throw new NotFoundError('Afirmación no encontrada');

    const anchor = this.findAnchorById(data.anchor_id);
    if (!anchor) throw new NotFoundError('Ancla de evidencia no encontrada');

    const now = new Date().toISOString();
    sqlite.prepare(`
      INSERT INTO claim_evidence (claim_id, anchor_id, support_type, notes, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(claim_id, anchor_id) DO UPDATE SET
        support_type = excluded.support_type,
        notes = excluded.notes
    `).run(
      data.claim_id,
      data.anchor_id,
      data.support_type,
      data.notes ?? null,
      now
    );
  }

  unlinkEvidence(claimId: string, anchorId: string): void {
    sqlite.prepare(`
      DELETE FROM claim_evidence WHERE claim_id = ? AND anchor_id = ?
    `).run(claimId, anchorId);
  }

  listEvidenceForClaim(claimId: string): (ClaimEvidence & { anchor: EvidenceAnchor; source: Source })[] {
    const rows = sqlite.prepare(`
      SELECT 
        ce.claim_id, ce.anchor_id, ce.support_type, ce.notes, ce.created_at,
        ea.source_id as ea_source_id, ea.locator_type as ea_locator_type, ea.locator_payload as ea_locator_payload,
        ea.exact_quote as ea_exact_quote, ea.context_before as ea_context_before, ea.context_after as ea_context_after,
        ea.created_at as ea_created_at,
        s.workspace_id as s_workspace_id, s.title as s_title, s.uri as s_uri, s.content_hash as s_content_hash,
        s.mime_type as s_mime_type, s.metadata as s_metadata, s.created_at as s_created_at
      FROM claim_evidence ce
      JOIN evidence_anchors ea ON ce.anchor_id = ea.id
      JOIN sources s ON ea.source_id = s.id
      WHERE ce.claim_id = ?
      ORDER BY ce.created_at ASC
    `).all(claimId) as any[];

    return rows.map(r => ({
      claim_id: r.claim_id,
      anchor_id: r.anchor_id,
      support_type: r.support_type,
      notes: r.notes,
      created_at: r.created_at,
      anchor: {
        id: r.anchor_id,
        source_id: r.ea_source_id,
        locator_type: r.ea_locator_type,
        locator_payload: r.ea_locator_payload,
        exact_quote: r.ea_exact_quote,
        context_before: r.ea_context_before,
        context_after: r.ea_context_after,
        created_at: r.ea_created_at
      },
      source: {
        id: r.ea_source_id,
        workspace_id: r.s_workspace_id,
        title: r.s_title,
        uri: r.s_uri,
        content_hash: r.s_content_hash,
        mime_type: r.s_mime_type,
        metadata: r.s_metadata,
        created_at: r.s_created_at
      }
    }));
  }

  // --- Relaciones Epistémicas ---
  createRelation(data: CreateEpistemicRelationDto): EpistemicRelation {
    if (data.source_claim_id === data.target_claim_id) {
      throw new ValidationError('Una afirmación no puede relacionarse consigo misma');
    }

    const sourceClaim = this.findClaimById(data.source_claim_id);
    if (!sourceClaim) throw new NotFoundError('Afirmación origen no encontrada');

    const targetClaim = this.findClaimById(data.target_claim_id);
    if (!targetClaim) throw new NotFoundError('Afirmación destino no encontrada');

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    sqlite.prepare(`
      INSERT INTO epistemic_relations (id, source_claim_id, target_claim_id, relation_type, confidence, status, provenance, created_at)
      VALUES (?, ?, ?, ?, ?, 'PENDING_REVIEW', ?, ?)
    `).run(
      id,
      data.source_claim_id,
      data.target_claim_id,
      data.relation_type,
      data.confidence ?? 1.0,
      data.provenance || 'HUMAN',
      now
    );

    return sqlite.prepare(`SELECT * FROM epistemic_relations WHERE id = ?`).get(id) as EpistemicRelation;
  }

  listRelationsForClaim(claimId: string): EpistemicRelation[] {
    return sqlite.prepare(`
      SELECT * FROM epistemic_relations
      WHERE source_claim_id = ? OR target_claim_id = ?
      ORDER BY created_at ASC
    `).all(claimId, claimId) as EpistemicRelation[];
  }

  updateRelationStatus(id: string, status: 'ACCEPTED' | 'REJECTED'): void {
    const res = sqlite.prepare(`
      UPDATE epistemic_relations SET status = ? WHERE id = ?
    `).run(status, id);
    if (res.changes === 0) throw new NotFoundError('Relación epistémica no encontrada');
  }

  // --- Grafo Epistémico ---
  getConceptEpistemicGraph(conceptId: string) {
    const claimList = this.listClaimsByConcept(conceptId);
    if (claimList.length === 0) {
      return { claims: [], evidence: [], relations: [] };
    }

    const claimIds = claimList.map(c => c.id);
    const placeholders = claimIds.map(() => '?').join(',');

    // Evidencia vinculada
    const evidenceList: any[] = [];
    for (const claim of claimList) {
      const ev = this.listEvidenceForClaim(claim.id);
      evidenceList.push(...ev);
    }

    // Relaciones entre afirmaciones de este concepto
    const relations = sqlite.prepare(`
      SELECT * FROM epistemic_relations
      WHERE source_claim_id IN (${placeholders}) OR target_claim_id IN (${placeholders})
    `).all(...claimIds, ...claimIds) as EpistemicRelation[];

    return {
      claims: claimList,
      evidence: evidenceList,
      relations
    };
  }
}
