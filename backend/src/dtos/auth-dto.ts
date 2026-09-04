export type Papel = 'admin' | 'recepcionista' | 'profissional' | 'cliente';

export interface UsuarioDTO {
  id: string;
  email: string;
  tipo: string;
  nome: string | null;
  cargo?: string | null;
  avatarUrl?: string | null;
}

export interface LoginResponseDTO {
  token: string;
  expiresAt: number;
  user: UsuarioDTO;
}

export interface GoogleLoginRequestDTO {
  idToken: string;
}

export interface LoginLocalRequestDTO {
  email: string;
  senha?: string;
  password?: string;
}

/**
 * Payload devolvido ao frontend (SPA) nos logins local e Google.
 * Mantém o contrato consumido hoje pela SPA em frontend/src/services/auth.ts
 * e frontend/src/services/googleAuth.ts.
 */
export interface RespostaLoginSpaDTO {
  token: string;
  userName: string;
  userEmail: string;
  expiresAt: number;
  role: Papel;
  avatarUrl: string | null;
}

/**
 * Usuário autenticado retornado por rotas privadas (ex.: GET /api/auth/me).
 */
export interface UsuarioAutenticadoDTO {
  id: string;
  email: string;
  nome: string | null;
  papel: Papel;
  avatarUrl: string | null;
}
