import db from '../database/connection';
import { InternalError } from '../errors/InternalError';

export interface UsuarioRow {
  id: string;
  email: string;
  senha_hash: string | null;
  tipo: string;
  google_id: string | null;
  avatar_url: string | null;
}

export interface CriarSessaoParams {
  usuarioId: string;
  tokenHash: string;
  expiraEm: Date;
}

export interface SessaoRow {
  id: string;
  usuario_id: string;
  token_hash: string;
  criada_em: Date;
  expira_em: Date;
  revogada_em: Date | null;
}

/**
 * Dados do usuário dono de uma sessão válida, já resolvidos com nome/cargo.
 * Usado pelo middleware de autenticação para popular req.usuario/req.papel.
 */
export interface SessaoComUsuarioRow {
  id: string;
  email: string;
  tipo: string;
  nome: string | null;
  cargo: string | null;
  avatarUrl: string | null;
}

export async function findUsuarioByEmail(email: string): Promise<UsuarioRow | null> {
  const row = await db('usuario').where('email', email).first();
  return (row as UsuarioRow) ?? null;
}

export async function findUsuarioByGoogleId(googleId: string): Promise<UsuarioRow | null> {
  const row = await db('usuario').where('google_id', googleId).first();
  return (row as UsuarioRow) ?? null;
}

export function criarUsuarioGoogle(data: {
  email: string;
  googleId: string;
  nome: string;
  avatarUrl?: string | null;
}): Promise<UsuarioRow> {
  return db('usuario')
    .insert({
      email: data.email,
      senha_hash: null,
      tipo: 'cliente',
      google_id: data.googleId,
      avatar_url: data.avatarUrl || null,
    })
    .returning('*')
    .then((rows) => rows[0] as UsuarioRow);
}

export async function vincularGoogleAUsuario(
  usuarioId: string,
  googleId: string,
  avatarUrl?: string | null,
): Promise<void> {
  await db('usuario').where('id', usuarioId).update({
    google_id: googleId,
    avatar_url: avatarUrl || null,
  });
}

export function criarCliente(data: { usuarioId: string; nome: string }): Promise<void> {
  return db('cliente').insert({
    usuario_id: data.usuarioId,
    nome: data.nome,
  });
}

export async function obterClienteNome(usuarioId: string): Promise<string | null> {
  const row = await db('cliente').where('usuario_id', usuarioId).first();
  return row?.nome ?? null;
}

export async function obterFuncionarioNome(usuarioId: string): Promise<{ nome: string; cargo: string } | null> {
  const row = await db('funcionario').where('usuario_id', usuarioId).first();
  return row ? { nome: row.nome, cargo: row.cargo } : null;
}

export async function criarSessao(params: CriarSessaoParams): Promise<SessaoRow> {
  const result = await db('sessao')
    .insert({
      usuario_id: params.usuarioId,
      token_hash: params.tokenHash,
      expira_em: params.expiraEm,
    })
    .returning('*');
  const rows = result as SessaoRow[];
  const row = rows[0];
  if (!row) {
    throw new InternalError('Falha ao registrar sessão');
  }
  return row;
}

interface SessaoValidaConsulta {
  id: string;
  email: string;
  tipo: string;
  avatar_url: string | null;
  nome: string | null;
  cargo: string | null;
}

/**
 * Retorna o usuário dono da sessão quando a sessão é válida:
 * token_hash correspondente, revogada_em IS NULL e expira_em > now().
 */
export async function buscarSessaoValida(tokenHash: string): Promise<SessaoComUsuarioRow | null> {
  const result = await db('sessao')
    .join('usuario', 'usuario.id', 'sessao.usuario_id')
    .leftJoin('cliente', 'cliente.usuario_id', 'usuario.id')
    .leftJoin('funcionario', 'funcionario.usuario_id', 'usuario.id')
    .where('sessao.token_hash', tokenHash)
    .andWhere('sessao.revogada_em', null)
    .andWhere('sessao.expira_em', '>', db.fn.now())
    .select(
      'usuario.id',
      'usuario.email',
      'usuario.tipo',
      'usuario.avatar_url',
      db.raw('COALESCE(cliente.nome, funcionario.nome) AS nome'),
      'funcionario.cargo',
    )
    .first();
  const row = result as SessaoValidaConsulta | undefined;

  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    tipo: row.tipo,
    nome: row.nome,
    cargo: row.cargo,
    avatarUrl: row.avatar_url,
  };
}

/**
 * Revoga a sessão do token informado (para uso em logout futuro).
 * Não há endpoint de logout aprovado ainda; função disponível para o fluxo.
 */
export async function revogarSessao(tokenHash: string): Promise<void> {
  await db('sessao')
    .where('token_hash', tokenHash)
    .andWhere('revogada_em', null)
    .update({ revogada_em: db.fn.now() });
}
