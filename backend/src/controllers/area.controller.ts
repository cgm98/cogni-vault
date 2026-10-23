import { Response } from 'express';
import { areaService } from '../di/container.js';
import { asyncHandler } from '../http/middlewares/error-handler.js';
import { NotFoundError } from '../../domain/errors.js';
import { AuthRequest } from '../http/middlewares/auth.middleware.js';

export class AreaController {
  static getAll = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { cerebroId } = req.query;
    if (cerebroId && typeof cerebroId === 'string') {
      return res.json(areaService.getByCerebro(cerebroId, req.user!.userId));
    }
    res.json(areaService.getAll(req.user!.userId));
  });


  static getById = asyncHandler(async (req: AuthRequest, res: Response) => {
    const item = areaService.getById(req.params.id, req.user!.userId);
    if (!item) {
      throw new NotFoundError('Área no encontrada');
    }
    res.json(item);
  });

  static create = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json(areaService.create(req.body, req.user!.userId));
  });

  static update = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(areaService.update(req.params.id, req.body, req.user!.userId));
  });

  static delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    areaService.delete(req.params.id, req.user!.userId);
    res.json({ success: true });
  });
}
