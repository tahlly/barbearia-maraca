import { z } from 'zod';
import type { Request, Response } from 'express';
import {
  listarClientesService,
  obterClienteParaUsuario,
  criarClienteNovo,
  atualizarClienteParaUsuario,
} from '../services/cliente-service';
import type { UsuarioAutenticado } from '../services/cliente-service';
import { UnauthorizedError } from '../errors/UnauthorizedError';

const createSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório'),
  email: z.string().trim().toLowerCase().min(1, 'Email é obrigatório').email('Email inválido'),
  telefone: z.string().trim().optional(),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

const updateSchema = z.object({
  nome: z.string().trim().min(1, 'Nome não pode ser vazio').optional(),
  email: z.string().trim().toLowerCase().email('Email inválido').optional(),
  telefone: z.string().trim().min(1, 'Telefone não pode ser vazio').optional(),
});

function userAutenticado(req: Request): UsuarioAutenticado {
  if (!req.user) {
    throw new UnauthorizedError('Não autenticado');
  }
  return { id: req.user.id, role: req.user.role };
}

function parametroId(req: Request): string {
  const raw = req.params.id;
  if (typeof raw !== 'string') {
    throw new UnauthorizedError('Identificador inválido');
  }
  return raw;
}

export async function listarClientesHandler(req: Request, res: Response): Promise<void> {
  const busca = typeof req.query.busca === 'string' ? req.query.busca : undefined;
  const clientes = await listarClientesService(busca);
  res.json(clientes);
}

export async function obterClienteHandler(req: Request, res: Response): Promise<void> {
  const id = parametroId(req);
  const usuario = userAutenticado(req);
  const cliente = await obterClienteParaUsuario(id, usuario);
  res.json(cliente);
}

export async function criarClienteHandler(req: Request, res: Response): Promise<void> {
  const dados = createSchema.parse(req.body);
  const cliente = await criarClienteNovo(dados);
  res.status(201).json(cliente);
}

export async function atualizarClienteHandler(req: Request, res: Response): Promise<void> {
  const id = parametroId(req);
  const usuario = userAutenticado(req);
  const dados = updateSchema.parse(req.body);
  const cliente = await atualizarClienteParaUsuario(id, dados, usuario);
  res.json(cliente);
}
