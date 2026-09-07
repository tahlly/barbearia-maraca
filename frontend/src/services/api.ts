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

  /* 401 → sessão inválida: limpa storage e redireciona para login */
  if (response.status === 401) {
    sessionStorage.removeItem(CONFIG.sessionKey);
    navigateTo("/login");
    throw new ApiError("Sessão expirada. Faça login novamente.", 401);
  }

  if (!response.ok) {
    const message =
      response.status === 403
        ? "Credenciais inválidas. Verifique e tente novamente."
        : `Erro na requisição (${response.status}). Tente novamente.`;
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as T;
}
