import { CONFIG } from "../config.js";
import { navigateTo } from "../router.js";
import type { Session, UserRole } from "../types.js";
import { ApiError, apiFetch, httpJson } from "./api.js";
import { SESSION_UPDATED_EVENT, clearUserStorage } from "./sessionArtifacts.js";

export { SESSION_UPDATED_EVENT };

export interface LoginResult {
  ok: boolean;
  role?: UserRole;
  message?: string;
  precisaTrocarSenha?: boolean;
}

export interface AuthRedirect {
  path: string;
  role: UserRole;
}

export const ROLE_REDIRECTS: Record<UserRole, string> = {
  admin: "/admin",
  recepcionista: "/recepcionista",
  profissional: "/profissional",
  cliente: "/minha-conta",
};

export function redirectForRole(role: UserRole): void {
  navigateTo(ROLE_REDIRECTS[role] ?? "/");
}

function persistSession(session: Session): void {
  sessionStorage.setItem(CONFIG.sessionKey, JSON.stringify(session));
}

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Atualiza os dados do usuário da sessão atual (nome/senha/email) via API.
 */
export async function updateSessionUser(data: {
  nome?: string;
  email?: string;
  senhaAtual?: string;
  novaSenha?: string;
}): Promise<{ ok: boolean; message?: string }> {
  const session = getSession();
  if (!session) return { ok: false, message: "Sessão ausente." };

  try {
    await httpJson<{ ok: boolean }>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    const session = getSession();
    if (session) {
      persistSession({
        ...session,
        userName: data.nome ?? session.userName,
        userEmail: data.email ?? session.userEmail,
      });
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    return { ok: false, message: "Não foi possível atualizar o perfil." };
  }
}

/**
 * Login administrativo (admin, profissional, recepcionista).
 * Retorna o papel para direcionamento; em caso de falha retorna mensagem.
 */
export async function loginInterno(email: string, password: string): Promise<LoginResult> {
  try {
    const data = await httpJson<{ token: string; userName: string; userEmail: string; expiresAt?: number; role: UserRole; precisaTrocarSenha?: boolean; permissoes?: Record<string, boolean> }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email: normalize(email), password }) },
    );
    persistSession({
      token: data.token,
      userName: data.userName,
      userEmail: data.userEmail,
      expiresAt: data.expiresAt ?? Date.now() + CONFIG.sessionTtlMs,
      role: data.role,
      precisaTrocarSenha: data.precisaTrocarSenha ?? false,
      permissoes: data.permissoes,
    });
    return { ok: true, role: data.role, precisaTrocarSenha: data.precisaTrocarSenha ?? false };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Credenciais inválidas. Verifique e tente novamente." };
  }
}

/**
 * Login da área do cliente (conta cadastrada).
 */
export async function loginCliente(email: string, password: string): Promise<LoginResult> {
  try {
    const data = await httpJson<{ token: string; userName: string; userEmail: string; expiresAt?: number; role: UserRole; precisaTrocarSenha?: boolean; permissoes?: Record<string, boolean> }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email: normalize(email), password }) },
    );
    persistSession({
      token: data.token,
      userName: data.userName,
      userEmail: data.userEmail,
      expiresAt: data.expiresAt ?? Date.now() + CONFIG.sessionTtlMs,
      role: data.role,
      precisaTrocarSenha: data.precisaTrocarSenha ?? false,
      permissoes: data.permissoes,
    });
    return { ok: true, role: data.role, precisaTrocarSenha: data.precisaTrocarSenha ?? false };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Credenciais inválidas. Verifique e tente novamente." };
  }
}

/**
 * Conclui o primeiro acesso: define a nova senha (PATCH /auth/me) e limpa a
 * flag de troca obrigatória da sessão local.
 */
export async function completeFirstAccess(
  novaSenha: string,
): Promise<{ ok: boolean; message?: string }> {
  const session = getSession();
  if (!session) return { ok: false, message: "Sessão ausente." };

  try {
    await httpJson<{ ok: boolean }>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify({ novaSenha }),
    });
    persistSession({ ...session, precisaTrocarSenha: false });
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    return { ok: false, message: "Não foi possível atualizar a senha." };
  }
}

export function getSession(): Session | null {
  const raw = sessionStorage.getItem(CONFIG.sessionKey);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Session;
    if (!session.token || session.expiresAt <= Date.now()) {
      // Expira sem notificar (getSession é chamado com frequência — evitamos loops).
      clearUserStorage(false);
      return null;
    }
    return session;
  } catch {
    clearUserStorage(false);
    return null;
  }
}

/**
 * Persiste a URL da foto de perfil no estado global do usuário (Session) e
 * emite `SESSION_UPDATED_EVENT` para que a sidebar atualize instantaneamente.
 * Mantém o antigo `maraca.profilePhoto` sincronizado por compatibilidade.
 */
export function updateSessionAvatar(avatarUrl: string): void {
  const session = getSession();
  if (!session) return;
  persistSession({ ...session, avatarUrl });
  sessionStorage.setItem("maraca.profilePhoto", avatarUrl);
  window.dispatchEvent(new CustomEvent(SESSION_UPDATED_EVENT, { detail: { avatarUrl } }));
}

export function requireSession(): Session {
  const session = getSession();
  if (!session) {
    navigateTo("/login");
    throw new Error("Sessão expirada");
  }
  if (session.precisaTrocarSenha) {
    navigateTo("/login");
    throw new Error("Primeiro acesso pendente");
  }
  return session;
}

export function requireRole(allowed: UserRole[]): Session {
  const session = getSession();
  if (!session) {
    navigateTo("/login");
    throw new Error("Sessão expirada");
  }
  if (session.precisaTrocarSenha) {
    navigateTo("/login");
    throw new Error("Primeiro acesso pendente");
  }
  if (!allowed.includes(session.role)) {
    redirectForRole(session.role);
    throw new Error("Acesso não autorizado");
  }
  return session;
}

export async function solicitarRecuperacaoSenha(email: string): Promise<{ ok: boolean; message?: string }> {
  try {
    await httpJson<{ mensagem: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: normalize(email) }),
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    return { ok: false, message: "Não foi possível enviar as instruções." };
  }
}

export async function redefinirSenha(token: string, novaSenha: string): Promise<{ ok: boolean; message?: string }> {
  try {
    await httpJson<{ mensagem: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, novaSenha }),
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    return { ok: false, message: "Não foi possível redefinir a senha." };
  }
}

export function logout(): void {
  /* Fire-and-forget: notifica o backend sobre o logout sem bloquear o fluxo */
  apiFetch("/auth/logout", { method: "POST" }).catch(() => {
    /* ignorar — o logout local continua mesmo se o backend falhar */
  });

  // Limpeza completa do estado local do usuário (sessão, foto, tentativas de
  // login) + notifica a UI para descartar referências à imagem em memória.
  clearUserStorage();
  // Logout leva direto à página inicial pública (Home/Landing), sem passar pelo login.
  navigateTo("/");
}
