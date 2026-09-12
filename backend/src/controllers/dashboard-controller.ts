import type { Request, Response } from 'express';
import { z } from 'zod';
import { obterGraficosDashboard } from '../services/dashboard-service';
import { UnauthorizedError } from '../errors/UnauthorizedError';

// Filtros do Dashboard: `inicio`/`fim` opcionais (default ano corrente na
// service) + `dias` (7 ou 30) para a janela do gráfico de agendamentos por dia.
const graficosSchema = z.object({
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial inválida').optional(),
  fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final inválida').optional(),
  dias: z
    .string()
    .regex(/^(7|30)$/, 'dias deve ser 7 ou 30')
    .transform(Number)
    .optional(),
});

function exigirUsuario(req: Request): { id: string; role: string } {
  const { user } = req;
  if (!user) {
    throw new UnauthorizedError();
  }
  return { id: user.id, role: user.role };
}

export async function graficosHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const filtros = graficosSchema.parse(req.query);
  const graficos = await obterGraficosDashboard(user.id, user.role, filtros);
  res.json(graficos);
}