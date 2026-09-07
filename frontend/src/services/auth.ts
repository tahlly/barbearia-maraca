import { CONFIG } from "../config.js";
import { navigateTo } from "../router.js";
import type { Session, UserRole } from "../types.js";
import { ApiError, apiFetch, httpJson } from "./api.js";

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
    const data = await httpJson<{ token: string; userName: string; userEmail: string; expiresAt?: number; role: UserRole; precisaTrocarSenha?: boolean }>(
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
    const data = await httpJson<{ token: string; userName: string; userEmail: string; expiresAt?: number; role: UserRole; precisaTrocarSenha?: boolean }>(
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
      sessionStorage.removeItem(CONFIG.sessionKey);
      return null;
    }
    return session;
  } catch {
    sessionStorage.removeItem(CONFIG.sessionKey);
    return null;
  }
}

export function requireSession(): Session {
  const session = getSession();
  if (!session) {
    navigateTo("/login");
    throw new Error("Sessão expirada");
  }
  return session;
}

export function requireRole(allowed: UserRole[]): Session {
  const session = getSession();
  if (!session) {
    navigateTo("/login");
    throw new Error("Sessão expirada");
  }
  if (!allowed.includes(session.role)) {
    redirectForRole(session.role);
    throw new Error("Acesso não autorizado");
  }
  return session;
}

export function logout(): void {
  /* Fire-and-forget: notifica o backend sobre o logout sem bloquear o fluxo */
  apiFetch("/auth/logout", { method: "POST" }).catch(() => {
    /* ignorar — o logout local continua mesmo se o backend falhar */
  });

  sessionStorage.removeItem(CONFIG.sessionKey);
  navigateTo("/login");
}
