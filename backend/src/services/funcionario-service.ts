import bcrypt from 'bcrypt';
import { findUsuarioByEmail } from '../repositories/auth-repository';
import * as funcionarioRepo from '../repositories/funcionario-repository';
import { ValidationError } from '../errors/ValidationError';
import { NotFoundError } from '../errors/NotFoundError';
import { ForbiddenError } from '../errors/ForbiddenError';
import type { FuncionarioPublicoDTO, FuncionarioCompletoDTO, FuncionarioCriadoDTO } from '../dtos/funcionario-dto';

const SALT_ROUNDS = 10;
const SENHA_PADRAO = '123456';

// ── Listagens ─────────────────────────────────────────────────

export async function listarFuncionariosPublicos(cargo?: string, categoria?: string): Promise<FuncionarioPublicoDTO[]> {
  return funcionarioRepo.listarPublicos(cargo, categoria);
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
  senha?: string;
  telefone?: string;
  cargo?: string;
  especialidade?: string;
}): Promise<FuncionarioCriadoDTO> {
  // Validação de email único (regra de negócio)
  const existente = await findUsuarioByEmail(dados.email);
  if (existente) {
    throw new ValidationError('Email já cadastrado');
  }

  // Senha padrão quando não informada; o usuário será forçado a trocá-la
  // no primeiro acesso (primeiro_acesso = true).
  const senha = dados.senha ?? SENHA_PADRAO;
  const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);

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
  requestingUserId?: string,
  requestingRole?: string,
): Promise<FuncionarioCompletoDTO> {
  // Regra hierárquica de edição (espelha a regra de alternância de status):
  // - ninguém edita o próprio cadastro pela tela de gestão;
  // - recepcionista só gerencia (edita) funcionários com cargo `barbeiro`.
  const alvo = await funcionarioRepo.buscarPorId(id);
  if (!alvo) {
    throw new NotFoundError('Funcionário não encontrado');
  }
  if (requestingUserId && requestingUserId === alvo.usuarioId) {
    throw new ForbiddenError('Não é possível editar o próprio cadastro nesta tela');
  }
  if (requestingRole === 'recepcionista' && alvo.cargo !== 'barbeiro') {
    throw new ForbiddenError('Acesso negado');
  }

  // Se email foi fornecido, verificar se já está em uso por outro usuário
  if (dados.email) {
    const existente = await findUsuarioByEmail(dados.email);
    if (existente && alvo.usuarioId !== existente.id) {
      throw new ValidationError('Email já cadastrado por outro usuário');
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

/**
 * Alterna o status ativo/inativo de um funcionário.
 *
 * Regras hierárquicas:
 * - nenhum papel pode alterar o próprio status (auto-desativação/auto-ativação);
 * - `admin` pode alterar o status de qualquer cargo, exceto o próprio;
 * - `recepcionista` pode alterar o status somente de funcionários com
 *   `cargo === 'barbeiro'`.
 */
export async function alternarStatusFuncionario(
  id: string,
  ativo: boolean,
  requestingUserId?: string,
  requestingRole?: string,
): Promise<boolean> {
  const alvo = await funcionarioRepo.buscarPorId(id);
  if (!alvo) {
    throw new NotFoundError('Funcionário não encontrado');
  }

  // Ninguém pode alterar o próprio status.
  if (requestingUserId === alvo.usuarioId) {
    throw new ForbiddenError('Não é possível alterar o próprio status');
  }

  // Recepcionista só gerencia barbeiros; admin segue liberado.
  if (requestingRole === 'recepcionista' && alvo.cargo !== 'barbeiro') {
    throw new ForbiddenError('Acesso negado');
  }

  const alterado = await funcionarioRepo.trocarStatus(id, ativo);
  if (!alterado) {
    throw new NotFoundError('Funcionário não encontrado');
  }
  return alterado;
}
