import { Request, Response, NextFunction } from 'express';
import { DomainError } from '../../../domain/errors.js';

export const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<any> | any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof DomainError) {
    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message
    });
  }

  console.error('[Unhandled Internal Error]', err);
  return res.status(500).json({
    error: 'InternalServerError',
    message: err.message || 'Error interno del servidor'
  });
};
