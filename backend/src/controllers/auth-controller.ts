import type { NextFunction, Request, Response } from 'express';
import { autenticarComGoogle, autenticarLocal, mapearTipoParaRole } from '../services/auth-service';
import { ValidationError } from '../errors/ValidationError';
import type { LoginResponseDTO, RespostaLoginSpaDTO } from '../dtos/auth-dto';

function paraRespostaSpa(resultado: LoginResponseDTO): RespostaLoginSpaDTO {
  return {
    token: resultado.token,
    userName: resultado.user.nome ?? resultado.user.email,
    userEmail: resultado.user.email,
    expiresAt: resultado.expiresAt,
    role: mapearTipoParaRole(resultado.user.tipo, resultado.user.cargo),
    avatarUrl: resultado.user.avatarUrl ?? null,
  };
}

export async function loginLocal(req: Request, res: Response, next: NextFunction): Promise<void> {
  const body = req.body as { email?: unknown; senha?: unknown; password?: unknown };

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const senha =
    typeof body.senha === 'string' && body.senha.length > 0
      ? body.senha
      : typeof body.password === 'string' && body.password.length > 0
        ? body.password
        : '';

  if (!email || !senha) {
    next(new ValidationError('Email e senha são obrigatórios'));
    return;
  }

  try {
    const resultado = await autenticarLocal(email, senha);
    res.json(paraRespostaSpa(resultado));
  } catch (error) {
    next(error);
  }
}

export async function loginComGoogle(req: Request, res: Response, next: NextFunction): Promise<void> {
  const body = req.body as { idToken?: unknown };

  if (typeof body.idToken !== 'string' || body.idToken.length === 0) {
    next(new ValidationError('Token do Google não fornecido'));
    return;
  }

  try {
    const resultado = await autenticarComGoogle(body.idToken);
    res.json(paraRespostaSpa(resultado));
  } catch (error) {
    next(error);
  }
}

/**
 * Rota privada PoC: retorna o usuário autenticado com o papel derivado no
 * backend. Protegida por `autenticar` e `autorizarPapel` (todos os papéis).
 */
export async function obterUsuarioAutenticado(req: Request, res: Response): Promise<void> {
  if (!req.usuario || !req.papel) {
    res.status(401).json({ erro: true, mensagem: 'Não autenticado' });
    return;
  }

  res.json({
    user: {
      id: req.usuario.id,
      email: req.usuario.email,
      nome: req.usuario.nome,
      papel: req.papel,
      avatarUrl: req.usuario.avatarUrl ?? null,
    },
  });
}
