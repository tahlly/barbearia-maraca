import { CONFIG } from "../config.js";
import { navigateTo } from "../router.js";
import type { Session, UserRole } from "../types.js";
import { findAdminByEmail, updateAdmin, validateAdminLogin } from "./admins.js";
import { ApiError, delay, httpJson, isMockMode } from "./api.js";
import { validateClienteLogin } from "./clientes.js";
import { findUsuarioByEmail, updateUsuarioInterno, validateUsuarioInterno } from "./usuarios.js";

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
  superusuario: "/superusuario",
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

/**
 * Atualiza os dados do usuário da sessão atual (nome/senha/email) no mock.
 * O admin busca na lista de administradores; os demais vão aos usuários internos.
 */
export async function updateSessionUser(data: {
  nome?: string;
  email?: string;
  senhaAtual?: string;
  novaSenha?: string;
}): Promise<{ ok: boolean; message?: string }> {
  if (isMockMode()) {
    await delay(500);
    const session = getSession();
    if (!session) return { ok: false, message: "Sessão ausente." };

    if (session.role === "admin") {
      const admin = findAdminByEmail(session.userEmail);
      if (!admin) {
        return { ok: false, message: "Sessão administrativa não reconhecida." };
      }
      if (data.senhaAtual !== undefined && data.senhaAtual !== admin.senha) {
        return { ok: false, message: "Senha atual incorreta." };
      }
      if (data.email !== undefined) {
        const target = data.email.trim().toLowerCase();
        if (target !== admin.email && (findAdminByEmail(target) || findUsuarioByEmail(target))) {
          return { ok: false, message: "E-mail já cadastrado." };
        }
      }
      updateAdmin(admin.id, {
        nome: data.nome,
        email: data.email,
        senha: data.novaSenha,
      });
      const updated = findAdminByEmail(data.email ?? admin.email);
      persistSession({
        ...session,
        userName: updated?.nome ?? data.nome ?? session.userName,
        userEmail: updated?.email ?? session.userEmail,
      });
      return { ok: true };
    }

    const usuario = findUsuarioByEmail(session.userEmail);
    if (!usuario) return { ok: false, message: "Usuário não encontrado." };
    if (data.senhaAtual !== undefined && data.senhaAtual !== usuario.senha) {
      return { ok: false, message: "Senha atual incorreta." };
    }
    if (data.email !== undefined) {
      const target = data.email.trim().toLowerCase();
      if (target !== usuario.email && findUsuarioByEmail(target)) {
        return { ok: false, message: "E-mail já cadastrado." };
      }
    }
    updateUsuarioInterno(usuario.id, {
      nome: data.nome,
      email: data.email,
      senha: data.novaSenha,
    });
    const updated = findUsuarioByEmail(data.email ?? usuario.email);
    persistSession({
      ...session,
      userName: updated?.nome ?? data.nome ?? session.userName,
      userEmail: updated?.email ?? session.userEmail,
    });
    return { ok: true };
  }

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
  if (isMockMode()) {
    await delay(700);
    const norm = normalize(email);

    const superAdmin = CONFIG.demoSuperAdmin;
    if (norm === superAdmin.email && password === superAdmin.password) {
      persistSession({
        token: createToken(),
        userName: superAdmin.name,
        userEmail: norm,
        expiresAt: Date.now() + CONFIG.sessionTtlMs,
        role: "superusuario",
      });
      return { ok: true, role: "superusuario" };
    }

    const admin = validateAdminLogin(email, password);
    if (admin) {
      persistSession({
        token: createToken(),
        userName: admin.nome,
        userEmail: admin.email,
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
    const cliente = validateClienteLogin(email, password);
    if (cliente) {
      persistSession({
        token: createToken(),
        userName: cliente.nome,
        userEmail: cliente.email,
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
  sessionStorage.removeItem(CONFIG.sessionKey);
  navigateTo("/login");
}
