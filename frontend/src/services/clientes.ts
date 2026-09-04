import type { Cliente } from "../types.js";
import { apiFetch } from "./api.js";

export async function findClienteByEmail(email: string): Promise<Cliente | null> {
  try {
    const res = await apiFetch(`/clientes/buscar?email=${encodeURIComponent(email)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data ?? null;
  } catch {
    return null;
  }
}

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

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Erro ao cadastrar" }));
    throw new Error(err.message || "Erro ao cadastrar");
  }

  const result = await res.json();
  return {
    id: result.user.id,
    nome: result.user.nome,
    email: result.user.email,
    telefone: data.telefone,
    senha: "",
    createdAt: new Date().toISOString(),
  };
}

export async function validateClienteLogin(email: string, senha: string): Promise<Cliente | null> {
  try {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, senha }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return {
      id: data.user.id,
      nome: data.user.nome || data.user.name || "",
      email: data.user.email,
      telefone: "",
      senha: "",
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
