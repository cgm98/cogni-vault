import { Request, Response, NextFunction } from 'express';

export interface UserPayload {
  userId: string;
  email?: string;
  isService?: boolean;
}

export interface AuthRequest extends Request {
  user?: UserPayload;
}

export const authMiddleware = (req: AuthRequest, _res: Response, next: NextFunction) => {
  // En desarrollo local asigna usuario dev existente por defecto si no viene en cabeceras
  const userId = (req.headers['x-user-id'] as string) || 'f88f364a-5c10-4818-8810-9cd1d3fe0eca';
  req.user = {
    userId,
    email: 'christianmatamoros98@gmail.com'
  };
  next();
};
