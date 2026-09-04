import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { signToken } from '../config/jwt';
import db from '../database/connection';
import { ValidationError } from '../errors/ValidationError';
import { ForbiddenError } from '../errors/ForbiddenError';
import { UnauthorizedError } from '../errors/UnauthorizedError';
import { NotFoundError } from '../errors/NotFoundError';
import {
  findUsuarioByEmail,
  findUsuarioById,
  findUsuarioByGoogleId,
  criarUsuarioGoogle,
  criarUsuarioComSenha,
  vincularGoogleAUsuario,
  criarCliente,
  criarClienteCompleto,
  obterClienteNome,
  obterFuncionarioNome,
  type UsuarioRow,
} from '../repositories/auth-repository';
import type { LoginResponseDTO, UsuarioDTO } from '../dtos/auth-dto';

const DEFAULT_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

const client = new OAuth2Client(DEFAULT_CLIENT_ID);

export interface GoogleProfile {
  sub: string;
  email: string;
  nome: string;
  avatarUrl: string | null;
}

const SALT_ROUNDS = 10;

export function mapearTipoParaRole(tipo: string, cargo?: string | null): string {
  if (tipo === 'cliente') return 'cliente';
  if (cargo === 'administrador') return 'admin';
  if (cargo === 'recepcionista') return 'recepcionista';
  return 'profissional';
}

export function validarTokenGoogle(idToken: string): Promise<GoogleProfile> {
  if (!idToken) {
    throw new ValidationError('Token do Google ausente');
  }
  return client
    .verifyIdToken({
      idToken,
      audience: DEFAULT_CLIENT_ID,
    })
    .then((ticket) => {
      const payload = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email) {
        throw new ForbiddenError('Token do Google inválido');
      }
      return {
        sub: payload.sub,
        email: payload.email,
        nome: payload.name || payload.email,
        avatarUrl: payload.picture || null,
      };
    })
    .catch((error: unknown) => {
      if (error instanceof ValidationError || error instanceof ForbiddenError) {
        throw error;
      }
      throw new ForbiddenError('Falha ao validar token do Google');
    });
}

function buildUsuarioDTO(
  usuario: UsuarioRow,
  nome: string | null,
  cargo?: string | null,
): UsuarioDTO {
  return {
    id: usuario.id,
    email: usuario.email,
    tipo: usuario.tipo,
    nome,
    cargo: cargo || null,
    avatarUrl: usuario.avatar_url,
  };
}

function gerarTokenJWT(usuario: UsuarioRow, role: string): string {
  return signToken({
    sub: usuario.id,
    id: usuario.id,
    tipo: usuario.tipo,
    role,
  });
}

async function resolveNomeECargo(
  usuario: UsuarioRow,
): Promise<{ nome: string | null; cargo: string | null }> {
  if (usuario.tipo === 'cliente') {
    const nome = await obterClienteNome(usuario.id);
    return { nome, cargo: null };
  }
  const funcionario = await obterFuncionarioNome(usuario.id);
  return {
    nome: funcionario?.nome ?? null,
    cargo: usuario.tipo === 'funcionario' ? (funcionario?.cargo ?? null) : null,
  };
}

export async function autenticarComGoogle(idToken: string): Promise<LoginResponseDTO> {
  const perfil = await validarTokenGoogle(idToken);

  let usuario = await findUsuarioByGoogleId(perfil.sub);

  if (!usuario) {
    usuario = await findUsuarioByEmail(perfil.email);

    if (usuario) {
      await vincularGoogleAUsuario(usuario.id, perfil.sub, perfil.avatarUrl);
    } else {
      usuario = await criarUsuarioGoogle({
        email: perfil.email,
        googleId: perfil.sub,
        nome: perfil.nome,
        avatarUrl: perfil.avatarUrl,
      });
      await criarCliente({ usuarioId: usuario.id, nome: perfil.nome });
    }
  }

  const { nome, cargo } = await resolveNomeECargo(usuario);
  const role = mapearTipoParaRole(usuario.tipo, cargo);

  return {
    token: gerarTokenJWT(usuario, role),
    user: buildUsuarioDTO(usuario, nome, cargo),
    role,
  };
}

export async function atualizarPerfil(
  usuarioId: string,
  dados: { nome?: string; email?: string; senha?: string }
): Promise<{ nome: string | null; email: string }> {
  // Se email fornecido, verificar duplicidade
  if (dados.email) {
    const existente = await findUsuarioByEmail(dados.email);
    if (existente && existente.id !== usuarioId) {
      throw new ValidationError('Email já está em uso');
    }
  }

  // Hash senha se fornecida
  let senhaHash: string | undefined;
  if (dados.senha) {
    senhaHash = await bcrypt.hash(dados.senha, SALT_ROUNDS);
  }

  // Buscar tipo do usuário
  const usuario = await findUsuarioById(usuarioId);
  if (!usuario) throw new NotFoundError('Usuário não encontrado');

  // Transaction: atualizar usuario + cliente/funcionario
  await db.transaction(async (trx) => {
    // Atualizar usuario
    const updateUsuario: Record<string, unknown> = {};
    if (dados.email) updateUsuario.email = dados.email;
    if (senhaHash) updateUsuario.senha_hash = senhaHash;
    if (Object.keys(updateUsuario).length > 0) {
      updateUsuario.atualizado_em = new Date();
      await trx('usuario').where('id', usuarioId).update(updateUsuario);
    }

    // Atualizar nome na tabela correta
    if (dados.nome) {
      if (usuario.tipo === 'cliente') {
        await trx('cliente').where('usuario_id', usuarioId).update({ nome: dados.nome });
      } else {
        await trx('funcionario').where('usuario_id', usuarioId).update({ nome: dados.nome });
      }
    }
  });

  // Retornar dados atualizados
  return {
    nome: dados.nome ?? null,
    email: dados.email ?? (await findUsuarioById(usuarioId))!.email,
  };
}

export async function registrar(data: {
  email: string;
  senha: string;
  nome: string;
  telefone?: string;
}): Promise<LoginResponseDTO> {
  const existing = await findUsuarioByEmail(data.email);
  if (existing) {
    throw new ValidationError('Email ja cadastrado');
  }

  const senhaHash = await bcrypt.hash(data.senha, SALT_ROUNDS);

  const usuario = await criarUsuarioComSenha({
    email: data.email,
    senhaHash,
    tipo: 'cliente',
  });

  await criarClienteCompleto({
    usuarioId: usuario.id,
    nome: data.nome,
    telefone: data.telefone,
  });

  const role = mapearTipoParaRole(usuario.tipo, null);

  return {
    token: gerarTokenJWT(usuario, role),
    user: buildUsuarioDTO(usuario, data.nome, null),
    role,
  };
}

export async function login(data: {
  email: string;
  senha: string;
}): Promise<LoginResponseDTO> {
  const usuario = await findUsuarioByEmail(data.email);
  if (!usuario || !usuario.senha_hash) {
    throw new UnauthorizedError('Credenciais inválidas');
  }

  const senhaValida = await bcrypt.compare(data.senha, usuario.senha_hash);
  if (!senhaValida) {
    throw new UnauthorizedError('Credenciais inválidas');
  }

  const { nome, cargo } = await resolveNomeECargo(usuario);
  const role = mapearTipoParaRole(usuario.tipo, cargo);

  return {
    token: gerarTokenJWT(usuario, role),
    user: buildUsuarioDTO(usuario, nome, cargo),
    role,
  };
}
