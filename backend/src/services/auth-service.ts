import bcrypt from 'bcrypt';
import crypto from 'crypto';
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
  salvarTokenResetSenha,
  findUsuarioByResetTokenHash,
  type UsuarioRow,
} from '../repositories/auth-repository';
import { enviarEmailRecuperacaoSenha } from './email-service';
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
const RESET_TOKEN_TTL_MS = (Number(process.env.RESET_TOKEN_TTL_MIN) || 30) * 60 * 1000;

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
): Promise<{ nome: string | null; cargo: string | null; ativo: boolean | null }> {
  if (usuario.tipo === 'cliente') {
    const nome = await obterClienteNome(usuario.id);
    return { nome, cargo: null, ativo: null };
  }
  const funcionario = await obterFuncionarioNome(usuario.id);
  return {
    nome: funcionario?.nome ?? null,
    cargo: usuario.tipo === 'funcionario' ? (funcionario?.cargo ?? null) : null,
    ativo: usuario.tipo === 'funcionario' ? (funcionario?.ativo ?? null) : null,
  };
}

/** Bloqueia funcionários inativados no login e na autenticação social. */
function garantirFuncionarioAtivo(ativo: boolean | null): void {
  if (ativo === false) {
    throw new ForbiddenError('Conta desativada. Contate o administrador.');
  }
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

  const { nome, cargo, ativo } = await resolveNomeECargo(usuario);
  if (usuario.tipo === 'funcionario') {
    garantirFuncionarioAtivo(ativo);
  }
  const role = mapearTipoParaRole(usuario.tipo, cargo);

  return {
    token: gerarTokenJWT(usuario, role),
    user: buildUsuarioDTO(usuario, nome, cargo),
    role,
  };
}

export async function atualizarPerfil(
  usuarioId: string,
  dados: { nome?: string; email?: string; senhaAtual?: string; novaSenha?: string }
): Promise<{ nome: string | null; email: string }> {
  // Buscar o usuário logo no início para validar existência e regras de senha
  const usuario = await findUsuarioById(usuarioId);
  if (!usuario) throw new NotFoundError('Usuário não encontrado');

  // Regra de verificação de senha atual:
  // - Usuário com senha_hash existente ao tentar trocar senha ou email exige senhaAtual.
  // - Primeiro acesso (primeiro_acesso = true): a mudança forçada da senha é o
  //   fluxo intencional — NÃO exige senhaAtual.
  // - Conta criada via Google (senha_hash NULL) define a primeira senha sem exigir senhaAtual.
  const alterandoCredencial = dados.novaSenha !== undefined || dados.email !== undefined;
  const ehPrimeiroAcessoTrocandoSenha =
    usuario.primeiro_acesso === true && dados.novaSenha !== undefined;
  if (usuario.senha_hash && alterandoCredencial && !ehPrimeiroAcessoTrocandoSenha) {
    if (!dados.senhaAtual) {
      throw new UnauthorizedError('Senha atual é obrigatória');
    }
    const senhaValida = await bcrypt.compare(dados.senhaAtual, usuario.senha_hash);
    if (!senhaValida) {
      throw new UnauthorizedError('Senha atual incorreta');
    }
  }

  // Se email fornecido, verificar duplicidade
  if (dados.email) {
    const existente = await findUsuarioByEmail(dados.email);
    if (existente && existente.id !== usuarioId) {
      throw new ValidationError('Email já está em uso');
    }
  }

  // Hash nova senha se fornecida
  let senhaHash: string | undefined;
  if (dados.novaSenha) {
    senhaHash = await bcrypt.hash(dados.novaSenha, SALT_ROUNDS);
  }

  // Transaction: atualizar usuario + cliente/funcionario
  await db.transaction(async (trx) => {
    // Atualizar usuario
    const updateUsuario: Record<string, unknown> = {};
    if (dados.email) updateUsuario.email = dados.email;
    if (senhaHash) {
      updateUsuario.senha_hash = senhaHash;
      // Senha alterada: primeiro acesso concluído
      updateUsuario.primeiro_acesso = false;
    }
    if (Object.keys(updateUsuario).length > 0) {
      updateUsuario.updated_at = new Date();
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
    email: dados.email ?? usuario.email,
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

  const { nome, cargo, ativo } = await resolveNomeECargo(usuario);
  if (usuario.tipo === 'funcionario') {
    garantirFuncionarioAtivo(ativo);
  }
  const role = mapearTipoParaRole(usuario.tipo, cargo);

  return {
    token: gerarTokenJWT(usuario, role),
    user: buildUsuarioDTO(usuario, nome, cargo),
    role,
    precisaTrocarSenha: usuario.primeiro_acesso === true,
  };
}

export async function solicitarRecuperacaoSenha(email: string): Promise<void> {
  const usuario = await findUsuarioByEmail(email);

  // Nunca revelar se o e-mail existe: se não encontrar, retorna silenciosamente.
  if (!usuario) return;

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await salvarTokenResetSenha(usuario.id, tokenHash, expiresAt);

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const link = `${frontendUrl}/#/login-cliente?token=${token}`;

  try {
    await enviarEmailRecuperacaoSenha(usuario.email, link);
  } catch (error) {
    // Não deixar falha de SMTP vazar pro usuário; logar para diagnóstico operacional.
    console.error('[email-service] Falha ao enviar e-mail de recuperação:', error);
  }
}

export async function redefinirSenha(token: string, novaSenha: string): Promise<void> {
  if (!token) {
    throw new ValidationError('Token inválido ou expirado');
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const usuario = await findUsuarioByResetTokenHash(tokenHash);

  if (!usuario) {
    throw new ValidationError('Token inválido ou expirado');
  }

  const senhaHash = await bcrypt.hash(novaSenha, SALT_ROUNDS);

  await db.transaction(async (trx) => {
    await trx('usuario').where('id', usuario.id).update({
      senha_hash: senhaHash,
      reset_token_hash: null,
      reset_token_expires_at: null,
      updated_at: new Date(),
    });
  });
}
