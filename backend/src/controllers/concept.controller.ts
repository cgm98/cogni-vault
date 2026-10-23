import { Response } from 'express';
import { conceptService, captureService, linkerService, noteDraftService } from '../di/container.js';
import { asyncHandler } from '../http/middlewares/error-handler.js';
import { NotFoundError } from '../../domain/errors.js';
import { AuthRequest } from '../http/middlewares/auth.middleware.js';

export class ConceptController {
  static getAll = asyncHandler(async (req: AuthRequest, res: Response) => {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;
    res.json(conceptService.getAll(req.user!.userId, limit, offset));
  });

  // Listado liviano (sin explanation/intuition) para árboles/selectores que
  // solo necesitan nombres — ver docs/2026-07-31-propuestas-tecnicas.md, propuesta 2.
  static getSummaries = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(conceptService.getSummaries(req.user!.userId));
  });

  static getById = asyncHandler(async (req: AuthRequest, res: Response) => {
    const item = conceptService.getById(req.params.id, req.user!.userId);
    if (!item) {
      throw new NotFoundError('Concepto no encontrado');
    }
    res.json(item);
  });

  static create = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json(conceptService.create(req.body, req.user!.userId, req.user!.isService ? 'agent' : 'human'));
  });

  static update = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(conceptService.update(req.params.id, req.body, req.user!.userId));
  });

  static delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    conceptService.delete(req.params.id, req.user!.userId);
    res.json({ success: true });
  });

  static getTrashed = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(conceptService.getTrashed(req.user!.userId));
  });

  static restore = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(conceptService.restore(req.params.id, req.user!.userId));
  });

  static purge = asyncHandler(async (req: AuthRequest, res: Response) => {
    conceptService.purge(req.params.id, req.user!.userId);
    res.json({ success: true });
  });

  static capture = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(await captureService.process(req.body, req.user!.userId));
  });

  // Solo redacta el draft (título + explicación) vía el modelo de chat local — no crea
  // el concepto. El guardado real pasa por POST /concepts de siempre, después de que el
  // usuario revisa/edita: un modelo de 2B puede alucinar, y esto es un vault de
  // conocimiento, no un lugar para escribir sin mirar.
  static generateDraft = asyncHandler(async (req: AuthRequest, res: Response) => {
    const source = typeof req.body?.source === 'string' ? req.body.source.trim() : '';
    const hint = typeof req.body?.hint === 'string' ? req.body.hint : undefined;
    if (!source) {
      return res.status(400).json({ error: "Falta el parámetro 'source'." });
    }
    res.json(await noteDraftService.draft({ source, hint }));
  });

  static getSuggestions = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(await linkerService.getSuggestions(req.params.id, req.user!.userId));
  });

  static getVersions = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(conceptService.getVersions(req.params.id, req.user!.userId));
  });

  static getVersion = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(conceptService.getVersion(req.params.id, req.params.versionId, req.user!.userId));
  });

  static restoreVersion = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(conceptService.restoreVersion(req.params.id, req.params.versionId, req.user!.userId));
  });
}
