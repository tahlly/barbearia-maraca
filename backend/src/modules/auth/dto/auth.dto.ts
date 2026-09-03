import { z } from 'zod';
import { TipoUsuario } from '../../../shared/types/auth.js';

export const cadastroBodySchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  tipo: z.enum(['CLIENTE', 'BARBEIRO', 'RECEPCIONISTA', 'ADMINISTRADOR'] as [TipoUsuario, ...TipoUsuario[]]),
});

export const loginBodySchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(1, 'Senha é obrigatória'),
});

export const refreshTokenBodySchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token é obrigatório'),
});

export const logoutBodySchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token é obrigatório'),
});

export const cadastroSchema = z.object({ body: cadastroBodySchema });
export const loginSchema = z.object({ body: loginBodySchema });
export const refreshTokenSchema = z.object({ body: refreshTokenBodySchema });
export const logoutSchema = z.object({ body: logoutBodySchema });

export type CadastroDTO = z.infer<typeof cadastroBodySchema>;
export type LoginDTO = z.infer<typeof loginBodySchema>;
export type RefreshTokenDTO = z.infer<typeof refreshTokenBodySchema>;
export type LogoutDTO = z.infer<typeof logoutBodySchema>;