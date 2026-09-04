import { CONFIG } from "../config.js";

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

export const isMockMode = (): boolean => CONFIG.useMockApi;

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${CONFIG.apiBaseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

export async function httpJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${CONFIG.apiBaseUrl}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError("Não foi possível conectar ao servidor.", 0);
  }
  if (!response.ok) {
    const message =
      response.status === 401 || response.status === 403
        ? "Credenciais inválidas. Verifique e tente novamente."
        : `Erro na requisição (${response.status}). Tente novamente.`;
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as T;
}
