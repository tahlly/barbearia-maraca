/**
 * Contratos HTTP compartilhados entre o Backend (dono padrão deste arquivo) e a
 * SPA. O Backend mantém tipos espelho em backend/src/dtos/auth-dto.ts porque o
 * tsconfig do backend (rootDir: src) impede importar arquivos fora de
 * backend/src sem ajuste de configuração — ver pendência no handoff.
 *
 * Estes tipos refletem o contrato que a SPA já consome hoje
 * (frontend/src/services/auth.ts e frontend/src/services/googleAuth.ts).
 */

/** Papel funcional consumido pela SPA. */
export type Papel = 'admin' | 'recepcionista' | 'profissional' | 'cliente';

/** Resposta de autenticação (login local e Google) consumida pela SPA. */
export interface LoginResponse {
  token: string;
  userName: string;
  userEmail: string;
  expiresAt: number;
  role: Papel;
  avatarUrl: string | null;
}

/** Requisição de login local (a SPA envia `password`). */
export interface LoginLocalRequest {
  email: string;
  password: string;
}

/** Requisição de login via Google ID token. */
export interface GoogleLoginRequest {
  idToken: string;
}

/** Usuário autenticado retornado por rotas privadas (ex.: GET /api/auth/me). */
export interface UsuarioAutenticado {
  id: string;
  email: string;
  nome: string | null;
  papel: Papel;
  avatarUrl: string | null;
}

/** Resposta da rota privada PoC GET /api/auth/me. */
export interface MeResponse {
  user: UsuarioAutenticado;
}
