import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  criarAgendamento,
  listarAgendamentos,
  obterAgendamento,
  cancelarAgendamento,
  confirmarAgendamento,
  concluirAgendamento,
} from '../services/agendamento-service';
import { UnauthorizedError } from '../errors/UnauthorizedError';

const criarSchema = z.object({
  funcionario_id: z.string().uuid('funcionario_id deve ser um UUID'),
  servico_id: z.string().uuid('servico_id deve ser um UUID'),
  data: z.string(),
  hora: z.string(),
  observacao: z.string().max(1000).nullable().optional(),
});

const listarSchema = z.object({
  data: z.string().optional(),
  status: z.enum(['pendente', 'confirmado', 'cancelado', 'concluido']).optional(),
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

export async function confirmarHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const id = idSchema.parse(req.params.id);
  const agendamento = await confirmarAgendamento(user.id, user.role, id);
  res.json(agendamento);
}

export async function concluirHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const id = idSchema.parse(req.params.id);
  const agendamento = await concluirAgendamento(user.id, user.role, id);
  res.json(agendamento);
}
