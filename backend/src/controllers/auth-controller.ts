import type { Request, Response } from 'express';
import { autenticarComGoogle } from '../services/auth-service';

function mapearTipoParaRole(tipo: string, cargo?: string | null): string {
  if (tipo === 'cliente') return 'cliente';
  if (cargo === 'administrador') return 'admin';
  if (cargo === 'recepcionista') return 'recepcionista';
  return 'profissional';
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
      expiresAt: Date.now() + 30 * 60 * 1000,
      role: mapearTipoParaRole(resultado.user.tipo, resultado.user.cargo),
      avatarUrl: resultado.user.avatarUrl,
    });
  } catch (error: unknown) {
    const status = (error as { status?: number }).status ?? 401;
    const message =
      error instanceof Error ? error.message : 'Falha ao autenticar com Google';
    res.status(status).json({ erro: true, mensagem: message });
  }
}
