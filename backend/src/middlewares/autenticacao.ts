import type { NextFunction, Request, Response } from 'express';
import { buscarSessaoValida } from '../repositories/auth-repository';
import { hashTokenSessao, mapearTipoParaRole } from '../services/auth-service';
import { UnauthorizedError } from '../errors/UnauthorizedError';
import { ForbiddenError } from '../errors/ForbiddenError';
import type { Papel } from '../dtos/auth-dto';

/**
 * Middleware de autenticação: exige header `Authorization: Bearer <token>`,
 * calcula o hash SHA-256 hex do token e busca uma sessão válida (não revogada
 * e não expirada) no banco. Popula req.usuario e req.papel. Nega por padrão
 * (401) quando o header está ausente, malformado ou a sessão é inválida/expirada.
 */
export async function autenticar(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;

    if (!header) {
      throw new UnauthorizedError('Token de autenticação ausente');
    }

    const partes = header.split(' ');
    const [esquema, token, ...resto] = partes;

    if (esquema !== 'Bearer' || !token || resto.length > 0) {
      throw new UnauthorizedError('Token de autenticação inválido');
    }

    const sessao = await buscarSessaoValida(hashTokenSessao(token));

    if (!sessao) {
      throw new UnauthorizedError('Sessão inválida ou expirada');
    }

    req.usuario = {
      id: sessao.id,
      email: sessao.email,
      tipo: sessao.tipo,
      nome: sessao.nome,
      cargo: sessao.cargo,
      avatarUrl: sessao.avatarUrl,
    };
    req.papel = mapearTipoParaRole(sessao.tipo, sessao.cargo);

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware de autorização por papel: aplica negação por padrão (403) quando
 * o usuário autenticado não possui um dos papéis permitidos.
 */
export function autorizarPapel(...papeis: Papel[]): (req: Request, _res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.papel || !papeis.includes(req.papel)) {
      next(new ForbiddenError('Acesso negado para o seu perfil'));
      return;
    }
    next();
  };
}
