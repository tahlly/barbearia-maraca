import { z } from 'zod';
import type { Request, Response } from 'express';
import * as service from '../services/horario-excecao-service';
import type { ReqUser } from '../services/horario-excecao-service';
import { UnauthorizedError } from '../errors/UnauthorizedError';
import { ValidationError } from '../errors/ValidationError';

const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIPOS = ['bloqueio', 'liberacao'] as const;

const createSchema = z.object({
  funcionario_id: z.string().uuid('funcionario_id inválido'),
  data: z.string().regex(DATA_REGEX, 'data deve estar no formato YYYY-MM-DD'),
  hora_inicio: z.string().min(1, 'hora_inicio obrigatória'),
  hora_fim: z.string().min(1, 'hora_fim obrigatória'),
  tipo: z.enum(TIPOS),
  motivo: z.string().max(500, 'motivo deve ter no máximo 500 caracteres').nullable().optional(),
});

const updateSchema = z
  .object({
    data: z.string().regex(DATA_REGEX, 'data deve estar no formato YYYY-MM-DD').optional(),
    hora_inicio: z.string().min(1, 'hora_inicio inválida').optional(),
    hora_fim: z.string().min(1, 'hora_fim inválida').optional(),
    tipo: z.enum(TIPOS).optional(),
    motivo: z.string().max(500, 'motivo deve ter no máximo 500 caracteres').nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nenhum campo para atualizar',
  });

const listarQuerySchema = z.object({
  funcionario_id: z.string().uuid('funcionario_id inválido').optional(),
  data: z.string().regex(DATA_REGEX, 'data deve estar no formato YYYY-MM-DD').optional(),
  tipo: z.enum(TIPOS).optional(),
});

function obterUsuario(req: Request): ReqUser {
  if (!req.user) {
    throw new UnauthorizedError('Não autenticado');
  }
  return req.user;
}

function obterIdParam(req: Request): string {
  const { id } = req.params;
  if (typeof id !== 'string' || id.length === 0) {
    throw new ValidationError('Parâmetro id inválido');
  }
  return id;
}

export async function listarExcecoes(req: Request, res: Response): Promise<void> {
  const user = obterUsuario(req);
  const parsed = listarQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    throw new ValidationError('Parâmetros de consulta inválidos', parsed.error.issues);
  }

  const filtros: service.ListarExcecoesFiltros = {
    funcionario_id: parsed.data.funcionario_id,
    data: parsed.data.data,
    tipo: parsed.data.tipo,
  };

  const excecoes = await service.listarExcecoes(user, filtros);
  res.json(excecoes);
}

export async function criarExcecao(req: Request, res: Response): Promise<void> {
  const user = obterUsuario(req);
  const parsed = createSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues);
  }

  const excecao = await service.criarExcecao(user, {
    funcionario_id: parsed.data.funcionario_id,
    data: parsed.data.data,
    hora_inicio: parsed.data.hora_inicio,
    hora_fim: parsed.data.hora_fim,
    tipo: parsed.data.tipo,
    motivo: parsed.data.motivo,
  });

  res.status(201).json(excecao);
}

export async function atualizarExcecao(req: Request, res: Response): Promise<void> {
  const user = obterUsuario(req);
  const id = obterIdParam(req);
  const parsed = updateSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues);
  }

  const excecao = await service.atualizarExcecao(user, id, parsed.data);
  res.json(excecao);
}

export async function excluirExcecao(req: Request, res: Response): Promise<void> {
  const user = obterUsuario(req);
  const id = obterIdParam(req);

  await service.excluirExcecao(user, id);
  res.status(204).send();
}
