import bcrypt from 'bcrypt';
import { findUsuarioByEmail } from '../repositories/auth-repository';
import * as funcionarioRepo from '../repositories/funcionario-repository';
import { ValidationError } from '../errors/ValidationError';
import { NotFoundError } from '../errors/NotFoundError';
import { ForbiddenError } from '../errors/ForbiddenError';
import type { FuncionarioPublicoDTO, FuncionarioCompletoDTO, FuncionarioCriadoDTO } from '../dtos/funcionario-dto';

const SALT_ROUNDS = 10;

// ── Listagens ─────────────────────────────────────────────────

export async function listarFuncionariosPublicos(cargo?: string): Promise<FuncionarioPublicoDTO[]> {
  return funcionarioRepo.listarPublicos(cargo);
}

export async function listarFuncionarios(): Promise<FuncionarioCompletoDTO[]> {
  return funcionarioRepo.listarTodos();
}

// ── Busca por ID (com verificação de permissão) ───────────────

export async function buscarFuncionarioPorId(
  id: string,
  requestingUserId?: string,
  requestingRole?: string,
): Promise<FuncionarioCompletoDTO> {
  const funcionario = await funcionarioRepo.buscarPorId(id);
  if (!funcionario) {
    throw new NotFoundError('Funcionário não encontrado');
  }

  // Admin e recepcionista veem detalhe completo
  if (requestingRole === 'admin' || requestingRole === 'recepcionista') {
    return funcionario;
  }

  // Barbeiro (profissional) pode ver o próprio perfil
  if (requestingRole === 'profissional' && requestingUserId) {
    if (funcionario.usuarioId === requestingUserId) {
      return funcionario;
    }
  }

  throw new ForbiddenError('Acesso negado');
}

/**
 * Busca um funcionário pelo e-mail aplicando a mesma regra de permissão de
 * `buscarFuncionarioPorId`:
 * - admin/recepcionista veem detalhe completo de qualquer funcionário;
 * - barbeiro (profissional) só encontra o próprio perfil.
 */
export async function buscarFuncionarioPorEmail(
  email: string,
  requestingUserId?: string,
  requestingRole?: string,
): Promise<FuncionarioCompletoDTO> {
  const funcionario = await funcionarioRepo.buscarPorEmail(email);
  if (!funcionario) {
    throw new NotFoundError('Funcionário não encontrado');
  }

  // Admin e recepcionista veem detalhe completo
  if (requestingRole === 'admin' || requestingRole === 'recepcionista') {
    return funcionario;
  }

  // Barbeiro (profissional) pode ver o próprio perfil
  if (requestingRole === 'profissional' && requestingUserId) {
    if (funcionario.usuarioId === requestingUserId) {
      return funcionario;
    }
  }

  throw new ForbiddenError('Acesso negado');
}

// ── Criação ───────────────────────────────────────────────────

export async function criarFuncionario(dados: {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
  cargo?: string;
  especialidade?: string;
}): Promise<FuncionarioCriadoDTO> {
  // Validação de email único (regra de negócio)
  const existente = await findUsuarioByEmail(dados.email);
  if (existente) {
    throw new ValidationError('Email já cadastrado');
  }

  const senhaHash = await bcrypt.hash(dados.senha, SALT_ROUNDS);

  return funcionarioRepo.criar({
    email: dados.email,
    senhaHash,
    nome: dados.nome,
    telefone: dados.telefone,
    cargo: dados.cargo,
    especialidade: dados.especialidade,
  });
}

// ── Atualização ───────────────────────────────────────────────

export async function atualizarFuncionario(
  id: string,
  dados: {
    nome?: string;
    telefone?: string;
    cargo?: string;
    especialidade?: string;
    foto?: string;
    descricao?: string;
    email?: string;
    senha?: string;
  },
): Promise<FuncionarioCompletoDTO> {
  // Se email foi fornecido, verificar se já está em uso por outro usuário
  if (dados.email) {
    const existente = await findUsuarioByEmail(dados.email);
    if (existente) {
      // Busca o funcionário atual para saber seu usuarioId
      const atual = await funcionarioRepo.buscarPorId(id);
      if (atual && atual.usuarioId !== existente.id) {
        throw new ValidationError('Email já cadastrado por outro usuário');
      }
    }
  }

  // Hash da senha somente quando fornecida
  const senhaHash = dados.senha
    ? await bcrypt.hash(dados.senha, SALT_ROUNDS)
    : undefined;

  const atualizado = await funcionarioRepo.atualizar(id, {
    ...dados,
    senhaHash,
  });
  if (!atualizado) {
    throw new NotFoundError('Funcionário não encontrado');
  }
  return atualizado;
}

// ── Alternância de status ─────────────────────────────────────

export async function alternarStatusFuncionario(id: string, ativo: boolean): Promise<boolean> {
  const alterado = await funcionarioRepo.trocarStatus(id, ativo);
  if (!alterado) {
    throw new NotFoundError('Funcionário não encontrado');
  }
  return alterado;
}
