import type { Request, Response } from 'express';
import { obterPainelBarbeiro } from '../services/painel-barbeiro-service';
import { UnauthorizedError } from '../errors/UnauthorizedError';

function exigirUsuario(req: Request): { id: string; role: string } {
  const { user } = req;
  if (!user) {
    throw new UnauthorizedError();
  }
  return { id: user.id, role: user.role };
}

export async function painelBarbeiroHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const painel = await obterPainelBarbeiro(user.id, user.role);
  res.json(painel);
}