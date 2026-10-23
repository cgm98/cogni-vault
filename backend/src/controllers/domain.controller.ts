import { Response } from 'express';
import { domainService } from '../di/container.js';
import { asyncHandler } from '../http/middlewares/error-handler.js';
import { NotFoundError } from '../../domain/errors.js';
import { AuthRequest } from '../http/middlewares/auth.middleware.js';

export class DomainController {
  static getAll = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(domainService.getAll(req.user!.userId));
  });

  static getById = asyncHandler(async (req: AuthRequest, res: Response) => {
    const item = domainService.getById(req.params.id, req.user!.userId);
    if (!item) {
      throw new NotFoundError('Dominio no encontrado');
    }
    res.json(item);
  });

  static create = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json(domainService.create(req.body, req.user!.userId));
  });

  static update = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(domainService.update(req.params.id, req.body, req.user!.userId));
  });

  static delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    domainService.delete(req.params.id, req.user!.userId);
    res.json({ success: true });
  });
}
