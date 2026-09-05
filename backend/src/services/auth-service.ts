import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { ValidationError } from '../errors/ValidationError';
import { ForbiddenError } from '../errors/ForbiddenError';
import { UnauthorizedError } from '../errors/UnauthorizedError';
import {
  findUsuarioByEmail,
  findUsuarioByGoogleId,
  criarUsuarioGoogle,
  vincularGoogleAUsuario,
  criarCliente,
  criarSessao,
  obterClienteNome,
  obterFuncionarioNome,
  type UsuarioRow,
} from '../repositories/auth-repository';
import type { LoginResponseDTO, Papel, UsuarioDTO } from '../dtos/auth-dto';

export const SESSAO_TTL_MS = 30 * 60 * 1000;

let client: OAuth2Client | undefined;

function getGoogleClient(): OAuth2Client {
  if (!client) {
    client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || '');
  }
  return client;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  nome: string;
  avatarUrl: string | null;
}

/**
 * Mapeia tipo/cargo persistidos para o papel consumido pela SPA e pelo
 * middleware de autorização. Papel é derivado no backend, nunca aceito do cliente.
 */
export function mapearTipoParaRole(tipo: string, cargo?: string | null): Papel {
  if (tipo === 'cliente') return 'cliente';
  if (cargo === 'administrador') return 'admin';
  if (cargo === 'recepcionista') return 'recepcionista';
  return 'profissional';
}

export function hashTokenSessao(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function gerarToken(): string {
  return 'tok_' + crypto.randomBytes(24).toString('hex');
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

export function validarTokenGoogle(idToken: string): Promise<GoogleProfile> {
  if (!idToken) {
    throw new ValidationError('Token do Google ausente');
  }
  return getGoogleClient()
    .verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID || '',
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

async function carregarNomeECargo(
  usuario: UsuarioRow,
): Promise<{ nome: string | null; cargo: string | null }> {
  if (usuario.tipo === 'cliente') {
    return { nome: await obterClienteNome(usuario.id), cargo: null };
  }
  const funcionario = await obterFuncionarioNome(usuario.id);
  return {
    nome: funcionario?.nome ?? null,
    cargo: funcionario?.cargo ?? null,
  };
}

/**
 * Gera token opaco, registra a sessão (token_hash SHA-256 hex) com TTL de 30
 * minutos e monta a resposta interna de login. Nunca retorna o hash nem a senha.
 */
export async function criarSessaoParaUsuario(usuario: UsuarioRow): Promise<LoginResponseDTO> {
  const perfil = await carregarNomeECargo(usuario);
  const token = gerarToken();
  const expiraEm = new Date(Date.now() + SESSAO_TTL_MS);

  await criarSessao({
    usuarioId: usuario.id,
    tokenHash: hashTokenSessao(token),
    expiraEm,
  });

  return {
    token,
    expiresAt: expiraEm.getTime(),
    user: buildUsuarioDTO(usuario, perfil.nome, perfil.cargo),
  };
}

export async function autenticarLocal(email: string, senha: string): Promise<LoginResponseDTO> {
  const usuario = await findUsuarioByEmail(email.trim().toLowerCase());

  if (!usuario) {
    throw new UnauthorizedError('Credenciais inválidas');
  }

  // Usuário criado via Google sem senha não pode autenticar com credenciais locais.
  if (!usuario.senha_hash) {
    throw new UnauthorizedError('Credenciais inválidas');
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
  if (!senhaValida) {
    throw new UnauthorizedError('Credenciais inválidas');
  }

  return criarSessaoParaUsuario(usuario);
}

export async function autenticarComGoogle(idToken: string): Promise<LoginResponseDTO> {
  const perfil = await validarTokenGoogle(idToken);

  let usuario = await findUsuarioByGoogleId(perfil.sub);

  if (!usuario) {
    const usuarioPorEmail = await findUsuarioByEmail(perfil.email);

    if (usuarioPorEmail) {
      await vincularGoogleAUsuario(usuarioPorEmail.id, perfil.sub, perfil.avatarUrl);
      usuario = await findUsuarioByGoogleId(perfil.sub);
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

  if (!usuario) {
    throw new ForbiddenError('Falha ao validar token do Google');
  }

  return criarSessaoParaUsuario(usuario);
}
