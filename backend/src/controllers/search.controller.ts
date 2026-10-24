import { Response } from 'express';
import {
  hybridSearchService,
  evidenceCandidateService,
  searchIndexerService
} from '../di/container.js';
import { asyncHandler } from '../http/middlewares/error-handler.js';
import { AuthRequest } from '../http/middlewares/auth.middleware.js';
import { ValidationError } from '../../domain/errors.js';
import { SearchEntityType } from '../../domain/entities/search.entity.js';

export class SearchController {
  // --- Búsqueda Híbrida (FTS5 BM25 + sqlite-vec KNN) ---
  static search = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { workspaceId } = req.params;
    if (!workspaceId) throw new ValidationError('workspaceId es requerido');

    const q = req.query.q as string;
    if (!q) throw new ValidationError('Parámetro de búsqueda "q" es requerido');

    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const alpha = req.query.alpha ? parseFloat(req.query.alpha as string) : 0.5;

    let entityTypes: SearchEntityType[] | undefined;
    if (req.query.types) {
      entityTypes = (req.query.types as string).split(',') as SearchEntityType[];
    }

    const results = await hybridSearchService.search(q, workspaceId, {
      limit,
      alpha,
      entityTypes
    });

    res.json(results);
  });

  // --- Sugerencia de Evidencias Candidatas y Detección de Contradicciones ---
  static findCandidates = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { workspaceId } = req.params;
    if (!workspaceId) throw new ValidationError('workspaceId es requerido');

    const { statement, conditions, threshold, limit } = req.body;
    if (!statement || typeof statement !== 'string') {
      throw new ValidationError('statement es requerido para buscar evidencia candidata');
    }

    const response = await evidenceCandidateService.findCandidates(
      workspaceId,
      statement,
      conditions,
      {
        threshold: threshold ? parseFloat(threshold) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined
      }
    );

    res.json(response);
  });

  // --- Indexación / Sincronización Manual de Entidades ---
  static indexEntity = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { entityType, entityId } = req.params;
    if (!entityType || !entityId) {
      throw new ValidationError('entityType y entityId son requeridos');
    }

    const indexed = await searchIndexerService.indexEntity(
      entityType as SearchEntityType,
      entityId
    );

    res.json({ success: indexed, entityId, entityType });
  });
}
