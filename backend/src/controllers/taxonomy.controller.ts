import { Response } from 'express';
import { taxonomyService, conceptDocumentService } from '../di/container.js';
import { asyncHandler } from '../http/middlewares/error-handler.js';
import { AuthRequest } from '../http/middlewares/auth.middleware.js';
import { ValidationError } from '../../domain/errors.js';

export class TaxonomyController {
  // --- Términos Taxonómicos ---
  static getTermTree = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { workspaceId } = req.params;
    if (!workspaceId) throw new ValidationError('workspaceId es requerido');
    res.json(taxonomyService.getTermTree(workspaceId));
  });

  static listTerms = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { workspaceId } = req.params;
    if (!workspaceId) throw new ValidationError('workspaceId es requerido');
    res.json(taxonomyService.listTerms(workspaceId));
  });

  static createTerm = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { workspaceId } = req.params;
    if (!workspaceId) throw new ValidationError('workspaceId es requerido');
    const { name, parent_id, color, description } = req.body;
    const term = taxonomyService.createTerm({
      workspace_id: workspaceId,
      name,
      parent_id,
      color,
      description
    });
    res.status(201).json(term);
  });

  static deleteTerm = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const workspaceId = (req.query.workspaceId as string) || req.body?.workspace_id;
    if (!workspaceId) throw new ValidationError('workspaceId es requerido');
    taxonomyService.deleteTerm(id, workspaceId);
    res.json({ success: true });
  });

  // --- Concept Taxonomy ---
  static getConceptClassification = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    res.json(taxonomyService.getConceptClassification(id));
  });

  static assignTerm = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { term_id, is_inherited, source_folder_id } = req.body;
    if (!term_id) throw new ValidationError('term_id es requerido');
    taxonomyService.assignTerm(id, term_id, Boolean(is_inherited), source_folder_id);
    res.status(201).json({ success: true });
  });

  static removeTerm = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id, termId } = req.params;
    taxonomyService.removeTerm(id, termId);
    res.json({ success: true });
  });

  // --- Tags ---
  static listTags = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { workspaceId } = req.params;
    if (!workspaceId) throw new ValidationError('workspaceId es requerido');
    res.json(taxonomyService.listTags(workspaceId));
  });

  static createTag = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { workspaceId } = req.params;
    if (!workspaceId) throw new ValidationError('workspaceId es requerido');
    const { name, color } = req.body;
    const tag = taxonomyService.createTag({ workspace_id: workspaceId, name, color });
    res.status(201).json(tag);
  });

  static deleteTag = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const workspaceId = (req.query.workspaceId as string) || req.body?.workspace_id;
    if (!workspaceId) throw new ValidationError('workspaceId es requerido');
    taxonomyService.deleteTag(id, workspaceId);
    res.json({ success: true });
  });

  static listTagsForConcept = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    res.json(taxonomyService.listTagsForConcept(id));
  });

  static attachTag = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { tag_id } = req.body;
    if (!tag_id) throw new ValidationError('tag_id es requerido');
    taxonomyService.attachTag(id, tag_id);
    res.status(201).json({ success: true });
  });

  static detachTag = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id, tagId } = req.params;
    taxonomyService.detachTag(id, tagId);
    res.json({ success: true });
  });

  // --- Document AST ---
  static getConceptAst = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    res.json(conceptDocumentService.getDocument(id));
  });

  static updateConceptAst = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { ast, expected_version } = req.body;
    if (expected_version === undefined || expected_version === null) {
      throw new ValidationError('expected_version es requerido');
    }
    const result = conceptDocumentService.updateDocument(id, ast, expected_version);
    res.json(result);
  });
}
