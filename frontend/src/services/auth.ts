import { CONFIG } from "../config.js";
import { navigateTo } from "../router.js";
import type { Session, UserRole } from "../types.js";
import { ApiError, apiFetch, delay, httpJson, isMockMode } from "./api.js";
import { validateClienteLogin } from "./clientes.js";
import { validateUsuarioInterno } from "./usuarios.js";

export interface LoginResult {
  ok: boolean;
  role?: UserRole;
  message?: string;
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

function createToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function persistSession(session: Session): void {
  sessionStorage.setItem(CONFIG.sessionKey, JSON.stringify(session));
}

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

const DEMO_ADMIN_KEY = "maraca.v2.demoAdmin";

interface DemoAdminProfile {
  nome: string;
  email: string;
  senha: string;
}

function loadDemoAdmin(): DemoAdminProfile {
  const raw = localStorage.getItem(DEMO_ADMIN_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DemoAdminProfile;
      if (parsed && typeof parsed.nome === "string" && typeof parsed.email === "string" && typeof parsed.senha === "string") {
        return parsed;
      }
    } catch {
      /* ignore */
    }
  }
  return {
    nome: CONFIG.demoAdmin.name,
    email: CONFIG.demoAdmin.email,
    senha: CONFIG.demoAdmin.password,
  };
}

/**
 * Atualiza os dados do usuário da sessão atual (nome/email) no sessionStorage.
 * O endpoint PATCH /auth/me existe no backend, mas a persistência remota
 * ainda não é chamada aqui — integração futura.
 */
export async function updateSessionUser(data: {
  nome?: string;
  email?: string;
  senhaAtual?: string;
  novaSenha?: string;
}): Promise<{ ok: boolean; message?: string }> {
  const session = getSession();
  if (!session) return { ok: false, message: "Sessão ausente." };

  persistSession({
    ...session,
    userName: data.nome ?? session.userName,
    userEmail: data.email ?? session.userEmail,
  });
  return { ok: true };
}

/**
 * Login administrativo (admin, profissional, recepcionista).
 * Retorna o papel para direcionamento; em caso de falha retorna mensagem.
 */
export async function loginInterno(email: string, password: string): Promise<LoginResult> {
  if (isMockMode()) {
    await delay(700);
    const norm = normalize(email);

    const demo = loadDemoAdmin();
    if (norm === demo.email && password === demo.senha) {
      persistSession({
        token: createToken(),
        userName: demo.nome,
        userEmail: norm,
        expiresAt: Date.now() + CONFIG.sessionTtlMs,
        role: "admin",
      });
      return { ok: true, role: "admin" };
    }

    const usuario = validateUsuarioInterno(email, password);
    if (usuario) {
      persistSession({
        token: createToken(),
        userName: usuario.nome,
        userEmail: usuario.email,
        expiresAt: Date.now() + CONFIG.sessionTtlMs,
        role: usuario.role,
      });
      return { ok: true, role: usuario.role };
    }

    return { ok: false, message: "Credenciais inválidas. Verifique e tente novamente." };
  }

  try {
    const data = await httpJson<{ token: string; userName: string; userEmail: string; expiresAt?: number; role: UserRole }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email: normalize(email), password }) },
    );
    persistSession({
      token: data.token,
      userName: data.userName,
      userEmail: data.userEmail,
      expiresAt: data.expiresAt ?? Date.now() + CONFIG.sessionTtlMs,
      role: data.role,
    });
    return { ok: true, role: data.role };
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
  if (isMockMode()) {
    await delay(700);
    const result = await validateClienteLogin(email, password);
    if (result) {
      persistSession({
        token: result.token,
        userName: result.cliente.nome,
        userEmail: result.cliente.email,
        expiresAt: Date.now() + CONFIG.sessionTtlMs,
        role: "cliente",
      });
      return { ok: true, role: "cliente" };
    }
    return { ok: false, message: "Credenciais inválidas. Verifique e tente novamente." };
  }

  try {
    const data = await httpJson<{ token: string; userName: string; userEmail: string; expiresAt?: number; role: UserRole }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email: normalize(email), password }) },
    );
    persistSession({
      token: data.token,
      userName: data.userName,
      userEmail: data.userEmail,
      expiresAt: data.expiresAt ?? Date.now() + CONFIG.sessionTtlMs,
      role: data.role,
    });
    return { ok: true, role: data.role };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Credenciais inválidas. Verifique e tente novamente." };
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
