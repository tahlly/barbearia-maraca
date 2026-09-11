import type { Request, Response } from 'express';
import { z } from 'zod';
import { obterResumoDespesas } from '../services/despesa-service';
import { UnauthorizedError } from '../errors/UnauthorizedError';

// Espelha o `faturamentoSchema` do agendamento-controller: datas ISO opcionais
// (ausentes → ano corrente na service).
const resumoSchema = z.object({
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial inválida').optional(),
  fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final inválida').optional(),
});

function exigirUsuario(req: Request): { id: string; role: string } {
  const { user } = req;
  if (!user) {
    throw new UnauthorizedError();
  }
  return { id: user.id, role: user.role };
}

export async function resumoHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const filtros = resumoSchema.parse(req.query);
  const resumo = await obterResumoDespesas(user.id, user.role, filtros);
  res.json(resumo);
}
