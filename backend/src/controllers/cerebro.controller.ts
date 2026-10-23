import { Response } from 'express';
import { cerebroService, conceptService } from '../di/container.js';
import { asyncHandler } from '../http/middlewares/error-handler.js';
import { NotFoundError, ValidationError } from '../../domain/errors.js';

import { AuthRequest } from '../http/middlewares/auth.middleware.js';
import { TemporalFacet } from '../../domain/entities/concept.entity.js';

export class CerebroController {
  static getAll = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(cerebroService.getAll(req.user!.userId));
  });

  static getById = asyncHandler(async (req: AuthRequest, res: Response) => {
    const item = cerebroService.getById(req.params.id, req.user!.userId);
    if (!item) {
      throw new NotFoundError('Cerebro no encontrado');
    }
    res.json(item);
  });

  static getBySlug = asyncHandler(async (req: AuthRequest, res: Response) => {
    const item = cerebroService.getBySlug(req.params.slug, req.user!.userId);
    if (!item) {
      throw new NotFoundError('Cerebro no encontrado');
    }
    res.json(item);
  });

  static getKnowledgeTree = asyncHandler(async (req: AuthRequest, res: Response) => {
    const tree = cerebroService.getKnowledgeTree(req.params.id, req.user!.userId);
    if (!tree) {
      throw new NotFoundError('Cerebro no encontrado');
    }
    res.json(tree);
  });

  static listConceptsByFacet = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id, facet } = req.params;
    const validFacets: TemporalFacet[] = ['PAST_MEMORY', 'PRESENT_DISCERNMENT', 'FUTURE_PROVIDENCE'];
    if (!validFacets.includes(facet as TemporalFacet)) {
      throw new ValidationError(`Faceta inválida: ${facet}. Valores permitidos: ${validFacets.join(', ')}`);
    }


    const concepts = conceptService.listByFacet(id, facet as TemporalFacet, req.user!.userId);
    res.json(concepts);
  });

  static create = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json(cerebroService.create(req.body, req.user!.userId));
  });

  static update = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(cerebroService.update(req.params.id, req.body, req.user!.userId));
  });

  static delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    cerebroService.delete(req.params.id, req.user!.userId);
    res.json({ success: true });
  });
}
