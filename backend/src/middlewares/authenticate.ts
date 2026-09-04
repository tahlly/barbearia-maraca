import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '../config/jwt';
import { UnauthorizedError } from '../errors/UnauthorizedError';

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }
  return token;
}

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const token = extractBearerToken(req);
  if (!token) {
    next(new UnauthorizedError('Token de autenticação ausente'));
    return;
  }

  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    next(new UnauthorizedError('Token inválido ou expirado'));
    return;
  }

  req.user = {
    id: payload.id,
    tipo: payload.tipo,
    role: payload.role,
  };

  next();
}

export function authenticateOptional(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const token = extractBearerToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.id,
      tipo: payload.tipo,
      role: payload.role,
    };
  } catch {
    // token inválido: segue como anônimo
  }

  next();
}
