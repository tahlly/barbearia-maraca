import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  criarAgendamento,
  listarAgendamentos,
  obterAgendamento,
  cancelarAgendamento,
  reagendarAgendamento,
  confirmarAgendamento,
  concluirAgendamento,
  reverterConclusaoAgendamento,
  obterFaturamento,
} from '../services/agendamento-service';
import { UnauthorizedError } from '../errors/UnauthorizedError';

const criarSchema = z.object({
  funcionario_id: z.string().uuid('funcionario_id deve ser um UUID'),
  servico_id: z.string().uuid('servico_id deve ser um UUID'),
  data: z.string(),
  hora: z.string(),
  observacao: z.string().max(1000).nullable().optional(),
  // Permite que recepcionista/admin criem agendamento em nome de um cliente.
  // A service valida a obrigatoriedade conforme o papel do solicitante.
  cliente_id: z.string().uuid('cliente_id deve ser um UUID').optional(),
  // Offset do navegador em minutos (ex.: -180 para UTC-3); usado na checagem
  // de "horário passado" para não rejeitar horários ainda futuros no fuso do
  // cliente quando o servidor roda em UTC.
  timezone_offset_minutes: z.number().int().min(-840).max(840).nullable().optional(),
});

const listarSchema = z.object({
  data: z.string().optional(),
  status: z.enum(['pendente', 'confirmado', 'cancelado', 'concluido']).optional(),
});

// Reagendamento altera somente data/hora; timezone_offset_minutes segue o
// mesmo contrato de criarSchema (offset do navegador para checagem de passado).
const reagendarSchema = z.object({
  data: z.string(),
  hora: z.string(),
  timezone_offset_minutes: z.number().int().min(-840).max(840).nullable().optional(),
});

// Conclusão com pagamento presencial: corpo OPCIONAL `{ registrar_pagamento_presencial: true }`
// (exclusivo da recepcionista — a service nega 403 para outros papéis). `.strict()`
// rejeita campos desconhecidos (400) em vez de aceitá-los em silêncio: qualquer
// tentativa de enviar valor/status/forma junto é erro, nunca dado considerado.
const concluirSchema = z
  .object({
    registrar_pagamento_presencial: z.boolean().optional(),
  })
  .strict();

const faturamentoSchema = z.object({
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial inválida').optional(),
  fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final inválida').optional(),
});

const idSchema = z.string().uuid('id deve ser um UUID');

function exigirUsuario(req: Request): { id: string; role: string } {
  const { user } = req;
  if (!user) {
    throw new UnauthorizedError();
  }
  return { id: user.id, role: user.role };
}

export async function criarHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const dados = criarSchema.parse(req.body);
  const agendamento = await criarAgendamento(user.id, user.role, dados);
  res.status(201).json(agendamento);
}

export async function listarHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const filtros = listarSchema.parse(req.query);
  const agendamentos = await listarAgendamentos(user.id, user.role, filtros);
  res.json(agendamentos);
}

export async function obterHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const id = idSchema.parse(req.params.id);
  const agendamento = await obterAgendamento(user.id, user.role, id);
  res.json(agendamento);
}

export async function cancelarHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const id = idSchema.parse(req.params.id);
  const agendamento = await cancelarAgendamento(user.id, user.role, id);
  res.json(agendamento);
}

export async function reagendarHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const id = idSchema.parse(req.params.id);
  const dados = reagendarSchema.parse(req.body);
  const agendamento = await reagendarAgendamento(user.id, user.role, id, dados);
  res.json(agendamento);
}

export async function confirmarHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const id = idSchema.parse(req.params.id);
  const agendamento = await confirmarAgendamento(user.id, user.role, id);
  res.json(agendamento);
}

export async function concluirHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const id = idSchema.parse(req.params.id);
  // `req.body` pode ser undefined quando a requisição PATCH não envia corpo
  // (sem Content-Type JSON); o contrato exige corpo OPCIONAL.
  const dados = concluirSchema.parse(req.body ?? {});
  const agendamento = await concluirAgendamento(user.id, user.role, id, {
    registrarPagamentoPresencial: dados.registrar_pagamento_presencial,
  });
  res.json(agendamento);
}

export async function reverterHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const id = idSchema.parse(req.params.id);
  const agendamento = await reverterConclusaoAgendamento(user.id, user.role, id);
  res.json(agendamento);
}

export async function faturamentoHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const filtros = faturamentoSchema.parse(req.query);
  const faturamento = await obterFaturamento(user.id, user.role, filtros);
  res.json(faturamento);
}
