import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  obterConfiguracao,
  atualizarConfiguracao,
  listarComissoesDoFuncionario,
  salvarComissoesDoFuncionario,
} from '../services/comissao-service';
import { UnauthorizedError } from '../errors/UnauthorizedError';

// Schemas de borda (zod). A service revalida tudo em runtime (defesa em
// profundidade) — o cliente nunca é confiável.

const atualizarConfiguracaoSchema = z.object({
  comissao_ativa: z.boolean(),
});

const itemComissaoSchema = z.object({
  servico_id: z.string().uuid('servico_id inválido'),
  percentual: z
    .number()
    .finite('Percentual deve ser um número')
    .min(0, 'Percentual mínimo é 0')
    .max(100, 'Percentual máximo é 100'),
});

const salvarComissoesSchema = z.object({
  comissoes: z.array(itemComissaoSchema),
});

const funcionarioIdSchema = z.string().uuid('funcionarioId inválido');

function exigirUsuario(req: Request): { id: string; role: string } {
  const { user } = req;
  if (!user) {
    throw new UnauthorizedError();
  }
  return { id: user.id, role: user.role };
}

export async function obterConfiguracaoHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const configuracao = await obterConfiguracao(user.id, user.role);
  res.json(configuracao);
}

export async function atualizarConfiguracaoHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const body = atualizarConfiguracaoSchema.parse(req.body);
  const configuracao = await atualizarConfiguracao(user.id, user.role, body);
  res.json(configuracao);
}

export async function listarComissoesHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const funcionarioId = funcionarioIdSchema.parse(req.params.funcionarioId);
  const comissoes = await listarComissoesDoFuncionario(user.id, user.role, funcionarioId);
  res.json(comissoes);
}

export async function salvarComissoesHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const funcionarioId = funcionarioIdSchema.parse(req.params.funcionarioId);
  const body = salvarComissoesSchema.parse(req.body);
  const comissoes = await salvarComissoesDoFuncionario(user.id, user.role, funcionarioId, body);
  res.json(comissoes);
}