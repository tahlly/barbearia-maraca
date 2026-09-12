import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  obterResumoDespesas,
  listarDespesasDoProjeto,
  criarDespesaManual,
  editarDespesaManual,
  excluirDespesaManual,
} from '../services/despesa-service';
import { UnauthorizedError } from '../errors/UnauthorizedError';
import { ValidationError } from '../errors/ValidationError';
import { DATA_ISO_REGEX } from '../utils/validadores';

// Espelha o `faturamentoSchema` do agendamento-controller: datas ISO opcionais
// (ausentes → ano corrente na service).
const resumoSchema = z.object({
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial inválida').optional(),
  fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final inválida').optional(),
});

// Query da listagem: filtros de período (opcionais, JUNTOS) e tipo opcional.
const listarSchema = z.object({
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial inválida').optional(),
  fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final inválida').optional(),
  tipo_despesa: z
    .enum(['fixa', 'variavel', 'comissao', 'outro'])
    .optional(),
});

// `valor` aceita number ou string numérica; é normalizado para string decimal.
const valorSchema = z.union([
  z.number().min(0, 'Valor não pode ser negativo'),
  z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valor inválido'),
]);

// Enum SEM `comissao`: a regra de proteção impede o tipo manual automaticamente
// na borda (além da verificação de runtime na service).
const tipoDespesaManualSchema = z.enum(['fixa', 'variavel', 'outro']);

const criarDespesaSchema = z.object({
  descricao: z.string().trim().min(1, 'Descrição é obrigatória'),
  tipo_despesa: tipoDespesaManualSchema,
  valor: valorSchema,
  data: z.string().regex(DATA_ISO_REGEX, 'Data inválida'),
  recorrente: z.boolean(),
  funcionario_id: z.string().uuid('funcionario_id inválido').nullable().optional(),
});

const atualizarDespesaSchema = z
  .object({
    descricao: z.string().trim().min(1, 'Descrição é obrigatória').optional(),
    tipo_despesa: tipoDespesaManualSchema.optional(),
    valor: valorSchema.optional(),
    data: z.string().regex(DATA_ISO_REGEX, 'Data inválida').optional(),
    recorrente: z.boolean().optional(),
    funcionario_id: z.string().uuid('funcionario_id inválido').nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nenhum campo para atualizar',
  });

function exigirUsuario(req: Request): { id: string; role: string } {
  const { user } = req;
  if (!user) {
    throw new UnauthorizedError();
  }
  return { id: user.id, role: user.role };
}

function normalizarValor(valor: number | string): string {
  if (typeof valor === 'number') {
    // Formata como string com até 2 casas decimais, preservando exatidão da moeda.
    return valor.toFixed(2);
  }
  return valor;
}

function obterId(req: Request): string {
  const { id } = req.params;
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new ValidationError('ID da despesa é obrigatório');
  }
  return id;
}

export async function resumoHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const filtros = resumoSchema.parse(req.query);
  const resumo = await obterResumoDespesas(user.id, user.role, filtros);
  res.json(resumo);
}

export async function listarDespesasHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const query = listarSchema.parse(req.query);
  const despesas = await listarDespesasDoProjeto(user.id, user.role, {
    inicio: query.inicio,
    fim: query.fim,
    tipoDespesa: query.tipo_despesa,
  });
  res.json(despesas);
}

export async function criarDespesaHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const body = criarDespesaSchema.parse(req.body);
  const despesa = await criarDespesaManual(user.id, user.role, {
    descricao: body.descricao,
    tipo_despesa: body.tipo_despesa,
    valor: normalizarValor(body.valor),
    data: body.data,
    recorrente: body.recorrente,
    funcionarioId: body.funcionario_id,
  });
  res.status(201).json(despesa);
}

export async function atualizarDespesaHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const id = obterId(req);
  const body = atualizarDespesaSchema.parse(req.body);
  const despesa = await editarDespesaManual(user.id, user.role, id, {
    descricao: body.descricao,
    tipo_despesa: body.tipo_despesa,
    valor: body.valor !== undefined ? normalizarValor(body.valor) : undefined,
    data: body.data,
    recorrente: body.recorrente,
    funcionarioId: body.funcionario_id,
  });
  res.json(despesa);
}

export async function excluirDespesaHandler(req: Request, res: Response): Promise<void> {
  const user = exigirUsuario(req);
  const id = obterId(req);
  await excluirDespesaManual(user.id, user.role, id);
  res.status(204).send();
}
