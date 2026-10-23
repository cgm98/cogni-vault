import { Response } from 'express';
import { analyticsService } from '../di/container.js';
import { asyncHandler } from '../http/middlewares/error-handler.js';
import { AuthRequest } from '../http/middlewares/auth.middleware.js';

export class AnalyticsController {
  static getStats = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(analyticsService.getStats(req.user!.userId));
  });

  static getGaps = asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(analyticsService.getGaps(req.user!.userId));
  });

  static getEvents = asyncHandler(async (req: AuthRequest, res: Response) => {
    const limit = req.query.limit ? Number(req.query.limit) : 15;
    res.json(analyticsService.getEvents(limit));
  });
}
