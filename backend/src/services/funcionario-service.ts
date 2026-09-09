import bcrypt from 'bcrypt';
import { findUsuarioByEmail } from '../repositories/auth-repository';
import * as funcionarioRepo from '../repositories/funcionario-repository';
import { listarCategoriasAtivas } from './categoria-service';
import { ValidationError } from '../errors/ValidationError';
import { NotFoundError } from '../errors/NotFoundError';
import { ForbiddenError } from '../errors/ForbiddenError';
import type { FuncionarioPublicoDTO, FuncionarioCompletoDTO, FuncionarioCriadoDTO } from '../dtos/funcionario-dto';

const SALT_ROUNDS = 10;
const SENHA_PADRAO = '123456';

/**
 * Valida a lista de categorias antes de repassar ao repositório:
 * - cargo final ≠ barbeiro com categorias não vazia → 400 (categorias são
 *   exclusivas de barbeiros);
 * - nome desconhecido ou categoria inativa → 400;
 * - lista vazia/ausente é permitida (o repositório limpa as associações).
 */
async function validarCategorias(
  categorias: string[] | undefined,
  cargoFinal: string,
): Promise<string[] | undefined> {
  if (categorias === undefined || categorias.length === 0) {
    return categorias;
  }
  if (cargoFinal !== 'barbeiro') {
    throw new ValidationError('Categorias só podem ser atribuídas a barbeiros');
  }
  const ativas = await listarCategoriasAtivas();
  const nomesAtivos = new Set(ativas.map((categoria) => categoria.nome));
  for (const nome of categorias) {
    if (!nomesAtivos.has(nome)) {
      throw new ValidationError(`Categoria desconhecida ou inativa: ${nome}`);
    }
  }
  return categorias;
}

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

export async function criarFuncionario(
  dados: {
    nome: string;
    email: string;
    senha?: string;
    telefone?: string;
    cargo?: string;
    especialidade?: string;
    categorias?: string[];
  },
  solicitante: { id: string; role: string },
): Promise<FuncionarioCriadoDTO> {
  // RBAC: recepcionista só cria barbeiro; demais papéis negados por padrão.
  if (solicitante.role !== 'admin') {
    const cargoFinal = dados.cargo ?? 'barbeiro';
    if (solicitante.role !== 'recepcionista' || cargoFinal !== 'barbeiro') {
      throw new ForbiddenError('Acesso negado');
    }
  }

  const categorias = await validarCategorias(dados.categorias, dados.cargo ?? 'barbeiro');

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
    categorias,
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
    categorias?: string[];
  },
  solicitante?: { id: string; role: string },
): Promise<FuncionarioCompletoDTO> {
  // ── RBAC ────────────────────────────────────────────────────
  if (solicitante && solicitante.role !== 'admin') {
    const atual = await funcionarioRepo.buscarPorId(id);
    if (!atual) {
      throw new NotFoundError('Funcionário não encontrado');
    }

    if (solicitante.role === 'recepcionista') {
      // Recepcionista só pode atualizar barbeiros
      if (atual.cargo !== 'barbeiro') {
        throw new ForbiddenError('Recepcionista não pode alterar funcionários com cargo diferente de barbeiro');
      }
      // Cargo final permanece barbeiro (não pode mudar cargo)
      const cargoFinal = dados.cargo ?? atual.cargo;
      if (cargoFinal !== 'barbeiro') {
        throw new ForbiddenError('Recepcionista não pode alterar cargo para diferente de barbeiro');
      }
    } else {
      // Qualquer outro papel (ex.: barbeiro, cliente) — negar por padrão
      throw new ForbiddenError('Acesso negado');
    }
  }

  // ── Busca atual para validações ─────────────────────────────
  const atual = await funcionarioRepo.buscarPorId(id);
  if (!atual) {
    throw new NotFoundError('Funcionário não encontrado');
  }

  const cargoFinal = dados.cargo ?? atual.cargo;

  // ── Categorias ──────────────────────────────────────────────
  const categorias = await validarCategorias(dados.categorias, cargoFinal);

  // Se email foi fornecido, verificar se já está em uso por outro usuário
  if (dados.email) {
    const existente = await findUsuarioByEmail(dados.email);
    if (existente && atual.usuarioId !== existente.id) {
      throw new ValidationError('Email já cadastrado por outro usuário');
    }
  }

  // Hash da senha somente quando fornecida
  const senhaHash = dados.senha
    ? await bcrypt.hash(dados.senha, SALT_ROUNDS)
    : undefined;

  const atualizado = await funcionarioRepo.atualizar(id, {
    ...dados,
    categorias,
    senhaHash,
  });
  if (!atualizado) {
    throw new NotFoundError('Funcionário não encontrado');
  }
  return atualizado;
}

// ── Alternância de status ─────────────────────────────────────

export async function alternarStatusFuncionario(
  id: string,
  ativo: boolean,
  solicitante?: { id: string; role: string },
): Promise<boolean> {
  // ── RBAC ────────────────────────────────────────────────────
  if (solicitante && solicitante.role !== 'admin') {
    if (solicitante.role === 'recepcionista') {
      // Busca o funcionário para verificar o cargo
      const atual = await funcionarioRepo.buscarPorId(id);
      if (!atual) {
        throw new NotFoundError('Funcionário não encontrado');
      }
      if (atual.cargo !== 'barbeiro') {
        throw new ForbiddenError('Recepcionista não pode alterar status de funcionários com cargo diferente de barbeiro');
      }
    } else {
      // Qualquer outro papel — negar por padrão
      throw new ForbiddenError('Acesso negado');
    }
  }

  const alterado = await funcionarioRepo.trocarStatus(id, ativo);
  if (!alterado) {
    throw new NotFoundError('Funcionário não encontrado');
  }
  return alterado;
}
