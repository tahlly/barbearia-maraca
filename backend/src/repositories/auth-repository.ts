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