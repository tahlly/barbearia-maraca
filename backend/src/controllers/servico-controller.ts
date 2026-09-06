import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  obterServicosAtivos,
  obterServicoPorId,
  criarNovoServico,
  editarServico,
  trocarStatusServico,
} from '../services/servico-service';
import { ValidationError } from '../errors/ValidationError';

// Zod schema de validação — v4 do zod.
// `preco` aceita number ou string numérica; é normalizado para string no service.

const precoSchema = z.union([z.number().min(0), z.string().regex(/^\d+(\.\d{1,2})?$/, 'Preço inválido')]);

const criarServicoSchema = z.object({
  nome: z.string().trim().min(1, 'Nome do serviço é obrigatório'),
  descricao: z.string().trim().min(1).optional().nullable(),
  duracao_minutos: z.number().int().positive('Duração deve ser inteiro positivo'),
  preco: precoSchema,
});

const atualizarServicoSchema = z
  .object({
    nome: z.string().trim().min(1, 'Nome do serviço é obrigatório').optional(),
    descricao: z.string().trim().min(1).optional().nullable(),
    duracao_minutos: z.number().int().positive('Duração deve ser inteiro positivo').optional(),
    preco: precoSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nenhum campo para atualizar',
  });

const statusSchema = z.object({
  ativo: z.boolean(),
});

function normalizarPreco(preco: number | string): string {
  if (typeof preco === 'number') {
    // Formata como string com até 2 casas decimais, preservando exatidão da moeda.
    return preco.toFixed(2);
  }
  return preco;
}

function obterId(req: Request): string {
  const { id } = req.params;
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new ValidationError('ID do serviço é obrigatório');
  }
  return id;
}

export async function listarServicos(_req: Request, res: Response): Promise<void> {
  const servicos = await obterServicosAtivos();
  res.json(servicos);
}

export async function obterServico(req: Request, res: Response): Promise<void> {
  const id = obterId(req);
  const servico = await obterServicoPorId(id);
  res.json(servico);
}

export async function criarServico(req: Request, res: Response): Promise<void> {
  const body = criarServicoSchema.parse(req.body);
  const servico = await criarNovoServico({
    nome: body.nome,
    descricao: body.descricao ?? null,
    duracao_minutos: body.duracao_minutos,
    preco: normalizarPreco(body.preco),
  });
  res.status(201).json(servico);
}

export async function atualizarServico(req: Request, res: Response): Promise<void> {
  const id = obterId(req);
  const body = atualizarServicoSchema.parse(req.body);
  const servico = await editarServico(id, {
    nome: body.nome,
    descricao: body.descricao,
    duracao_minutos: body.duracao_minutos,
    preco: body.preco !== undefined ? normalizarPreco(body.preco) : undefined,
  });
  res.json(servico);
}

export async function atualizarStatusServico(req: Request, res: Response): Promise<void> {
  const id = obterId(req);
  const body = statusSchema.parse(req.body);
  const servico = await trocarStatusServico(id, { ativo: body.ativo });
  res.json(servico);
}
