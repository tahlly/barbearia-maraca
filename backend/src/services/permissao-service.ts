import { mapearTipoParaRole } from './auth-service';
import {
  listarCatalogoPermissoes,
  listarPermissoesPorUsuarios,
  aplicarAlteracaoPermissao,
  listarUsuariosInternos,
  listarIdsAdmins,
  listarIdsComPermissaoEfetiva,
  buscarFuncionarioPorUsuarioId,
} from '../repositories/permissao-repository';
import { ForbiddenError } from '../errors/ForbiddenError';
import { NotFoundError } from '../errors/NotFoundError';
import { ValidationError } from '../errors/ValidationError';

export const CHAVES_PERMISSOES = [
  'ver_financeiro',
  'excluir_desativar_funcionario',
  'criar_admin',
  'gerenciar_permissoes',
  'editar_servicos_categorias',
  'agendar_para_cliente',
] as const;

export type ChavePermissao = (typeof CHAVES_PERMISSOES)[number];

/**
 * Matriz de permissões por papel (default).
 *
 * Aprovada em decisão humana (Item 1):
 * - admin: todas as 6; além disso, cada admin possui linha de override no banco
 *   (backfill da migration) que, na prática, replica a matriz;
 * - recepcionista: `excluir_desativar_funcionario`,
 *   `editar_servicos_categorias` e `agendar_para_cliente` verdadeiras (expansão
 *   intencional aprovada); demais negadas;
 * - profissional: apenas `agendar_para_cliente` verdadeira (nasce com a
 *   permissão; admin pode revogar via override);
 * - cliente: todas negadas.
 *
 * A linha em `permissao_usuario` (override) tem precedência sobre a matriz.
 */
const PERMISSOES_DEFAULT: Record<string, Record<ChavePermissao, boolean>> = {
  admin: {
    ver_financeiro: true,
    excluir_desativar_funcionario: true,
    criar_admin: true,
    gerenciar_permissoes: true,
    editar_servicos_categorias: true,
    agendar_para_cliente: true,
  },
  recepcionista: {
    ver_financeiro: false,
    excluir_desativar_funcionario: true,
    criar_admin: false,
    gerenciar_permissoes: false,
    editar_servicos_categorias: true,
    agendar_para_cliente: true,
  },
  profissional: {
    ver_financeiro: false,
    excluir_desativar_funcionario: false,
    criar_admin: false,
    gerenciar_permissoes: false,
    editar_servicos_categorias: false,
    agendar_para_cliente: true,
  },
  cliente: {
    ver_financeiro: false,
    excluir_desativar_funcionario: false,
    criar_admin: false,
    gerenciar_permissoes: false,
    editar_servicos_categorias: false,
    agendar_para_cliente: false,
  },
};

export interface UsuarioPermissaoContext {
  id: string;
  role: string;
}

/** Monta o mapa de permissões efetivas: override no banco > matriz por papel. */
function montarPermissoes(
  mapa: Map<string, boolean>,
  role: string,
): Record<ChavePermissao, boolean> {
  const permissoes = {} as Record<ChavePermissao, boolean>;
  for (const chave of CHAVES_PERMISSOES) {
    permissoes[chave] = mapa.has(chave) ? (mapa.get(chave) as boolean) : PERMISSOES_DEFAULT[role][chave];
  }
  return permissoes;
}

/** Avalia a permissão efetiva de um usuário: override no banco > matriz por papel. */
export async function temPermissao(
  usuario: UsuarioPermissaoContext | undefined,
  chave: ChavePermissao
): Promise<boolean> {
  if (!usuario || !usuario.role) {
    return false;
  }
  const linhas = await listarPermissoesPorUsuarios([usuario.id]);
  const linha = linhas.find((item) => item.permissao === chave);
  if (linha) {
    return linha.concedida;
  }
  return PERMISSOES_DEFAULT[usuario.role]?.[chave] ?? false;
}

/** Falha com 403 quando o usuário não possui a permissão efetiva. */
export async function exigirPermissao(
  usuario: UsuarioPermissaoContext | undefined,
  chave: ChavePermissao
): Promise<void> {
  if (!(await temPermissao(usuario, chave))) {
    throw new ForbiddenError('Acesso negado');
  }
}

