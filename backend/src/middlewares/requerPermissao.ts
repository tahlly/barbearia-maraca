import type { Request, Response, NextFunction } from 'express';
import { exigirPermissao, type ChavePermissao } from '../services/permissao-service';

/**
 * Middleware de autorização granular (Item 1): exige que o usuário autenticado
 * possua a permissão efetiva `chave` (override no banco > matriz por papel).
 * Deve ser usado SEMPRE depois de `authenticate`/`authorize`.
 */
export function requerPermissao(chave: ChavePermissao) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    exigirPermissao(req.user, chave)
      .then(() => next())
      .catch((erro: unknown) => next(erro as Error));
  };
}