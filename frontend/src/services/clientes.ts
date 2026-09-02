import type { Cliente } from "../types.js";
import { CONFIG } from "../config.js";

function readList(): Cliente[] {
  const raw = localStorage.getItem(CONFIG.clientesKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Cliente[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(list: Cliente[]): void {
  localStorage.setItem(CONFIG.clientesKey, JSON.stringify(list));
}

function createId(): string {
  return `CLI-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function findClienteByEmail(email: string): Cliente | null {
  const normalized = email.trim().toLowerCase();
  return readList().find((c) => c.email.toLowerCase() === normalized) ?? null;
}

export function findClienteById(id: string): Cliente | null {
  return readList().find((c) => c.id === id) ?? null;
}

export function registerCliente(data: {
  nome: string;
  email: string;
  telefone: string;
  senha: string;
}): Cliente {
  const cliente: Cliente = {
    id: createId(),
    nome: data.nome.trim(),
    email: data.email.trim().toLowerCase(),
    telefone: data.telefone,
    senha: data.senha,
    createdAt: new Date().toISOString(),
  };
  writeList([...readList(), cliente]);
  return cliente;
}

export function updateCliente(
  id: string,
  data: { nome?: string; telefone?: string; email?: string; senha?: string },
): Cliente | null {
  const list = readList();
  const index = list.findIndex((c) => c.id === id);
  if (index < 0) return null;
  const updated: Cliente = {
    ...list[index]!,
    ...(data.nome !== undefined ? { nome: data.nome.trim() } : {}),
    ...(data.telefone !== undefined ? { telefone: data.telefone } : {}),
    ...(data.email !== undefined ? { email: data.email.trim().toLowerCase() } : {}),
    ...(data.senha !== undefined ? { senha: data.senha } : {}),
  };
  list[index] = updated;
  writeList(list);
  return updated;
}

export function updateClienteSenha(id: string, senha: string): boolean {
  return updateCliente(id, { senha }) !== null;
}

export function validateClienteLogin(email: string, senha: string): Cliente | null {
  const cliente = findClienteByEmail(email);
  if (!cliente) return null;
  return cliente.senha === senha ? cliente : null;
}
