import db from '../database/connection';

export interface UsuarioRow {
  id: string;
  email: string;
  senha_hash: string | null;
  tipo: string;
  google_id: string | null;
  avatar_url: string | null;
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

export function criarUsuarioComSenha(data: {
  email: string;
  senhaHash: string;
  tipo: string;
}): Promise<UsuarioRow> {
  return db('usuario')
    .insert({
      email: data.email,
      senha_hash: data.senhaHash,
      tipo: data.tipo,
    })
    .returning('*')
    .then((rows) => rows[0] as UsuarioRow);
}

export function criarClienteCompleto(data: {
  usuarioId: string;
  nome: string;
  telefone?: string;
}): Promise<void> {
  return db('cliente').insert({
    usuario_id: data.usuarioId,
    nome: data.nome,
    telefone: data.telefone || null,
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

export async function findUsuarioById(id: string): Promise<UsuarioRow | undefined> {
  const row = await db('usuario').where('id', id).first();
  return row as UsuarioRow | undefined;
}

export async function atualizarUsuario(
  id: string,
  dados: { email?: string; senhaHash?: string }
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (dados.email !== undefined) update.email = dados.email;
  if (dados.senhaHash !== undefined) update.senha_hash = dados.senhaHash;
  if (Object.keys(update).length === 0) return;
  update.atualizado_em = new Date();
  await db('usuario').where('id', id).update(update);
}

export async function atualizarClienteNome(usuarioId: string, nome: string): Promise<void> {
  await db('cliente').where('usuario_id', usuarioId).update({ nome });
}

export async function atualizarFuncionarioNome(usuarioId: string, nome: string): Promise<void> {
  await db('funcionario').where('usuario_id', usuarioId).update({ nome });
}