import { Response } from 'express';
import { epistemicService } from '../di/container.js';
import { asyncHandler } from '../http/middlewares/error-handler.js';
import { AuthRequest } from '../http/middlewares/auth.middleware.js';
import { ValidationError } from '../../domain/errors.js';

export class EpistemicController {
  // --- Fuentes ---
  static listSources = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { workspaceId } = req.params;
    if (!workspaceId) throw new ValidationError('workspaceId es requerido');
    res.json(epistemicService.listSources(workspaceId));
  });

  static createSource = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { workspaceId } = req.params;
    if (!workspaceId) throw new ValidationError('workspaceId es requerido');
    const { title, uri, content_hash, raw_content, mime_type, metadata } = req.body;
    const source = epistemicService.createSource({
      workspace_id: workspaceId,
      title,
      uri,
      content_hash,
      raw_content,
      mime_type,
      metadata
    });
    res.status(201).json(source);
  });

  // --- Anclas de Evidencia ---
  static listAnchors = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { sourceId } = req.params;
    res.json(epistemicService.listAnchors(sourceId));
  });

  static createAnchor = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { sourceId } = req.params;
    const { locator_type, locator_payload, exact_quote, context_before, context_after } = req.body;
    const anchor = epistemicService.createAnchor({
      source_id: sourceId,
      locator_type,
      locator_payload,
      exact_quote,
      context_before,
      context_after
    });
    res.status(201).json(anchor);
  });

  // --- Afirmaciones (Claims) ---
  static listClaims = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    res.json(epistemicService.listClaimsByConcept(id));
  });

  static createClaim = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { statement, conditions, provenance, model_version } = req.body;
    const claim = epistemicService.createClaim({
      concept_id: id,
      statement,
      conditions,
      provenance,
      model_version
    });
    res.status(201).json(claim);
  });

  static reviewClaim = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) throw new ValidationError('status es requerido para revisar la afirmación');
    const userId = req.user?.userId || 'system:reviewer';
    const updated = epistemicService.reviewClaim(id, status, userId);
    res.json(updated);
  });

  // --- Vinculación Evidencia ---
  static listEvidenceForClaim = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    res.json(epistemicService.listEvidenceForClaim(id));
  });

  static linkEvidence = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { anchor_id, support_type, notes } = req.body;
    if (!anchor_id || !support_type) {
      throw new ValidationError('anchor_id y support_type (SUPPORTS | REFUTES | INCONCLUSIVE) son requeridos');
    }
    epistemicService.linkEvidence({
      claim_id: id,
      anchor_id,
      support_type,
      notes
    });
    res.status(201).json({ success: true });
  });

  static unlinkEvidence = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id, anchorId } = req.params;
    epistemicService.unlinkEvidence(id, anchorId);
    res.json({ success: true });
  });

  // --- Relaciones Epistémicas ---
  static createRelation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { source_claim_id, target_claim_id, relation_type, confidence, provenance } = req.body;
    if (!source_claim_id || !target_claim_id || !relation_type) {
      throw new ValidationError('source_claim_id, target_claim_id y relation_type son requeridos');
    }
    const rel = epistemicService.createRelation({
      source_claim_id,
      target_claim_id,
      relation_type,
      confidence,
      provenance
    });
    res.status(201).json(rel);
  });

  static updateRelationStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!status || !['ACCEPTED', 'REJECTED'].includes(status)) {
      throw new ValidationError('status debe ser ACCEPTED o REJECTED');
    }
    epistemicService.updateRelationStatus(id, status);
    res.json({ success: true });
  });

  // --- Grafo Epistémico Completo ---
  static getConceptGraph = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    res.json(epistemicService.getConceptEpistemicGraph(id));
  });
}
