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

/**
 * Cria um funcionário (rotas de gestão — recepcionista/admin).
 *
 * `requestingUserId`/`requestingRole` são os dados do usuário autenticado e
 * são OBRIGATÓRIOS nas rotas de gestão: a exigência de presença (card A2)
 * impede chamadas acidentais que omitam o contexto de quem executa a operação.
 * Regra hierárquica aplicada: recepcionista só cria funcionários com cargo
 * `barbeiro`; demais papéis negados por padrão.
 */
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
  requestingUserId: string,
  requestingRole: string,
): Promise<FuncionarioCriadoDTO> {
  // RBAC: recepcionista só cria barbeiro; demais papéis negados por padrão.
  if (requestingRole !== 'admin') {
    const cargoFinal = dados.cargo ?? 'barbeiro';
    if (requestingRole !== 'recepcionista' || cargoFinal !== 'barbeiro') {
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

/**
 * Atualiza um funcionário (rotas de gestão — recepcionista/admin).
 *
 * `requestingUserId`/`requestingRole` são os dados do usuário autenticado e
 * são OBRIGATÓRIOS nas rotas de gestão. O comportamento de permissão foi
 * preservado: ninguém edita o próprio cadastro pela tela de gestão e
 * recepcionista só gerencia funcionários com cargo `barbeiro`.
 */
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
  requestingUserId: string,
  requestingRole: string,
): Promise<FuncionarioCompletoDTO> {
  // ── RBAC ────────────────────────────────────────────────────
  // Regra hierárquica de edição (consolidação mainline + card):
  // - ninguém edita o próprio cadastro pela tela de gestão;
  // - recepcionista só gerencia (edita) funcionários com cargo `barbeiro`;
  // - recepcionista não pode mudar cargo para diferente de barbeiro;
  // - deny-by-default: roles fora de admin/recepcionista negados.
  const alvo = await funcionarioRepo.buscarPorId(id);
  if (!alvo) {
    throw new NotFoundError('Funcionário não encontrado');
  }
  if (requestingUserId === alvo.usuarioId) {
    throw new ForbiddenError('Não é possível editar o próprio cadastro nesta tela');
  }
  if (requestingRole === 'recepcionista' && alvo.cargo !== 'barbeiro') {
    throw new ForbiddenError('Acesso negado');
  }
  const cargoFinal = dados.cargo ?? alvo.cargo;
  if (requestingRole === 'recepcionista' && cargoFinal !== 'barbeiro') {
    throw new ForbiddenError('Recepcionista não pode alterar cargo para diferente de barbeiro');
  }
  if (requestingRole !== 'admin' && requestingRole !== 'recepcionista') {
    throw new ForbiddenError('Acesso negado');
  }

  // ── Categorias ──────────────────────────────────────────────
  const categorias = await validarCategorias(dados.categorias, cargoFinal);

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
    categorias,
    senhaHash,
  });
  if (!atualizado) {
    throw new NotFoundError('Funcionário não encontrado');
  }
  return atualizado;
}

// ── Alternância de status ─────────────────────────────────────

/**
 * Alterna o status ativo/inativo de um funcionário (rotas de gestão —
 * recepcionista/admin).
 *
 * `requestingUserId`/`requestingRole` são os dados do usuário autenticado e
 * são OBRIGATÓRIOS nas rotas de gestão.
 *
 * Regras hierárquicas:
 * - nenhum papel pode alterar o próprio status (auto-desativação/auto-ativação);
 * - `admin` pode alterar o status de qualquer cargo, exceto o próprio;
 * - `recepcionista` pode alterar o status somente de funcionários com
 *   `cargo === 'barbeiro'`;
 * - deny-by-default: roles fora de admin/recepcionista (incluindo uso interno
 *   sem papel informado) são negados.
 */
export async function alternarStatusFuncionario(
  id: string,
  ativo: boolean,
  requestingUserId: string,
  requestingRole: string,
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

  // Deny-by-default: apenas admin/recepcionista gerem status.
  if (requestingRole !== 'admin' && requestingRole !== 'recepcionista') {
    throw new ForbiddenError('Acesso negado');
  }

  const alterado = await funcionarioRepo.trocarStatus(id, ativo);
  if (!alterado) {
    throw new NotFoundError('Funcionário não encontrado');
  }
  return alterado;
}
