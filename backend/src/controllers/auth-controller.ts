import type { Request, Response } from 'express';
import { z } from 'zod';
import { autenticarComGoogle, registrar, login, atualizarPerfil } from '../services/auth-service';
import { JWT_EXPIRES_IN } from '../config/jwt';
import { parseExpiresInToMs } from '../utils/jwt-utils';
import { ValidationError } from '../errors/ValidationError';

function expiresAt(): number {
  return Date.now() + parseExpiresInToMs(JWT_EXPIRES_IN);
}

export async function loginComGoogle(req: Request, res: Response): Promise<void> {
  const { idToken } = req.body;

  if (!idToken || typeof idToken !== 'string') {
    res.status(400).json({
      erro: true,
      mensagem: 'Token do Google não fornecido',
    });
    return;
  }

  try {
    const resultado = await autenticarComGoogle(idToken);
    res.json({
      token: resultado.token,
      userName: resultado.user.nome,
      userEmail: resultado.user.email,
      expiresAt: expiresAt(),
      role: resultado.role,
      avatarUrl: resultado.user.avatarUrl,
    });
  } catch (error: unknown) {
    const status = (error as { status?: number }).status ?? 401;
    const message =
      error instanceof Error ? error.message : 'Falha ao autenticar com Google';
    res.status(status).json({ erro: true, mensagem: message });
  }
}

export async function registrarUsuario(req: Request, res: Response): Promise<void> {
  const { email, senha, nome, telefone } = req.body;

  if (!email || !senha || !nome) {
    res.status(400).json({ erro: true, mensagem: 'Email, senha e nome obrigatorios' });
    return;
  }

  if (typeof email !== 'string' || typeof senha !== 'string' || typeof nome !== 'string') {
    res.status(400).json({ erro: true, mensagem: 'Dados invalidos' });
    return;
  }

  if (senha.length < 6) {
    res.status(400).json({ erro: true, mensagem: 'Senha deve ter no minimo 6 caracteres' });
    return;
  }

  try {
    const resultado = await registrar({ email, senha, nome, telefone });
    res.status(201).json({
      token: resultado.token,
      user: {
        id: resultado.user.id,
        email: resultado.user.email,
        nome: resultado.user.nome,
        tipo: resultado.user.tipo,
      },
    });
  } catch (error: unknown) {
    const status = (error as { status?: number }).status ?? 500;
    const message =
      error instanceof Error ? error.message : 'Erro ao criar conta';
    res.status(status).json({ erro: true, mensagem: message });
  }
}

export async function loginLocal(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    res.status(400).json({ erro: true, mensagem: 'Email e senha obrigatorios' });
    return;
  }

  try {
    const resultado = await login({ email, senha: password });
    res.status(200).json({
      token: resultado.token,
      userName: resultado.user.nome,
      userEmail: resultado.user.email,
      expiresAt: expiresAt(),
      role: resultado.role,
      user: resultado.user,
    });
  } catch (error: unknown) {
    const status = (error as { status?: number }).status ?? 401;
    const message =
      error instanceof Error ? error.message : 'Credenciais inválidas';
    res.status(status).json({ erro: true, mensagem: message });
  }
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ mensagem: 'Logout realizado' });
}

const atualizarPerfilSchema = z.object({
  nome: z.string().min(1).optional(),
  email: z.string().email().optional(),
  senha: z.string().min(6).optional(),
}).refine((data) => data.nome !== undefined || data.email !== undefined || data.senha !== undefined, {
  message: 'Pelo menos um campo deve ser fornecido',
});

export async function atualizarPerfilHandler(req: Request, res: Response): Promise<void> {
  const parsed = atualizarPerfilSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0].message);
  }
  const resultado = await atualizarPerfil(req.user!.id, parsed.data);
  res.json({ success: true, user: resultado });
}
