import db from '../database/connection';

export interface PermissaoCatalogoRow {
  chave: string;
  descricao: string;
}

export interface PermissaoUsuarioRow {
  usuario_id: string;
  permissao: string;
  concedida: boolean;
  criado_por: string | null;
  criado_em: string;
}

export interface UsuarioInternoPermissaoRow {
  usuario_id: string;
  email: string;
  nome: string;
  cargo: string;
}

/** Catálogo de permissões disponíveis (chave → descrição). */
export async function listarCatalogoPermissoes(): Promise<PermissaoCatalogoRow[]> {
  return db('permissao').select('chave', 'descricao').orderBy('chave');
}

/** Todos os overrides de permissão registrados para os usuários informados. */
export async function listarPermissoesPorUsuarios(
  usuarioIds: string[]
): Promise<PermissaoUsuarioRow[]> {
  if (usuarioIds.length === 0) {
    return [];
  }
  return db('permissao_usuario').whereIn('usuario_id', usuarioIds);
}

/**
 * Aplica uma alteração de permissão em uma única transação:
 * upsert em `permissao_usuario` + registro imutável em `auditoria_permissao`.
 */
export async function aplicarAlteracaoPermissao(dados: {
  usuarioId: string;
  permissao: string;
  concedida: boolean;
  criadoPor: string;
  acao: 'GRANT' | 'REVOKE';
}): Promise<void> {
  await db.transaction(async (trx) => {
    await trx('permissao_usuario')
      .insert({
        usuario_id: dados.usuarioId,
        permissao: dados.permissao,
        concedida: dados.concedida,
        criado_por: dados.criadoPor,
      })
      .onConflict(['usuario_id', 'permissao'])
      .merge({ concedida: dados.concedida, criado_por: dados.criadoPor });

    await trx('auditoria_permissao').insert({
      ator_id: dados.criadoPor,
      acao: dados.acao,
      alvo_id: dados.usuarioId,
      permissao: dados.permissao,
    });
  });
}

/** Usuários internos (funcionários) com dados resumidos para a tela de permissões. */
export async function listarUsuariosInternos(): Promise<UsuarioInternoPermissaoRow[]> {
  return db('funcionario')
    .join('usuario', 'usuario.id', 'funcionario.usuario_id')
    .where('usuario.tipo', 'funcionario')
    .select(
      'usuario.id as usuario_id',
      'usuario.email',
      'funcionario.nome',
      'funcionario.cargo'
    )
    .orderBy('funcionario.nome');
}

/** IDs de usuários internos com cargo administrador (detêm tudo por padrão da matriz). */
export async function listarIdsAdmins(): Promise<string[]> {
  const rows = await db('funcionario')
    .join('usuario', 'usuario.id', 'funcionario.usuario_id')
    .where('usuario.tipo', 'funcionario')
    .andWhere('funcionario.cargo', 'administrador')
    .select('usuario.id as id');
  return rows.map((row) => row.id as string);
}

/** IDs de usuários com concessão explícita `concedida=true` para uma chave. */
export async function listarIdsComPermissaoEfetiva(chave: string): Promise<string[]> {
  const rows = await db('permissao_usuario')
    .where('permissao', chave)
    .andWhere('concedida', true)
    .select('usuario_id');
  return rows.map((row) => row.usuario_id as string);
}

/** Busca o funcionário vinculado a um usuário (valida alvo de alteração). */
export async function buscarFuncionarioPorUsuarioId(
  usuarioId: string
): Promise<{ usuario_id: string; nome: string; cargo: string } | null> {
  const row = await db('funcionario')
    .join('usuario', 'usuario.id', 'funcionario.usuario_id')
    .where('usuario.id', usuarioId)
    .select('usuario.id as usuario_id', 'funcionario.nome', 'funcionario.cargo')
    .first();
  return row ?? null;
}