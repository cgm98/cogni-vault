import { Response } from 'express';
import { topicService } from '../di/container.js';
import { asyncHandler } from '../http/middlewares/error-handler.js';
import { NotFoundError } from '../../domain/errors.js';
import { AuthRequest } from '../http/middlewares/auth.middleware.js';

export class TopicController {
  static getAll = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(topicService.getAll(req.user!.userId));
  });

  static getById = asyncHandler(async (req: AuthRequest, res: Response) => {
    const item = topicService.getById(req.params.id, req.user!.userId);
    if (!item) {
      throw new NotFoundError('Tema no encontrado');
    }
    res.json(item);
  });

  static create = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.status(201).json(topicService.create(req.body, req.user!.userId));
  });

  static update = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(topicService.update(req.params.id, req.body, req.user!.userId));
  });

  static delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    topicService.delete(req.params.id, req.user!.userId);
    res.json({ success: true });
  });
}