// ── Serviços de gestão de permissões ──────────────────────────────────

export interface PermissaoCatalogoDTO {
  chave: string;
  descricao: string;
}

export interface UsuarioComPermissoesDTO {
  usuarioId: string;
  email: string;
  nome: string;
  cargo: string;
  permissoes: Record<ChavePermissao, boolean>;
}

export async function listarPermissoes(): Promise<PermissaoCatalogoDTO[]> {
  return listarCatalogoPermissoes();
}

/** Lista os funcionários com suas permissões efetivas (matriz + overrides). */
export async function listarUsuariosComPermissoes(): Promise<UsuarioComPermissoesDTO[]> {
  const usuarios = await listarUsuariosInternos();
  const todas = await listarPermissoesPorUsuarios(usuarios.map((usuario) => usuario.usuario_id));

  const agrupadas = new Map<string, Map<string, boolean>>();
  for (const linha of todas) {
    let mapa = agrupadas.get(linha.usuario_id);
    if (!mapa) {
      mapa = new Map();
      agrupadas.set(linha.usuario_id, mapa);
    }
    mapa.set(linha.permissao, linha.concedida);
  }

  return usuarios.map((usuario) => {
    const role = mapearTipoParaRole('funcionario', usuario.cargo);
    const mapa = agrupadas.get(usuario.usuario_id) ?? new Map<string, boolean>();
    return {
      usuarioId: usuario.usuario_id,
      email: usuario.email,
      nome: usuario.nome,
      cargo: usuario.cargo,
      permissoes: montarPermissoes(mapa, role),
    };
  });
}

/**
 * Permissões efetivas de um usuário autenticado (override no banco > matriz
 * por papel). Usado pelos controllers de login para expor o RBAC ao frontend.
 */
export async function obterPermissoesEfetivasUsuario(
  usuario: UsuarioPermissaoContext,
): Promise<Record<ChavePermissao, boolean>> {
  const linhas = await listarPermissoesPorUsuarios([usuario.id]);
  const mapa = new Map(linhas.map((linha) => [linha.permissao, linha.concedida]));
  const role = PERMISSOES_DEFAULT[usuario.role] ? usuario.role : 'cliente';
  return montarPermissoes(mapa, role);
}

/** Detentores efetivos de uma chave: admins (matriz) + concessões explícitas true. */
export async function obterDetentoresEfetivos(chave: ChavePermissao): Promise<string[]> {
  const admins = await listarIdsAdmins();
  const explicitos = await listarIdsComPermissaoEfetiva(chave);
  return [...new Set([...admins, ...explicitos])];
}

/**
 * Aplica (concede/revoga) uma permissão a um funcionário, com auditoria.
 *
 * Regras invariantes:
 * - ator não pode alterar a si mesmo;
 * - alvo precisa ser um funcionário existente;
 * - a última permissão efetiva de `gerenciar_permissoes` não pode ser revogada.
 */
export async function atualizarPermissao(
  ator: UsuarioPermissaoContext,
  alvoUsuarioId: string,
  permissao: string,
  concedida: boolean
): Promise<void> {
  if (!CHAVES_PERMISSOES.includes(permissao as ChavePermissao)) {
    throw new ValidationError('Permissão desconhecida');
  }
  if (!ator || ator.id === alvoUsuarioId) {
    throw new ForbiddenError('Não é possível alterar as próprias permissões');
  }

  const alvo = await buscarFuncionarioPorUsuarioId(alvoUsuarioId);
  if (!alvo) {
    throw new NotFoundError('Funcionário não encontrado');
  }

  // Nunca zerar os detentores efetivos de gerenciar_permissoes.
  if (permissao === 'gerenciar_permissoes' && !concedida) {
    const detentores = await obterDetentoresEfetivos('gerenciar_permissoes');
    if (detentores.length === 1 && detentores[0] === alvoUsuarioId) {
      throw new ValidationError('Não é possível remover a última permissão de gerenciamento');
    }
  }

  await aplicarAlteracaoPermissao({
    usuarioId: alvoUsuarioId,
    permissao,
    concedida,
    criadoPor: ator.id,
    acao: concedida ? 'GRANT' : 'REVOKE',
  });
}