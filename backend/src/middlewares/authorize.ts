import type { Request, Response, NextFunction } from 'express';
import { authenticate } from './authenticate';
import { ForbiddenError } from '../errors/ForbiddenError';

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    authenticate(req, res, (err?: unknown) => {
      if (err) {
        next(err);
        return;
      }
      const { user } = req;
      if (!user || !roles.includes(user.role)) {
        next(new ForbiddenError('Acesso negado'));
        return;
      }
      next();
    });
  };
}
