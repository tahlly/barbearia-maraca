import { z } from 'zod';
import type { Request, Response } from 'express';
import * as service from '../services/horario-service';
import type { ReqUser } from '../services/horario-service';
import { UnauthorizedError } from '../errors/UnauthorizedError';
import { ValidationError } from '../errors/ValidationError';

const createSchema = z.object({
  funcionario_id: z.string().uuid('funcionario_id inválido'),
  dia_semana: z.number().int('dia_semana deve ser inteiro').min(0).max(6),
  hora_inicio: z.string().min(1, 'hora_inicio obrigatória'),
  hora_fim: z.string().min(1, 'hora_fim obrigatória'),
});

const updateSchema = z
  .object({
    dia_semana: z.number().int('dia_semana deve ser inteiro').min(0).max(6).optional(),
    hora_inicio: z.string().min(1, 'hora_inicio inválida').optional(),
    hora_fim: z.string().min(1, 'hora_fim inválida').optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nenhum campo para atualizar',
  });

const listarQuerySchema = z.object({
  funcionario_id: z.string().uuid('funcionario_id inválido').optional(),
  dia_semana: z
    .string()
    .regex(/^\d$/, 'dia_semana deve ser um inteiro entre 0 e 6')
    .optional(),
});

const disponibilidadeQuerySchema = z.object({
  funcionario_id: z.string().uuid('funcionario_id inválido'),
  data: z.string().optional(),
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

function extrairDiaSemanaDaData(data?: string): number | undefined {
  if (!data) {
    return undefined;
  }
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) {
    throw new ValidationError('data deve estar em formato ISO válido');
  }
  const jsDay = d.getDay(); // 0=domingo ... 6=sábado (igual ao domínio)
  return jsDay;
}

export async function listarHorarios(req: Request, res: Response): Promise<void> {
  const user = obterUsuario(req);
  const parsed = listarQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    throw new ValidationError('Parâmetros de consulta inválidos', parsed.error.issues);
  }

  const filtros: service.ListarHorariosFiltros = {
    funcionario_id: parsed.data.funcionario_id,
    dia_semana: parsed.data.dia_semana ? Number(parsed.data.dia_semana) : undefined,
  };

  const horarios = await service.listarHorarios(user, filtros);
  res.json(horarios);
}

export async function obterDisponibilidade(req: Request, res: Response): Promise<void> {
  const parsed = disponibilidadeQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    throw new ValidationError('Parâmetros de consulta inválidos', parsed.error.issues);
  }

  const diaSemana = extrairDiaSemanaDaData(parsed.data.data);
  const disponibilidade = await service.obterHorariosDeFuncionario(
    parsed.data.funcionario_id,
    diaSemana,
    parsed.data.data
  );

  res.json(disponibilidade);
}

export async function criarHorario(req: Request, res: Response): Promise<void> {
  const user = obterUsuario(req);
  const parsed = createSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues);
  }

  const horario = await service.criarHorario(user, {
    funcionario_id: parsed.data.funcionario_id,
    dia_semana: parsed.data.dia_semana,
    hora_inicio: parsed.data.hora_inicio,
    hora_fim: parsed.data.hora_fim,
  });

  res.status(201).json(horario);
}

export async function atualizarHorario(req: Request, res: Response): Promise<void> {
  const user = obterUsuario(req);
  const id = obterIdParam(req);
  const parsed = updateSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos', parsed.error.issues);
  }

  const horario = await service.atualizarHorario(user, id, parsed.data);
  res.json(horario);
}

export async function excluirHorario(req: Request, res: Response): Promise<void> {
  const user = obterUsuario(req);
  const id = obterIdParam(req);

  await service.excluirHorario(user, id);
  res.status(204).send();
}
