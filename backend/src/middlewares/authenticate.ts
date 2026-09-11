import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '../config/jwt';
import { UnauthorizedError } from '../errors/UnauthorizedError';
import { buscarPorUsuarioId } from '../repositories/funcionario-repository';
import { findUsuarioPorId } from '../repositories/auth-repository';
import { mapearTipoParaRole } from '../services/auth-service';

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

/**
 * Valida se a sessão do token ainda está ativa (Item 1).
 *
 * Compara a versão de token gravada no JWT (`ver`, ausente = 0) com a coluna
 * `usuario.token_version` no banco. Qualquer divergência significa que a sessão
 * foi revogada (troca de senha, redefinição, rebaixamento de cargo, etc.).
 *
 * Retorna `true` quando a sessão é válida; `false` quando revogada ou quando o
 * usuário não existe mais (consistência ausente).
 */
async function sessaoJwtValida(payload: JwtPayload): Promise<boolean> {
  const sessao = await findUsuarioPorId(payload.id);
  if (!sessao) {
    return false;
  }
  const versaoToken = payload.ver ?? 0;
  return versaoToken === sessao.token_version;
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
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

  try {
    if (!(await sessaoJwtValida(payload))) {
      next(new UnauthorizedError('Sessão revogada. Faça login novamente.'));
      return;
    }
  } catch (error) {
    next(error as Error);
    return;
  }

  req.user = {
    id: payload.id,
    tipo: payload.tipo,
    role: payload.role,
  };

  // Funcionários inativados não podem usar tokens válidos; clientes não possuem
  // campo `ativo` e seguem sem esta verificação.
  if (payload.tipo === 'funcionario') {
    try {
      const funcionario = await buscarPorUsuarioId(payload.id);
      if (!funcionario || !funcionario.ativo) {
        next(new UnauthorizedError('Conta desativada'));
        return;
      }
      // Revalida o papel atual no banco a cada requisição: não confia no `role`
      // gravado no token (um admin rebaixado perde a prerrogativa imediatamente,
      // sem esperar expiração/relogin).
      req.user.role = mapearTipoParaRole(payload.tipo, funcionario.cargo);
    } catch (error) {
      next(error as Error);
      return;
    }
  }

  next();
}

export async function authenticateOptional(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    const payload = verifyToken(token);
    if (!(await sessaoJwtValida(payload))) {
      // Sessão revogada: segue como anônimo.
      next();
      return;
    }
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