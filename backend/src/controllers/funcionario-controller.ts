import type { Request, Response } from 'express';
import { z } from 'zod';
import * as funcionarioService from '../services/funcionario-service';
import { ValidationError } from '../errors/ValidationError';

// ── Schemas de validação (Zod) ────────────────────────────────

const CARGOS = ['barbeiro', 'recepcionista', 'administrador'] as const;

const criarFuncionarioSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  telefone: z.string().optional(),
  cargo: z.enum(CARGOS).optional(),
  especialidade: z.string().max(100).optional(),
});

const atualizarFuncionarioSchema = z.object({
  nome: z.string().min(1).optional(),
  telefone: z.string().optional(),
  cargo: z.enum(CARGOS).optional(),
  especialidade: z.string().max(100).optional(),
  foto: z.string().max(255).optional(),
  descricao: z.string().optional(),
  email: z.string().email('Email inválido').optional(),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').optional(),
});

const alterarStatusSchema = z.object({
  ativo: z.boolean(),
});

const buscarQuerySchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Email é obrigatório').email('Email inválido'),
});

// ── Helpers ───────────────────────────────────────────────────

/** Extrai um parâmetro de rota como string única (Express 5 permite string[]). */
function idParam(req: Request): string {
  const raw = req.params.id;
  if (typeof raw === 'string') {
    return raw;
  }
  if (Array.isArray(raw)) {
    const prime = raw[0];
    if (typeof prime === 'string') {
      return prime;
    }
  }
  throw new ValidationError('Parâmetro id inválido');
}

// ── Handlers ──────────────────────────────────────────────────

/** GET /api/funcionarios — público; filtra ativo=true e cargo por querystring. */
export async function listarPublicos(req: Request, res: Response): Promise<void> {
  const cargoParam = typeof req.query.cargo === 'string' ? req.query.cargo : undefined;
  const resultado = await funcionarioService.listarFuncionariosPublicos(cargoParam);
  res.json(resultado);
}

/** GET /api/funcionarios/detalhes — autenticado (admin/recepcionista); retorna todos com dados completos. */
export async function listarDetalhes(_req: Request, res: Response): Promise<void> {
  const resultado = await funcionarioService.listarFuncionarios();
  res.json(resultado);
}

/** GET /api/funcionarios/:id — protegido (autenticado). */
export async function buscarPorId(req: Request, res: Response): Promise<void> {
  const resultado = await funcionarioService.buscarFuncionarioPorId(
    idParam(req),
    req.user?.id,
    req.user?.role,
  );
  res.json(resultado);
}

/** GET /api/funcionarios/buscar?email=... — autenticado; permissão verificada no service. */
export async function buscarPorEmail(req: Request, res: Response): Promise<void> {
  const parsed = buscarQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    throw new ValidationError('Parâmetro email inválido', parsed.error.issues);
  }

  const resultado = await funcionarioService.buscarFuncionarioPorEmail(
    parsed.data.email,
    req.user?.id,
    req.user?.role,
  );
  res.json(resultado);
}

/** POST /api/funcionarios — recepcionista/admin. */
export async function criar(req: Request, res: Response): Promise<void> {
  const dados = criarFuncionarioSchema.parse(req.body);
  const resultado = await funcionarioService.criarFuncionario(dados);
  res.status(201).json(resultado);
}

/** PUT /api/funcionarios/:id — recepcionista/admin. */
export async function atualizar(req: Request, res: Response): Promise<void> {
  const dados = atualizarFuncionarioSchema.parse(req.body);
  const resultado = await funcionarioService.atualizarFuncionario(idParam(req), dados);
  res.json(resultado);
}

/** PATCH /api/funcionarios/:id/status — recepcionista/admin. */
export async function alterarStatus(req: Request, res: Response): Promise<void> {
  const dados = alterarStatusSchema.parse(req.body);
  await funcionarioService.alternarStatusFuncionario(idParam(req), dados.ativo);
  res.json({ mensagem: 'Status atualizado', ativo: dados.ativo });
}
