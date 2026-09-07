import { CONFIG } from "../config.js";
import type { Cliente } from "../types.js";
import { apiFetch } from "./api.js";

/**
 * Busca cliente por e-mail.
 *
 * Chama `GET /clientes/buscar?email=...` (endpoint autenticado: recepcionista/
 * admin encontram qualquer cliente; um cliente autenticado só encontra o
 * próprio registro). Retorna `null` em 401/404/erro para o caller tratar
 * como "não cadastrado".
 */
export async function findClienteByEmail(email: string): Promise<Cliente | null> {
  try {
    const res = await apiFetch(`/clientes/buscar?email=${encodeURIComponent(email)}`);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      id: string;
      nome: string;
      email: string;
      telefone: string | null;
    };
    return {
      id: data.id,
      nome: data.nome,
      email: data.email,
      telefone: data.telefone ?? "",
      senha: "",
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Busca clientes por nome/e-mail/telefone (recepcionista/admin).
 *
 * Chama `GET /clientes?busca=termo`. Retorna a lista vazia em erro para o
 * caller tratar como "nenhum resultado".
 */
export async function buscarClientes(termo: string): Promise<Cliente[]> {
  try {
    const res = await apiFetch(`/clientes?busca=${encodeURIComponent(termo.trim())}`, {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as Array<{
      id: string;
      nome: string;
      email: string;
      telefone: string | null;
    }>;
    return data.map((c) => ({
      id: c.id,
      nome: c.nome,
      email: c.email,
      telefone: c.telefone ?? "",
      senha: "",
      createdAt: new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

/**
 * Cria um novo cliente sem alterar a sessão ativa (recepcionista/admin).
 *
 * Chama `POST /clientes` (autorizado apenas para recepcionista/admin) com
 * `{ nome, email, telefone?, senha }`. Diferente de `registerCliente`, NÃO
 * faz auto-login: a sessão do operador permanece intacta.
 */
export async function criarCliente(data: {
  nome: string;
  email: string;
  telefone?: string;
  senha: string;
}): Promise<Cliente> {
  const res = await apiFetch("/clientes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nome: data.nome,
      email: data.email,
      telefone: data.telefone?.trim() || undefined,
      senha: data.senha,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
    mensagem?: string;
  };

  if (!res.ok) {
    throw new Error(body.message || body.mensagem || body.error || "Erro ao cadastrar cliente");
  }

  const created = body as unknown as { id: string; nome: string; email: string; telefone: string | null };
  return {
    id: created.id,
    nome: created.nome,
    email: created.email,
    telefone: created.telefone ?? "",
    senha: "",
    createdAt: new Date().toISOString(),
  };
}

/**
 * Registra um novo cliente e realiza auto-login.
 *
 * O backend retorna `{ token, user: { id, email, nome, tipo } }`.
 * Após o registro bem-sucedido, a sessão é gravada no sessionStorage
 * para que o cliente seja autenticado imediatamente (auto-login).
 */
export async function registerCliente(data: {
  nome: string;
  email: string;
  telefone: string;
  senha: string;
}): Promise<Cliente> {
  const res = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: data.email,
      senha: data.senha,
      nome: data.nome,
      telefone: data.telefone,
    }),
  });

  let body: {
    token?: string;
    user?: { id: string; email: string; nome: string; tipo: string };
    message?: string;
    mensagem?: string;
    error?: string;
  } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    body = {};
  }

  if (!res.ok) {
    throw new Error(body.mensagem || body.message || body.error || "Erro ao cadastrar");
  }

  const result = body as {
    token: string;
    user: { id: string; email: string; nome: string; tipo: string };
  };

  /* Auto-login: grava a sessão com o token retornado pelo backend */
  const session = {
    token: result.token,
    userName: result.user.nome,
    userEmail: result.user.email,
    expiresAt: Date.now() + CONFIG.sessionTtlMs,
    role: "cliente" as const,
  };
  sessionStorage.setItem(CONFIG.sessionKey, JSON.stringify(session));

  return {
    id: result.user.id,
    nome: result.user.nome,
    email: result.user.email,
    telefone: data.telefone,
    senha: "",
    createdAt: new Date().toISOString(),
  };
}

/**
 * Retorno de `validateClienteLogin`: dados do cliente + token JWT.
 */
export interface ClienteLoginResult {
  cliente: Cliente;
  token: string;
}

/**
 * Valida credenciais de login do cliente.
 *
 * O backend espera o campo `password` (não `senha`).
 * Retorna o `Cliente` e o `token` JWT para que o caller possa
 * gravar a sessão corretamente.
 */
export async function validateClienteLogin(email: string, senha: string): Promise<ClienteLoginResult | null> {
  try {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: senha }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      token: string;
      user: { id: string; nome?: string; name?: string; email: string };
    };
    return {
      cliente: {
        id: data.user.id,
        nome: data.user.nome || data.user.name || "",
        email: data.user.email,
        telefone: "",
        senha: "",
        createdAt: new Date().toISOString(),
      },
      token: data.token,
    };
  } catch {
    return null;
  }
}
