import { CONFIG } from "../config.js";
import { navigateTo } from "../router.js";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number = 0,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

/**
 * Lê o token Bearer armazenado na sessão (sessionStorage).
 * Retorna `null` se a sessão não existir ou o parse falhar.
 */
function readTokenFromSession(): string | null {
  try {
    const raw = sessionStorage.getItem(CONFIG.sessionKey);
    if (!raw) return null;
    const session = JSON.parse(raw) as { token?: string };
    return session.token ?? null;
  } catch {
    return null;
  }
}

/**
 * Constrói o objeto de headers incluindo Content-Type padrão e
 * Authorization (quando há token). Headers explícitos em `init`
 * têm precedência sobre os defaults.
 */
function mergeHeaders(init?: RequestInit): Record<string, string> {
  const result: Record<string, string> = { "Content-Type": "application/json" };

  const token = readTokenFromSession();
  if (token) {
    result["Authorization"] = `Bearer ${token}`;
  }

  if (init?.headers) {
    const h = init.headers;
    if (h instanceof Headers) {
      h.forEach((v, k) => {
        result[k] = v;
      });
    } else if (Array.isArray(h)) {
      for (const [k, v] of h) {
        result[k] = v;
      }
    } else {
      Object.assign(result, h);
    }
  }

  return result;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { headers: _, ...rest } = init;
  return fetch(`${CONFIG.apiBaseUrl}${path}`, {
    ...rest,
    headers: mergeHeaders(init),
  });
}

/** Caminhos de autenticação: nesses casos 401 significa credenciais inválidas,
 *  não sessão expirada. */
const AUTH_PATHS = ["/auth/login", "/auth/register", "/auth/google"];

/** Painel padrão por papel, usado só para redirecionar após 403. */
const ROLE_PANEL_BY_SESSION: Record<string, string> = {
  superusuario: "/superusuario",
  admin: "/admin",
  recepcionista: "/recepcionista",
  profissional: "/profissional",
  cliente: "/minha-conta",
};

interface ApiErrorBody {
  erro?: boolean;
  mensagem?: string;
  message?: string;
  error?: string;
}

/** Extrai a mensagem legível de erro do corpo da resposta, quando houver. */
async function readErrorMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    for (const key of ["mensagem", "message", "error"] as const) {
      const value = body[key];
      if (typeof value === "string" && value.trim() !== "") return value;
    }
    return null;
  } catch {
    return null;
  }
}

function readSessionRole(): string | null {
  try {
    const raw = sessionStorage.getItem(CONFIG.sessionKey);
    if (!raw) return null;
    const session = JSON.parse(raw) as { role?: string };
    return session.role ?? null;
  } catch {
    return null;
  }
}

export async function httpJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    const { headers: _, ...rest } = init;
    response = await fetch(`${CONFIG.apiBaseUrl}${path}`, {
      ...rest,
      headers: mergeHeaders(init),
    });
  } catch {
    throw new ApiError("Não foi possível conectar ao servidor.", 0);
  }

  const isAuthPath = AUTH_PATHS.some((p) => path.startsWith(p));

  /* 401 em caminho de autenticação → credenciais inválidas (sem redirecionar). */
  if (response.status === 401 && isAuthPath) {
    const serverMessage = (await readErrorMessage(response)) ?? "Credenciais inválidas. Verifique e tente novamente.";
    throw new ApiError(serverMessage, 401);
  }

  /* 401 em caminho autenticado → sessão expirada: limpa storage e vai ao login. */
  if (response.status === 401) {
    if (readTokenFromSession()) {
      sessionStorage.removeItem(CONFIG.sessionKey);
      navigateTo("/login");
    }
    const serverMessage = (await readErrorMessage(response)) ?? "Sessão expirada. Faça login novamente.";
    throw new ApiError(serverMessage, 401);
  }

  /* 403 → acesso negado: mensagem de permissão e redireciona para o painel do papel. */
  if (response.status === 403) {
    const role = readSessionRole();
    if (role) navigateTo(ROLE_PANEL_BY_SESSION[role] ?? "/login");
    const serverMessage = (await readErrorMessage(response)) ?? "Você não tem permissão para realizar esta ação.";
    throw new ApiError(serverMessage, 403);
  }

  if (!response.ok) {
    const serverMessage =
      (await readErrorMessage(response)) ?? `Erro na requisição (${response.status}). Tente novamente.`;
    throw new ApiError(serverMessage, response.status);
  }
  return (await response.json()) as T;
}
