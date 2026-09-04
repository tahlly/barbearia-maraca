import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { ValidationError } from '../errors/ValidationError';
import { ForbiddenError } from '../errors/ForbiddenError';
import {
  findUsuarioByEmail,
  findUsuarioByGoogleId,
  criarUsuarioGoogle,
  vincularGoogleAUsuario,
  criarCliente,
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

function buildUsuarioDTO(usuario: UsuarioRow, nome: string | null, cargo?: string | null): UsuarioDTO {
  return {
    id: usuario.id,
    email: usuario.email,
    tipo: usuario.tipo,
    nome,
    cargo: cargo || null,
    avatarUrl: usuario.avatar_url,
  };
}

function gerarToken(): string {
  return 'tok_' + crypto.randomBytes(24).toString('hex');
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

  let nome: string | null = null;
  let cargo: string | null = null;

  if (usuario.tipo === 'cliente') {
    nome = await obterClienteNome(usuario.id);
  } else {
    const funcionario = await obterFuncionarioNome(usuario.id);
    nome = funcionario?.nome ?? null;
    cargo = usuario.tipo === 'funcionario' ? (funcionario?.cargo ?? null) : null;
  }

  return {
    token: gerarToken(),
    user: buildUsuarioDTO(usuario, nome, cargo),
  };
}