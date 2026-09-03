import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../../../shared/utils/jwt.js';
import { UnauthorizedError } from '../../../shared/errors/AppError.js';
import { JWTPayload } from '../../../shared/types/auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTPayload & { email: string; nome: string };
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token de acesso não fornecido');
  }

  const token = authHeader.substring(7);
  let payload: JWTPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new UnauthorizedError('Token de acesso inválido ou expirado');
  }

  request.user = payload;
}

export function requireRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authMiddleware(request, reply);
    if (!request.user || !allowedRoles.includes(request.user.tipo)) {
      throw new UnauthorizedError('Acesso negado');
    }
  };
}