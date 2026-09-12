import type { Request, Response } from 'express';
import { z } from 'zod';
import { obterResumoFinanceiro } from '../services/resumo-financeiro-service';
import { UnauthorizedError } from '../errors/UnauthorizedError';

// Filtros do Resumo: `inicio`/`fim` opcionais (ausentes → ano corrente na
// service), mesmo padrão do faturamento e do resumo de despesas.
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

export async function resumoFinanceiroHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const filtros = resumoSchema.parse(req.query);
  const resumo = await obterResumoFinanceiro(user.id, user.role, filtros);
  res.json(resumo);
}