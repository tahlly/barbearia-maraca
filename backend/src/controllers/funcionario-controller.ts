import type { Request, Response } from 'express';
import { z } from 'zod';
import * as funcionarioService from '../services/funcionario-service';
import { ValidationError } from '../errors/ValidationError';
import { ForbiddenError } from '../errors/ForbiddenError';
import {
  senhaForteOpcionalSchema,
  senhaForteFuncionarioOpcionalSchema,
} from '../utils/senha';

// ── Schemas de validação (Zod) ────────────────────────────────

const CARGOS = ['barbeiro', 'recepcionista', 'administrador'] as const;

const categoriaSchema = z
  .string()
  .trim()
  .min(1, 'Categoria inválida')
  .max(80, 'Categoria deve ter no máximo 80 caracteres')
  .optional();

const criarFuncionarioSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  senha: senhaForteFuncionarioOpcionalSchema,
  telefone: z.string().optional(),
  cargo: z.enum(CARGOS).optional(),
  especialidade: z.string().max(100).optional(),
  categorias: z.array(z.string().trim().min(1)).max(20).optional(),
});

const atualizarFuncionarioSchema = z.object({
  nome: z.string().min(1).optional(),
  telefone: z.string().optional(),
  cargo: z.enum(CARGOS).optional(),
  especialidade: z.string().max(100).optional(),
  categoria: categoriaSchema,
  foto: z.string().max(255).optional(),
  descricao: z.string().optional(),
  email: z.string().email('Email inválido').optional(),
  senha: senhaForteOpcionalSchema,
  categorias: z.array(z.string().trim().min(1)).max(20).optional(),
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

/**
 * Garante e retorna o usuário autenticado nas rotas de gestão.
 * O middleware `authorize` compõe `authenticate`, mas o contrato das operações
 * de gestão exige solicitante obrigatório (card A2) — falha explícita se ausente.
 */
function usuarioSolicitante(req: Request): { id: string; role: string } {
  const id = req.user?.id;
  const role = req.user?.role;
  if (typeof id !== 'string' || typeof role !== 'string') {
    throw new ForbiddenError('Usuário não autenticado');
  }
  return { id, role };
}

/** GET /api/funcionarios — público; filtra ativo=true, cargo e categoria por querystring. */
export async function listarPublicos(req: Request, res: Response): Promise<void> {
  const cargoParam = typeof req.query.cargo === 'string' ? req.query.cargo : undefined;
  const categoriaParam = typeof req.query.categoria === 'string' ? req.query.categoria : undefined;
  const resultado = await funcionarioService.listarFuncionariosPublicos(cargoParam, categoriaParam);
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
  const solicitante = usuarioSolicitante(req);
  const resultado = await funcionarioService.criarFuncionario(dados, solicitante.id, solicitante.role);
  res.status(201).json(resultado);
}

/** PUT /api/funcionarios/:id — recepcionista/admin; regra hierárquica no service. */
export async function atualizar(req: Request, res: Response): Promise<void> {
  const dados = atualizarFuncionarioSchema.parse(req.body);
  const solicitante = usuarioSolicitante(req);
  const resultado = await funcionarioService.atualizarFuncionario(
    idParam(req),
    dados,
    solicitante.id,
    solicitante.role,
  );
  res.json(resultado);
}

/** PATCH /api/funcionarios/:id/status — recepcionista/admin. */
export async function alterarStatus(req: Request, res: Response): Promise<void> {
  const dados = alterarStatusSchema.parse(req.body);
  const solicitante = usuarioSolicitante(req);
  await funcionarioService.alternarStatusFuncionario(
    idParam(req),
    dados.ativo,
    solicitante.id,
    solicitante.role,
  );
  res.json({ mensagem: 'Status atualizado', ativo: dados.ativo });
}
